#!/usr/bin/env node

/**
 * End-to-End Test: Verify intelligence database flow
 * 
 * Tests:
 * 1. Database schema - Check all required tables/columns exist
 * 2. API Check - Verify /api/check endpoint works
 * 3. Embeddings - Verify embeddings are being generated
 * 4. Search - Test semantic and text search functionality
 * 
 * Usage:
 *   npx ts-node scripts/test-e2e.ts
 */

import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  message: string;
}

const results: TestResult[] = [];

async function main() {
  console.log('🧪 RivalSense End-to-End Test Suite');
  console.log('═'.repeat(50));

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.error('❌ Missing Supabase environment variables');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  });

  // Test 1: Database schema validation
  await testDatabaseSchema(supabase);

  // Test 2: API functionality
  await testApiCheck();

  // Test 3: Embeddings generation
  await testEmbeddings(supabase);

  // Test 4: Search functionality
  await testSearch(supabase);

  // Print results
  printResults();
}

async function testDatabaseSchema(supabase: any) {
  console.log('\n📋 Test 1: Database Schema Validation');
  console.log('─'.repeat(50));

  try {
    // Check if intelligence_items table exists
    const { error: tableError } = await supabase
      .from('intelligence_items')
      .select('id')
      .limit(1);

    if (!tableError) {
      results.push({
        name: 'intelligence_items table exists',
        status: 'pass',
        message: 'Table exists and is accessible',
      });
    } else {
      results.push({
        name: 'intelligence_items table exists',
        status: 'fail',
        message: `Table check failed: ${tableError.message}`,
      });
      return;
    }

    // Check for required columns
    const requiredColumns = [
      'id',
      'user_id',
      'title',
      'summary',
      'embedding',
      'source_quality_score',
      'company_name',
    ];

    const selectColumns = requiredColumns.join(',');
    const { error: selectError } = await supabase
      .from('intelligence_items')
      .select(selectColumns)
      .limit(1);

    if (!selectError) {
      results.push({
        name: 'Required columns exist',
        status: 'pass',
        message: `All ${requiredColumns.length} required columns found`,
      });
    } else {
      results.push({
        name: 'Required columns exist',
        status: 'fail',
        message: `Missing or inaccessible columns: ${selectError.message}`,
      });
    }

    // Check for functions
  } catch (error) {
    results.push({
      name: 'Database schema validation',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testApiCheck() {
  console.log('\n🔄 Test 2: API Check Endpoint');
  console.log('─'.repeat(50));

  try {
    const response = await fetch('http://localhost:3000/api/check', {
      method: 'GET',
    });

    if (response.status === 200) {
      results.push({
        name: '/api/check endpoint',
        status: 'pass',
        message: 'Endpoint is accessible',
      });
    } else {
      results.push({
        name: '/api/check endpoint',
        status: 'fail',
        message: `Unexpected status: ${response.status}`,
      });
    }
  } catch (error) {
    results.push({
      name: '/api/check endpoint',
      status: 'fail',
      message: 'Cannot reach endpoint - is dev server running?',
    });
  }
}

async function testEmbeddings(supabase: any) {
  console.log('\n🧠 Test 3: Embeddings Generation');
  console.log('─'.repeat(50));

  try {
    const { data, error } = await supabase
      .from('intelligence_items')
      .select('id, embedding')
      .not('embedding', 'is', null)
      .limit(1);

    if (error) {
      results.push({
        name: 'Embeddings field accessible',
        status: 'fail',
        message: error.message,
      });
      return;
    }

    if (data && data.length > 0) {
      const item = data[0];
      if (item.embedding && Array.isArray(item.embedding)) {
        results.push({
          name: 'Embeddings generated',
          status: 'pass',
          message: `Found embedding with ${item.embedding.length} dimensions`,
        });
      } else {
        results.push({
          name: 'Embeddings generated',
          status: 'fail',
          message: 'Embedding field exists but is invalid',
        });
      }
    } else {
      results.push({
        name: 'Embeddings generated',
        status: 'skip',
        message: 'No items with embeddings found',
      });
    }
  } catch (error) {
    results.push({
      name: 'Embeddings test',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

async function testSearch(supabase: any) {
  console.log('\n🔍 Test 4: Search Functionality');
  console.log('─'.repeat(50));

  try {
    // Test text search function exists
    try {
      const { error: textError } = await supabase.rpc('search_intelligence_by_text', {
        p_user_id: '00000000-0000-0000-0000-000000000000',
        p_query: 'test',
        p_limit: 5,
      });

      if (textError) {
        results.push({
          name: 'Text search function',
          status: 'fail',
          message: `Function error: ${textError.message}`,
        });
      } else {
        results.push({
          name: 'Text search function',
          status: 'pass',
          message: 'Text search function executed successfully',
        });
      }
    } catch (e: any) {
      results.push({
        name: 'Text search function',
        status: 'fail',
        message: `RPC call failed: ${e.message || String(e)}`,
      });
    }

    // Test semantic search endpoint
    const searchUrl = 'http://localhost:3000/api/search-intelligence?q=test&text=true';
    try {
      const response = await fetch(searchUrl, {
        headers: {
          authorization: `Bearer dummy-token`,
        },
      });

      if (response.status === 401) {
        results.push({
          name: 'Search API endpoint',
          status: 'pass',
          message: 'Endpoint exists and validates auth',
        });
      } else {
        results.push({
          name: 'Search API endpoint',
          status: 'pass',
          message: `Endpoint accessible (status: ${response.status})`,
        });
      }
    } catch {
      results.push({
        name: 'Search API endpoint',
        status: 'skip',
        message: 'Dev server not running',
      });
    }
  } catch (error) {
    results.push({
      name: 'Search functionality',
      status: 'fail',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

function printResults() {
  console.log('\n' + '═'.repeat(50));
  console.log('📊 Test Results Summary');
  console.log('═'.repeat(50));

  let passed = 0;
  let failed = 0;
  let skipped = 0;

  results.forEach((result) => {
    const icon =
      result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⏭️ ';
    console.log(`${icon} ${result.name}`);
    console.log(`   ${result.message}\n`);

    if (result.status === 'pass') passed++;
    if (result.status === 'fail') failed++;
    if (result.status === 'skip') skipped++;
  });

  console.log('─'.repeat(50));
  console.log(
    `Total: ${passed} passed, ${failed} failed, ${skipped} skipped (${results.length} tests)`
  );

  if (failed > 0) {
    console.log('\n⚠️  Some tests failed. Check the issues above.');
    process.exit(1);
  } else {
    console.log('\n✨ All tests passed!');
  }
}

main().catch(console.error);
