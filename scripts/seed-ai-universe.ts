#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { bootstrapAiUniverseForUser } from '../lib/bootstrapAiUniverse';

async function main() {
  const args = process.argv.slice(2);
  const userIdIndex = args.indexOf('--user-id');
  const dryRun = args.includes('--dry-run');

  const userId = userIdIndex >= 0 ? args[userIdIndex + 1] : undefined;

  if (!userId) {
    console.error('❌ Missing --user-id <uuid>');
    process.exit(1);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase: any = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  console.log('🚀 RivalSense AI Universe Seed');
  console.log('─'.repeat(50));
  console.log(`User: ${userId}`);
  console.log(`Dry run: ${dryRun}`);
  console.log('Historical intelligence: enabled');
  console.log('─'.repeat(50));

  const result = await bootstrapAiUniverseForUser(supabase, userId, {
    dryRun,
    seedHistorical: true,
    log: (message) => console.log(message),
  });

  console.log('═'.repeat(50));
  console.log('📊 Seed Summary');
  console.log('═'.repeat(50));
  console.log(`Companies touched: ${result.createdCompanies}`);
  console.log(`Sources added: ${result.createdSources}`);
  console.log(`Historic items added: ${result.createdHistoricalItems}`);

  if (dryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made');
  } else {
    console.log('\n✨ AI universe seed complete!');
  }
}

main().catch((error) => {
  console.error('❌ AI universe seed failed:', error);
  process.exit(1);
});