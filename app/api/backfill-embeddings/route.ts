import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { backfillIntelligenceEmbeddings } from '@/lib/embeddings';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const limit = parseInt(body.limit || '100', 10);
    const batchSize = parseInt(body.batchSize || '10', 10);
    const dryRun = Boolean(body.dryRun);
    const userId = body.userId || null;

    const supabase = supabaseAdmin();

    const result = await backfillIntelligenceEmbeddings(supabase, {
      limit,
      batchSize,
      dryRun,
      userId,
      log: () => undefined,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Backfill embeddings API failed:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Backfill failed',
      },
      { status: 500 }
    );
  }
}
