import OpenAI from 'openai';

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    if (response.data && response.data.length > 0) {
      return response.data[0].embedding;
    }

    throw new Error('No embedding returned from OpenAI');
  } catch (error) {
    console.error('Failed to generate embedding:', error);
    throw error;
  }
}

export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: texts,
      encoding_format: 'float',
    });

    if (response.data) {
      // Sort by index to ensure correct order
      const sorted = response.data.sort((a, b) => a.index - b.index);
      return sorted.map((item) => item.embedding);
    }

    throw new Error('No embeddings returned from OpenAI');
  } catch (error) {
    console.error('Failed to generate embeddings batch:', error);
    throw error;
  }
}

/**
 * Generate embedding for intelligence item combining title + summary
 */
export async function generateIntelligenceEmbedding(
  title: string,
  summary: string,
  strategicInsight?: string
): Promise<number[]> {
  const combinedText = [title, summary, strategicInsight]
    .filter(Boolean)
    .join(' | ');

  return generateEmbedding(combinedText);
}
