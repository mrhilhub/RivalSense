import { supabaseAdmin } from '@/lib/supabaseServer';
import { fetchCleanText, hashText } from '@/lib/crawler';
import { makeDiffExcerpt } from '@/lib/diff';
import { summarizeChange } from '@/lib/summarize';
import { sendAlert, buildChangeEmail } from '@/lib/email';
import { generateIntelligenceEmbedding } from '@/lib/embeddings';

export type CheckSourceScope = 'all' | 'system';

export type RunSourceChecksResult = {
  checked: number;
  results: Array<{
    url: string;
    status: 'baseline_created' | 'unchanged' | 'changed' | 'error';
    summary?: string;
    error?: string;
  }>;
};

type MonitoredSourceRow = {
  id: string;
  url: string;
  user_id: string;
  competitor_id: string;
  type?: string | null;
  competitors?: { name?: string | null; is_system?: boolean | null } | { name?: string | null; is_system?: boolean | null }[] | null;
};

const PAGE_SIZE = 50;

async function updateSourceStatus(
  sourceId: string,
  status: 'baseline_created' | 'unchanged' | 'changed' | 'error'
) {
  const supabase = supabaseAdmin();

  await supabase
    .from('monitored_sources')
    .update({
      last_checked_at: new Date().toISOString(),
      last_status: status,
    })
    .eq('id', sourceId);
}

function getCompanyName(source: {
  competitors?: { name?: string | null } | { name?: string | null }[] | null;
}) {
  if (Array.isArray(source.competitors)) {
    return source.competitors[0]?.name || 'AI company';
  }

  return source.competitors?.name || 'AI company';
}

function getCompetitorName(source: MonitoredSourceRow) {
  if (Array.isArray(source.competitors)) {
    return source.competitors[0]?.name || 'System';
  }

  return source.competitors?.name || 'System';
}

async function processSource(source: MonitoredSourceRow) {
  const supabase = supabaseAdmin();
  const text = await fetchCleanText(source.url);
  const contentHash = hashText(text);

  const { data: latest } = await supabase
    .from('snapshots')
    .select('*')
    .eq('source_id', source.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latest) {
    await supabase.from('snapshots').insert({
      source_id: source.id,
      content_hash: contentHash,
      raw_text: text,
    });

    await updateSourceStatus(source.id, 'baseline_created');

    return {
      url: source.url,
      status: 'baseline_created' as const,
    };
  }

  if (latest.content_hash === contentHash) {
    await updateSourceStatus(source.id, 'unchanged');

    return {
      url: source.url,
      status: 'unchanged' as const,
    };
  }

  const { data: snapshot } = await supabase
    .from('snapshots')
    .insert({
      source_id: source.id,
      content_hash: contentHash,
      raw_text: text,
    })
    .select()
    .single();

  const diff = makeDiffExcerpt(latest.raw_text, text);

  const ai = await summarizeChange({
    url: source.url,
    oldText: latest.raw_text,
    newText: text,
    diff,
  });

  const { data: change } = await supabase
    .from('changes')
    .insert({
      source_id: source.id,
      user_id: source.user_id,
      previous_snapshot_id: latest.id,
      current_snapshot_id: snapshot?.id,
      summary: ai.summary,
      importance_score: ai.importance_score || 3,
      diff_excerpt: diff,
    })
    .select()
    .single();

  const companyName = getCompanyName(source);
  const sourceType = source.type || 'company_update';

  let embedding: number[] | null = null;
  const title = `${companyName} ${sourceType} changed`;

  try {
    embedding = await generateIntelligenceEmbedding(title, ai.summary, ai.summary);
  } catch (embedError) {
    console.error('Failed to generate embedding, continuing without it:', embedError);
  }

  const { error: intelligenceError } = await supabase
    .from('intelligence_items')
    .insert({
      user_id: source.user_id,
      company_id: source.competitor_id,
      source_id: source.id,
      change_id: change?.id,
      title,
      summary: ai.summary,
      strategic_insight: ai.summary,
      category: sourceType,
      topics: [companyName, sourceType],
      source_url: source.url,
      observed_at: new Date().toISOString(),
      confidence_score: 0.7,
      source_quality_score: 0.7,
      language: 'en',
      estimated_impact: ai.importance_score >= 4 ? 'high' : ai.importance_score >= 2 ? 'medium' : 'low',
      metadata: {
        importance_score: ai.importance_score || 3,
        previous_snapshot_id: latest.id,
        current_snapshot_id: snapshot?.id,
      },
      ...(embedding && { embedding }),
    });

  if (intelligenceError) {
    console.error('Intelligence item insert failed:', intelligenceError.message);
  }

  await updateSourceStatus(source.id, 'changed');

  const { data: user } = await supabase.auth.admin.getUserById(source.user_id);
  const email = user.user?.email;

  if (email) {
    const systemName = getCompetitorName(source);
    const changedSourceType = source.type || 'source';

    await sendAlert(
      email,
      `RivalSense database alert: ${systemName} ${changedSourceType} changed`,
      buildChangeEmail({
        system: systemName,
        sourceType: changedSourceType,
        sourceUrl: source.url,
        summary: ai.summary,
        diff,
      })
    );

    if (change?.id) {
      await supabase
        .from('changes')
        .update({
          emailed_at: new Date().toISOString(),
        })
        .eq('id', change.id);
    }
  }

  return {
    url: source.url,
    status: 'changed' as const,
    summary: ai.summary,
  };
}

export async function runSourceChecks(scope: CheckSourceScope = 'all'): Promise<RunSourceChecksResult> {
  const supabase = supabaseAdmin();
  const results: RunSourceChecksResult['results'] = [];

  for (let offset = 0; ; offset += PAGE_SIZE) {
    let query = supabase
      .from('monitored_sources')
      .select('*, competitors(name,is_system)')
      .eq('active', true)
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);

    if (scope === 'system') {
      query = query.eq('is_system', true);
    }

    const { data: sources, error } = await query;

    if (error) {
      throw error;
    }

    if (!sources || sources.length === 0) {
      break;
    }

    for (const source of sources) {
      try {
        const result = await processSource(source);
        results.push(result);
      } catch (e) {
        await updateSourceStatus(source.id, 'error');

        results.push({
          url: source.url,
          status: 'error',
          error: e instanceof Error ? e.message : String(e),
        });
      }
    }

    if (sources.length < PAGE_SIZE) {
      break;
    }
  }

  return {
    checked: results.length,
    results,
  };
}