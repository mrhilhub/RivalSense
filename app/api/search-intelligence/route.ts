import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { fetchCleanText } from '@/lib/crawler';
import { makeDiffExcerpt } from '@/lib/diff';
import { normalizeSummary, summarizeChange } from '@/lib/ai';
import { generateEmbedding } from '@/lib/embeddings';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { defaultAiCompanies } from '@/lib/aiCompanyUniverse';

type IntelligenceSearchRow = {
  id: string;
  title: string;
  summary: string;
  strategic_insight: string | null;
  category: string;
  topics: string[] | null;
  source_url: string | null;
  observed_at: string;
  confidence_score: number | null;
  company_id: string | null;
  change_id: string | null;
  competitors?: { name?: string | null } | { name?: string | null }[] | null;
  similarity?: number | null;
};

type MonitoredSourceRow = {
  id: string;
  url: string;
  type: string;
  competitor_id: string | null;
  competitors?: { name?: string | null } | { name?: string | null }[] | null;
};

type SearchResult = {
  id: string;
  title: string;
  summary: string;
  strategic_insight: string | null;
  category: string;
  topics: string[];
  source_url?: string | null;
  observed_at: string;
  confidence_score?: number | null;
  company_name: string;
  similarity?: number | null;
};

function normalizeQuery(value: string) {
  return value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

function queryTerms(query: string) {
  const stopWords = new Set([
    'a',
    'about',
    'added',
    'are',
    'from',
    'have',
    'last',
    'new',
    'show',
    'the',
    'to',
    'what',
    'when',
    'which',
    'who',
    'why',
    'with',
  ]);

  return Array.from(
    new Set(
      query
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .map((term) => term.trim())
        .filter((term) => term.length > 2 && !stopWords.has(term))
    )
  ).slice(0, 8);
}

function companyName(competitors?: IntelligenceSearchRow['competitors']) {
  if (Array.isArray(competitors)) {
    return competitors[0]?.name || 'Unknown';
  }

  return competitors?.name || 'Unknown';
}

function isGenericSummary(value?: string | null) {
  const cleaned = (value || '').trim();

  if (!cleaned) {
    return true;
  }

  return [
    /add openai_api_key/i,
    /change was detected on this source/i,
    /a change was detected on this source/i,
    /review the latest content for product, pricing, or infrastructure impact/i,
    /review the updated content for product, infrastructure, or pricing impact/i,
  ].some((pattern) => pattern.test(cleaned));
}

function rankSource(query: string, source: MonitoredSourceRow) {
  const sourceText = `${source.url} ${source.type} ${companyName(source.competitors)}`.toLowerCase();
  return queryTerms(query).reduce((score, term) => score + (sourceText.includes(term) ? 1 : 0), 0);
}

async function enrichGenericResult(
  admin: ReturnType<typeof supabaseAdmin>,
  item: IntelligenceSearchRow,
  userId: string
): Promise<SearchResult> {
  const { data: source } = await admin
    .from('monitored_sources')
    .select('id,url,type,competitor_id,competitors(name)')
    .eq('user_id', userId)
    .eq('url', item.source_url || '')
    .maybeSingle();

  if (!source) {
    return {
      id: item.id,
      title: item.title,
      summary: normalizeSummary(item.summary),
      strategic_insight: normalizeSummary(item.strategic_insight),
      category: item.category,
      topics: item.topics || [],
      source_url: item.source_url,
      observed_at: item.observed_at,
      confidence_score: item.confidence_score,
      company_name: companyName(item.competitors),
      similarity: item.similarity || null,
    };
  }

  try {
    const currentText = await fetchCleanText(source.url);
    const { data: latestSnapshot } = await admin
      .from('snapshots')
      .select('raw_text')
      .eq('source_id', source.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const diff = makeDiffExcerpt(latestSnapshot?.raw_text || '', currentText);
    const ai = await summarizeChange({
      url: source.url,
      oldText: latestSnapshot?.raw_text || '',
      newText: currentText,
      diff,
    });

    const updatedSummary = normalizeSummary(ai.summary);

    await admin
      .from('intelligence_items')
      .update({
        summary: updatedSummary,
        strategic_insight: updatedSummary,
      })
      .eq('id', item.id);

    if (item.change_id) {
      await admin.from('changes').update({ summary: updatedSummary }).eq('id', item.change_id);
    }

    return {
      id: item.id,
      title: item.title,
      summary: updatedSummary,
      strategic_insight: updatedSummary,
      category: item.category,
      topics: item.topics || [],
      source_url: item.source_url,
      observed_at: item.observed_at,
      confidence_score: item.confidence_score,
      company_name: companyName(source.competitors),
      similarity: item.similarity || null,
    };
  } catch (error) {
    console.warn('Failed to refresh generic search result:', error);

    return {
      id: item.id,
      title: item.title,
      summary: normalizeSummary(item.summary),
      strategic_insight: normalizeSummary(item.strategic_insight),
      category: item.category,
      topics: item.topics || [],
      source_url: item.source_url,
      observed_at: item.observed_at,
      confidence_score: item.confidence_score,
      company_name: companyName(item.competitors),
      similarity: item.similarity || null,
    };
  }
}

async function liveSearchFallback(
  admin: ReturnType<typeof supabaseAdmin>,
  userId: string,
  query: string,
  limit: number
): Promise<SearchResult[]> {
  const { data: dbSources } = await admin
    .from('monitored_sources')
    .select('id,url,type,competitor_id,competitors(name)')
    .eq('user_id', userId)
    .eq('active', true);

  // Build candidate list: prefer DB sources, fall back to static universe
  let candidates: Array<{ source: MonitoredSourceRow; score: number }>;

  if (dbSources && dbSources.length > 0) {
    candidates = (dbSources as MonitoredSourceRow[])
      .map((source) => ({ source, score: rankSource(query, source) }))
      .sort((left, right) => right.score - left.score);
  } else {
    // No sources in DB yet — scrape from the static AI-company universe
    const terms = queryTerms(query);
    const staticSources: MonitoredSourceRow[] = defaultAiCompanies.flatMap((company) =>
      company.sources.map((s) => ({
        id: `static:${company.name}:${s.url}`,
        url: s.url,
        type: s.type,
        competitor_id: null,
        competitors: { name: company.name },
      }))
    );

    candidates = staticSources
      .map((source) => ({ source, score: rankSource(query, source) }))
      .filter(({ score }) => score > 0)
      .sort((left, right) => right.score - left.score);

    // If nothing matches, use pricing/release/changelog sources as a general fallback
    if (candidates.length === 0) {
      candidates = staticSources
        .filter((s) => ['pricing', 'release', 'changelog'].includes(s.type))
        .map((source) => ({ source, score: terms.length }));
    }
  }

  const results: SearchResult[] = [];

  for (const { source } of candidates.slice(0, Math.max(1, Math.min(3, limit)))) {
    try {
      const currentText = await fetchCleanText(source.url);
      const { data: latestSnapshot } = await admin
        .from('snapshots')
        .select('raw_text')
        .eq('source_id', source.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const diff = makeDiffExcerpt(latestSnapshot?.raw_text || '', currentText);
      const ai = await summarizeChange({
        url: source.url,
        oldText: latestSnapshot?.raw_text || '',
        newText: currentText,
        diff,
      });

      const sourceType = source.type || 'website';
      const company = companyName(source.competitors);

      results.push({
        id: `live:${source.id}`,
        title: `${company} ${sourceType} update`,
        summary: normalizeSummary(ai.summary),
        strategic_insight: normalizeSummary(ai.summary),
        category: sourceType,
        topics: [company, sourceType],
        source_url: source.url,
        observed_at: new Date().toISOString(),
        confidence_score: Math.min(0.85, 0.5 + ai.importance_score * 0.1),
        company_name: company,
        similarity: null,
      });
    } catch (fallbackError) {
      console.warn(`Live search fallback failed for ${source.url}:`, fallbackError);
    }

    if (results.length >= limit) {
      break;
    }
  }

  return results;
}

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = normalizeQuery(searchParams.get('q') || '');
    const matchCount = parseInt(searchParams.get('limit') || '20', 10);
    const useTextSearch = searchParams.get('text') === 'true';

    if (!query) {
      return NextResponse.json({ error: 'Query parameter is required' }, { status: 400 });
    }

    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
      {
        auth: { persistSession: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let results: IntelligenceSearchRow[] = [];

    if (useTextSearch) {
      const { data, error } = await supabase.rpc('search_intelligence_by_text', {
        p_user_id: user.id,
        p_query: query,
        p_limit: matchCount,
      });

      if (error) {
        console.error('Text search error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      results = (data || []) as IntelligenceSearchRow[];
    } else {
      try {
        const queryEmbedding = await generateEmbedding(query);
        const { data, error } = await supabase.rpc('search_intelligence_items', {
          query_embedding: queryEmbedding,
          match_count: matchCount,
        });

        if (error) {
          console.error('Semantic search error:', error);
          const { data: textData } = await supabase.rpc('search_intelligence_by_text', {
            p_user_id: user.id,
            p_query: query,
            p_limit: matchCount,
          });
          results = (textData || []) as IntelligenceSearchRow[];
        } else {
          results = (data || []) as IntelligenceSearchRow[];
        }
      } catch (embedError) {
        console.error('Embedding generation failed, falling back to text search:', embedError);
        const { data: textData } = await supabase.rpc('search_intelligence_by_text', {
          p_user_id: user.id,
          p_query: query,
          p_limit: matchCount,
        });
        results = (textData || []) as IntelligenceSearchRow[];
      }
    }

    const admin = supabaseAdmin();

    let finalResults: SearchResult[] = results.map((item) => ({
      id: item.id,
      title: item.title,
      summary: normalizeSummary(item.summary),
      strategic_insight: normalizeSummary(item.strategic_insight),
      category: item.category,
      topics: item.topics || [],
      source_url: item.source_url,
      observed_at: item.observed_at,
      confidence_score: item.confidence_score,
      company_name: companyName(item.competitors),
      similarity: item.similarity || null,
    }));

    const needsRefresh = finalResults.some((item) => isGenericSummary(item.summary) || isGenericSummary(item.strategic_insight));

    if (needsRefresh) {
      finalResults = await Promise.all(
        finalResults.map(async (item) => {
          if (!isGenericSummary(item.summary) && !isGenericSummary(item.strategic_insight)) {
            return item;
          }

          const sourceRow = results.find((candidate) => candidate.id === item.id);
          if (!sourceRow) {
            return item;
          }

          return enrichGenericResult(admin, sourceRow, user.id);
        })
      );
    }

    if (finalResults.length === 0) {
      finalResults = await liveSearchFallback(admin, user.id, query, matchCount);
    }

    return NextResponse.json({
      query,
      results: finalResults.map((item) => ({
        id: item.id,
        title: item.title,
        summary: item.summary,
        strategic_insight: item.strategic_insight,
        category: item.category,
        topics: item.topics || [],
        company_name: item.company_name,
        observed_at: item.observed_at,
        confidence_score: item.confidence_score,
        source_url: item.source_url,
        similarity: item.similarity || null,
      })),
      count: finalResults.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Search failed' }, { status: 500 });
  }
}
