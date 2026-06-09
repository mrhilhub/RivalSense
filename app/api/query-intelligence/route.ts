import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
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
};

type SerializedIntelligenceResult = {
  id: string;
  title: string;
  summary: string;
  strategic_insight: string | null;
  category: string;
  topics: string[];
  source_url: string | null;
  observed_at: string;
  confidence_score: number | null;
  company: string | null;
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

function fallbackAnswer(query: string, results: SerializedIntelligenceResult[]) {
  if (results.length === 0) {
    return `I could not find matching AI market intelligence for "${query}" yet. RivalSense will answer this once the background collection job captures relevant company changes.`;
  }

  const companies = Array.from(
    new Set(results.map((result) => result.company).filter(Boolean))
  ).slice(0, 4);

  return [
    `I found ${results.length} related intelligence item${results.length === 1 ? '' : 's'}${companies.length ? ` involving ${companies.join(', ')}` : ''}.`,
    results[0]?.strategic_insight || results[0]?.summary,
  ]
    .filter(Boolean)
    .join(' ');
}

function serializeResult(
  item: IntelligenceSearchRow,
  companyName?: string | null
): SerializedIntelligenceResult {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    strategic_insight: item.strategic_insight,
    category: item.category,
    topics: item.topics || [],
    source_url: item.source_url,
    observed_at: item.observed_at,
    confidence_score: item.confidence_score,
    company: companyName || null,
  };
}

async function generateAnswer(
  query: string,
  results: SerializedIntelligenceResult[]
) {
  if (!process.env.OPENAI_API_KEY || results.length === 0) {
    return fallbackAnswer(query, results);
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [
      {
        role: 'system',
        content:
          'Answer questions about AI company market intelligence. Use only the provided intelligence items. Be concise, cite company names and observed dates, and mention uncertainty when evidence is thin.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          question: query,
          intelligence_items: results.map((result) => ({
            title: result.title,
            company: result.company,
            category: result.category,
            observed_at: result.observed_at,
            summary: result.summary,
            strategic_insight: result.strategic_insight,
            topics: result.topics,
            source_url: result.source_url,
          })),
          instruction:
            'Return a direct answer in 2-4 sentences. Do not invent facts beyond the items.',
        }),
      },
    ],
  });

  return completion.choices[0]?.message?.content || fallbackAnswer(query, results);
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
      'id,title,summary,strategic_insight,category,topics,source_url,observed_at,confidence_score,company_id'
    )
    .eq('user_id', user.id)
    .or(filters.join(','))
    .order('observed_at', { ascending: false })
    .limit(limit);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = (data || []) as IntelligenceSearchRow[];
  const companyIds = Array.from(
    new Set(rows.map((item) => item.company_id).filter(Boolean) as string[])
  );
  const companiesById = new Map<string, string>();

  if (companyIds.length > 0) {
    const { data: companies, error: companiesError } = await supabase
      .from('competitors')
      .select('id,name')
      .eq('user_id', user.id)
      .in('id', companyIds);

    if (companiesError) {
      return NextResponse.json({ error: companiesError.message }, { status: 500 });
    }

    for (const company of companies || []) {
      companiesById.set(company.id as string, company.name as string);
    }
  }

  const results = rows.map((item) =>
    serializeResult(
      item,
      item.company_id ? companiesById.get(item.company_id) : null
    )
  );
  const answer = await generateAnswer(query, results);

  return NextResponse.json({ query, answer, results });
}
