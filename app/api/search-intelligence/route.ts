import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { normalizeSummary } from '@/lib/ai';
import { generateEmbedding } from '@/lib/embeddings';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get('q');
    const matchCount = parseInt(searchParams.get('limit') || '20', 10);
    const useTextSearch = searchParams.get('text') === 'true';

    if (!query || query.trim().length === 0) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Get authenticated user from header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Extract token and verify with Supabase
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
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    let results = [];

    if (useTextSearch) {
      // Use full-text search
      const { data, error } = await supabase.rpc('search_intelligence_by_text', {
        p_user_id: user.id,
        p_query: query,
        p_limit: matchCount,
      });

      if (error) {
        console.error('Text search error:', error);
        return NextResponse.json(
          { error: error.message },
          { status: 500 }
        );
      }

      results = data || [];
    } else {
      // Use vector semantic search
      try {
        const queryEmbedding = await generateEmbedding(query);

        const { data, error } = await supabase.rpc(
          'search_intelligence_items',
          {
            query_embedding: queryEmbedding,
            match_count: matchCount,
          }
        );

        if (error) {
          console.error('Semantic search error:', error);
          // Fall back to text search if embedding search fails
          const { data: textData } = await supabase.rpc(
            'search_intelligence_by_text',
            {
              p_user_id: user.id,
              p_query: query,
              p_limit: matchCount,
            }
          );
          results = textData || [];
        } else {
          results = data || [];
        }
      } catch (embedError) {
        console.error('Embedding generation failed, falling back to text search:', embedError);
        const { data: textData } = await supabase.rpc(
          'search_intelligence_by_text',
          {
            p_user_id: user.id,
            p_query: query,
            p_limit: matchCount,
          }
        );
        results = textData || [];
      }
    }

    return NextResponse.json({
      query,
      results: results.map((item: Record<string, unknown>) => ({
        id: item.id,
        title: item.title,
        summary: normalizeSummary((item.summary as string | null | undefined) ?? null),
        strategic_insight: normalizeSummary((item.strategic_insight as string | null | undefined) ?? null),
        category: item.category,
        company_name: (item.company_name as string | null | undefined) || 'Unknown',
        observed_at: item.observed_at,
        confidence_score: item.confidence_score,
        source_url: item.source_url,
        similarity: item.similarity || null,
      })),
      count: results.length,
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Search failed' },
      { status: 500 }
    );
  }
}
