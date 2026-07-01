import assert from 'node:assert/strict';
import { backfillIntelligenceEmbeddings } from '../lib/embeddings';

async function main() {
  const mockSupabase = {
    from(table: string) {
      assert.equal(table, 'intelligence_items');
      return {
        select() {
          return {
            is() {
              return {
                limit() {
                  return Promise.resolve({
                    data: [
                      { id: '1', title: 'Alpha', summary: 'First item', strategic_insight: 'Insight', embedding: null },
                      { id: '2', title: 'Beta', summary: 'Second item', strategic_insight: null, embedding: null },
                    ],
                    error: null,
                  });
                },
              };
            },
          };
        },
      };
    },
  };

  const result = await backfillIntelligenceEmbeddings(mockSupabase as any, {
    limit: 2,
    batchSize: 2,
    dryRun: true,
    log: () => undefined,
  });

  assert.equal(result.totalFound, 2);
  assert.equal(result.processed, 2);
  assert.equal(result.updated, 2);
  assert.equal(result.failed, 0);
  assert.equal(result.dryRun, true);

  console.log('Backfill regression check passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
