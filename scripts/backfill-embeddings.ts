#!/usr/bin/env node

/**
 * Backfill Script: Generate embeddings for existing intelligence_items
 * 
 * This script:
 * 1. Connects to Supabase
 * 2. Finds all intelligence_items without embeddings
 * 3. Generates embeddings using OpenAI
 * 4. Updates the database with embeddings
 * 
 * Usage:
 *   npx ts-node scripts/backfill-embeddings.ts [options]
 * 
 * Options:
 *   --limit N        Only process first N items (default: 100)
 *   --batch-size N   Process N items at a time (default: 10)
 *   --dry-run        Show what would be done without executing
 *   --user-id UUID   Only process items for specific user
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

interface IntelligenceItem {
  id: string;
  user_id: string;
  title: string;
  summary: string;
  strategic_insight: string | null;
  embedding: number[] | null;
}

async function main() {
  // Parse CLI arguments
  const args = process.argv.slice(2);
  const limit = parseInt(args[args.indexOf('--limit') + 1] || '100', 10);
  const batchSize = parseInt(args[args.indexOf('--batch-size') + 1] || '10', 10);
  const dryRun = args.includes('--dry-run');
  const userId = args[args.indexOf('--user-id') + 1];

  console.log('🚀 RivalSense Embedding Backfill');
  console.log('─'.repeat(50));
  console.log(`Limit: ${limit} items`);
  console.log(`Batch size: ${batchSize}`);
  console.log(`Dry run: ${dryRun}`);
  console.log(`User filter: ${userId || 'all users'}`);
  console.log('─'.repeat(50));

  // Initialize Supabase and OpenAI
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  if (!openaiKey) {
    console.error('❌ Missing OPENAI_API_KEY environment variable');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const openai = new OpenAI({ apiKey: openaiKey });

  // Fetch intelligence items without embeddings
  console.log('\n📥 Fetching intelligence items without embeddings...');

  let query = supabase
    .from('intelligence_items')
    .select('id, user_id, title, summary, strategic_insight, embedding')
    .is('embedding', null)
    .limit(limit);

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data: items, error } = await query;

  if (error) {
    console.error('❌ Failed to fetch items:', error.message);
    process.exit(1);
  }

  if (!items || items.length === 0) {
    console.log('✅ No items to backfill - all items have embeddings');
    process.exit(0);
  }

  console.log(`✅ Found ${items.length} items to process\n`);

  let processed = 0;
  let updated = 0;
  let failed = 0;

  // Process in batches
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`\n📦 Processing batch ${Math.floor(i / batchSize) + 1} (${batch.length} items)`);

    const embeddings = await generateEmbeddingsBatch(
      openai,
      batch.map((item) => `${item.title} | ${item.summary}`)
    );

    // Update items with embeddings
    for (let j = 0; j < batch.length; j++) {
      const item = batch[j] as IntelligenceItem;
      const embedding = embeddings[j];
      processed++;

      if (!embedding) {
        console.error(`   ❌ Failed to generate embedding for item ${item.id}`);
        failed++;
        continue;
      }

      if (dryRun) {
        console.log(`   [DRY RUN] Would update ${item.id} with embedding`);
        updated++;
        continue;
      }

      try {
        const { error: updateError } = await supabase
          .from('intelligence_items')
          .update({
            embedding: embedding,
          })
          .eq('id', item.id);

        if (updateError) {
          console.error(`   ❌ Failed to update ${item.id}:`, updateError.message);
          failed++;
        } else {
          console.log(`   ✅ Updated ${item.id}`);
          updated++;
        }
      } catch (e) {
        console.error(`   ❌ Error updating ${item.id}:`, e);
        failed++;
      }

      // Rate limiting: pause between requests
      if (j < batch.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    console.log(`   Batch complete: ${updated}/${processed} updated, ${failed} failed`);
  }

  // Final summary
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Backfill Summary');
  console.log('═'.repeat(50));
  console.log(`Total processed: ${processed}`);
  console.log(`Successfully updated: ${updated}`);
  console.log(`Failed: ${failed}`);
  console.log(`Success rate: ${((updated / processed) * 100).toFixed(1)}%`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made');
  } else {
    console.log('\n✨ Backfill complete!');
  }
}

async function generateEmbeddingsBatch(
  openai: OpenAI,
  texts: string[]
): Promise<(number[] | null)[]> {
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    });

    // Create a map of index to embedding
    const embeddingMap: Record<number, number[]> = {};
    response.data.forEach((item) => {
      embeddingMap[item.index] = item.embedding;
    });

    // Return embeddings in original order
    return texts.map((_, index) => embeddingMap[index] || null);
  } catch (error) {
    console.error('❌ OpenAI API error:', error);
    return texts.map(() => null);
  }
}

main().catch(console.error);
