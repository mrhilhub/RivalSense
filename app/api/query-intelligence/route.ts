import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

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
  competitors?: { name?: string | null } | { name?: string | null }[] | null;
};

function normalizeQuery(value: string) {
  return value.replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
}

function escapeIlike(value: string) {
  return value.replace(/[%_\\]/g, (char) => `\\${char}`);
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
    return competitors[0]?.name || null;
  }

  return competitors?.name || null;
}

export async function GET(req: NextRequest) {
  const query = normalizeQuery(req.nextUrl.searchParams.get('q') || '');
  const limit = Math.min(
    Math.max(Number(req.nextUrl.searchParams.get('limit') || 8), 1),
    20
  );
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!query) {
    return NextResponse.json({ results: [], query });
  }

  const supabase = supabaseAdmin();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const escaped = escapeIlike(query);
  const terms = queryTerms(query);
  const patterns = [escaped, ...terms.map(escapeIlike)];
  const filters = patterns.flatMap((term) => {
    const pattern = `%${term}%`;

    return [
      `title.ilike.${pattern}`,
      `summary.ilike.${pattern}`,
      `strategic_insight.ilike.${pattern}`,
      `category.ilike.${pattern}`,
      `source_url.ilike.${pattern}`,
    ];
  });

  const { data, error } = await supabase
    .from('intelligence_items')
    .select(
      'id,title,summary,strategic_insight,category,topics,source_url,observed_at,confidence_score,company_id,competitors(name)'
    )
    .eq('user_id', user.id)
    .or(filters.join(','))
    .order('observed_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = ((data || []) as IntelligenceSearchRow[]).map((item) => ({
    id: item.id,
    title: item.title,
    summary: item.summary,
    strategic_insight: item.strategic_insight,
    category: item.category,
    topics: item.topics || [],
    source_url: item.source_url,
    observed_at: item.observed_at,
    confidence_score: item.confidence_score,
    company: companyName(item.competitors),
  }));

  return NextResponse.json({ query, results });
}
