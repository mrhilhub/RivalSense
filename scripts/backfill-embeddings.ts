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
import { backfillIntelligenceEmbeddings } from '../lib/embeddings';

async function main() {
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

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  const result = await backfillIntelligenceEmbeddings(supabase, {
    limit,
    batchSize,
    dryRun,
    userId,
    log: (message) => console.log(message),
  });

  if (result.totalFound === 0) {
    console.log('✅ No items to backfill - all items have embeddings');
    process.exit(0);
  }

  console.log('\n' + '═'.repeat(50));
  console.log('📊 Backfill Summary');
  console.log('═'.repeat(50));
  console.log(`Total found: ${result.totalFound}`);
  console.log(`Total processed: ${result.processed}`);
  console.log(`Successfully updated: ${result.updated}`);
  console.log(`Failed: ${result.failed}`);
  console.log(`Success rate: ${result.processed > 0 ? ((result.updated / result.processed) * 100).toFixed(1) : '0.0'}%`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made');
  } else {
    console.log('\n✨ Backfill complete!');
  }
}

main().catch((error) => {
  console.error('❌ Backfill failed:', error);
  process.exit(1);
});
