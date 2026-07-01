import type { SupabaseClient } from '@supabase/supabase-js';
import { generateEmbedding, generateEmbeddingBatch } from './ai';

export { generateEmbedding, generateEmbeddingBatch };

export interface BackfillEmbeddingsOptions {
  limit?: number;
  batchSize?: number;
  dryRun?: boolean;
  userId?: string;
  log?: (message: string) => void;
}

export interface BackfillEmbeddingsSummary {
  totalFound: number;
  processed: number;
  updated: number;
  failed: number;
  dryRun: boolean;
  failures: Array<{ id: string; error: string }>;
}


export function buildIntelligenceEmbeddingText(
  title: string,
  summary: string,
  strategicInsight?: string | null
): string {
  return [title, summary, strategicInsight]
    .filter(Boolean)
    .join(' | ');
}

/**
 * Generate embedding for intelligence item combining title + summary
 */
export async function generateIntelligenceEmbedding(
  title: string,
  summary: string,
  strategicInsight?: string
): Promise<number[]> {
  const combinedText = buildIntelligenceEmbeddingText(title, summary, strategicInsight);

  return generateEmbedding(combinedText);
}

export async function backfillIntelligenceEmbeddings(
  supabase: SupabaseClient,
  options: BackfillEmbeddingsOptions = {}
): Promise<BackfillEmbeddingsSummary> {
  const limit = Math.max(1, options.limit ?? 100);
  const batchSize = Math.max(1, options.batchSize ?? 10);
  const dryRun = Boolean(options.dryRun);
  const log = options.log ?? console.log;

  log('📥 Fetching intelligence items without embeddings...');

  let query = supabase
    .from('intelligence_items')
    .select('id, user_id, title, summary, strategic_insight, embedding')
    .is('embedding', null)
    .limit(limit);

  if (options.userId) {
    query = query.eq('user_id', options.userId);
  }

  const { data: items, error } = await query;

  if (error) {
    throw error;
  }

  if (!items || items.length === 0) {
    return {
      totalFound: 0,
      processed: 0,
      updated: 0,
      failed: 0,
      dryRun,
      failures: [],
    };
  }

  log(`✅ Found ${items.length} items to process`);

  let processed = 0;
  let updated = 0;
  let failed = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (let index = 0; index < items.length; index += batchSize) {
    const batch = items.slice(index, index + batchSize);
    log(`\n📦 Processing batch ${Math.floor(index / batchSize) + 1} (${batch.length} items)`);

    let embeddings: (number[] | null)[] = [];

    try {
      embeddings = await generateEmbeddingBatch(
        batch.map((item: { title: string; summary: string; strategic_insight?: string | null }) =>
          buildIntelligenceEmbeddingText(item.title, item.summary, item.strategic_insight)
        )
      );
    } catch (embeddingError) {
      const errorMessage = embeddingError instanceof Error ? embeddingError.message : String(embeddingError);
      log(`❌ Failed to generate batch embeddings: ${errorMessage}`);
      embeddings = batch.map(() => null);
    }

    for (let offset = 0; offset < batch.length; offset++) {
      const item = batch[offset];
      const embedding = embeddings[offset];
      processed += 1;

      if (!embedding) {
        failed += 1;
        const errorMessage = `Failed to generate embedding for item ${item.id}`;
        failures.push({ id: item.id, error: errorMessage });
        log(`   ❌ ${errorMessage}`);
        continue;
      }

      if (dryRun) {
        updated += 1;
        log(`   [DRY RUN] Would update ${item.id} with embedding`);
        continue;
      }

      try {
        const { error: updateError } = await supabase
          .from('intelligence_items')
          .update({ embedding })
          .eq('id', item.id);

        if (updateError) {
          failed += 1;
          const errorMessage = `Failed to update ${item.id}: ${updateError.message}`;
          failures.push({ id: item.id, error: errorMessage });
          log(`   ❌ ${errorMessage}`);
        } else {
          updated += 1;
          log(`   ✅ Updated ${item.id}`);
        }
      } catch (updateError) {
        failed += 1;
        const errorMessage = `Error updating ${item.id}: ${updateError}`;
        failures.push({ id: item.id, error: errorMessage });
        log(`   ❌ ${errorMessage}`);
      }
    }
  }

  return {
    totalFound: items.length,
    processed,
    updated,
    failed,
    dryRun,
    failures,
  };
}
