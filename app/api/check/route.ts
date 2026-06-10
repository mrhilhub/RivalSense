import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { fetchCleanText, hashText } from '@/lib/crawler';
import { makeDiffExcerpt } from '@/lib/diff';
import { summarizeChange } from '@/lib/summarize';
import { sendAlert, buildChangeEmail } from '@/lib/email';

export const maxDuration = 60;

function escapeHtml(value: string) {
  return value.replace(/[<>&"]/g, (char) => {
    const entities: Record<string, string> = {
      '<': '&lt;',
      '>': '&gt;',
      '&': '&amp;',
      '"': '&quot;',
    };

    return entities[char] || char;
  });
}

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

function getCompanyName(source: { competitors?: { name?: string | null } | { name?: string | null }[] | null }) {
  if (Array.isArray(source.competitors)) {
    return source.competitors[0]?.name || 'AI company';
  }

  return source.competitors?.name || 'AI company';
}

export async function GET(req: NextRequest) {
  const supabase = supabaseAdmin();

  const { data: sources, error } = await supabase
    .from('monitored_sources')
    .select('*, competitors(name)')
    .eq('active', true)
    .limit(25);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];

  for (const source of sources || []) {
    try {
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

        results.push({
          url: source.url,
          status: 'baseline_created',
        });

        continue;
      }

      if (latest.content_hash === contentHash) {
        await updateSourceStatus(source.id, 'unchanged');

        results.push({
          url: source.url,
          status: 'unchanged',
        });

        continue;
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

      const { error: intelligenceError } = await supabase
        .from('intelligence_items')
        .insert({
          user_id: source.user_id,
          company_id: source.competitor_id,
          source_id: source.id,
          change_id: change?.id,
          title: `${companyName} ${sourceType} changed`,
          summary: ai.summary,
          strategic_insight: ai.summary,
          category: sourceType,
          topics: [companyName, sourceType],
          source_url: source.url,
          observed_at: new Date().toISOString(),
          confidence_score: 0.7,
          metadata: {
            importance_score: ai.importance_score || 3,
            previous_snapshot_id: latest.id,
            current_snapshot_id: snapshot?.id,
          },
        });

      if (intelligenceError) {
        console.error('Intelligence item insert failed:', intelligenceError.message);
      }

      await updateSourceStatus(source.id, 'changed');

      const { data: user } = await supabase.auth.admin.getUserById(
        source.user_id
      );

      const email = user.user?.email;

      if (email) {
        const systemName = source.competitors?.name || 'System';
        const sourceType = source.type || 'source';

        await sendAlert(
  email,
  `RivalSense database alert: ${systemName} ${sourceType} changed`,
  buildChangeEmail({
    system: systemName,
    sourceType,
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

      results.push({
        url: source.url,
        status: 'changed',
        summary: ai.summary,
      });
      
    } catch (e) {
      await updateSourceStatus(source.id, 'error');

      results.push({
        url: source.url,
        status: 'error',
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  return NextResponse.json({
    checked: results.length,
    results,
  });
}
