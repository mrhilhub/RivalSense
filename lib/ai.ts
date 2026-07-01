export interface SummaryResult {
  summary: string;
  importance_score: number;
}

export function normalizeSummary(summary: string | null | undefined): string {
  const cleaned = (summary || '').trim();
  if (!cleaned) {
    return 'A change was detected on this source. Review the latest content for product, pricing, or infrastructure impact.';
  }

  const placeholder = /add openai_api_key|openai_api_key/i;
  if (placeholder.test(cleaned)) {
    return 'A change was detected on this source. Review the latest content for product, pricing, or infrastructure impact.';
  }

  return cleaned;
}

function buildLocalSummary(input: { url: string; diff: string }): SummaryResult {
  const preview = input.diff.replace(/\s+/g, ' ').slice(0, 220).trim();
  const score = input.diff.length > 4000 ? 4 : input.diff.length > 1200 ? 3 : 2;

  return {
    summary: preview
      ? `Change detected at ${input.url}. Review the updated content for product, infrastructure, or pricing impact. Preview: ${preview}`
      : `Change detected at ${input.url}. Review the updated content for product, infrastructure, or pricing impact.`,
    importance_score: score,
  };
}

async function callGroqSummary(input: { url: string; diff: string }): Promise<SummaryResult | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
        temperature: 0.2,
        messages: [
          {
            role: 'system',
            content:
              'You summarize database intelligence changes for engineering, data, and platform teams. Focus on schema, migration, reliability, performance, release, pricing, and operational impact. Be concise and practical. Return JSON only.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              url: input.url,
              diff: input.diff.slice(0, 12000),
              instruction:
                'Summarize what changed, why it matters for database/platform decisions, and assign importance_score 1-5.',
            }),
          },
        ],
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const raw = payload.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw) as Partial<SummaryResult>;

    if (parsed.summary && typeof parsed.importance_score === 'number') {
      return {
        summary: parsed.summary,
        importance_score: parsed.importance_score,
      };
    }
  } catch (error) {
    console.warn('Groq summary request failed, falling back to local summary:', error);
  }

  return null;
}

export async function summarizeChange(input: { url: string; oldText: string; newText: string; diff: string }): Promise<SummaryResult> {
  const summary = await callGroqSummary({ url: input.url, diff: input.diff });
  if (summary) {
    return {
      ...summary,
      summary: normalizeSummary(summary.summary),
    };
  }

  const fallback = buildLocalSummary({ url: input.url, diff: input.diff });
  if (fallback.summary.includes('Add OPENAI_API_KEY')) {
    return {
      summary: `A tracked source changed at ${input.url}. Review the updated content for important product, documentation, pricing, or policy updates.`,
      importance_score: fallback.importance_score,
    };
  }

  return {
    ...fallback,
    summary: normalizeSummary(fallback.summary),
  };
}

function buildLocalEmbedding(text: string): number[] {
  const normalized = text.toLowerCase();
  const size = 1536;
  let hash = 2166136261;

  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  const seed = hash >>> 0;

  return Array.from({ length: size }, (_, index) => {
    const char = normalized[(index + (seed % normalized.length)) % normalized.length] || ' ';
    const charCode = char.charCodeAt(0) + 1;
    const wave = Math.sin((index + 1) * 0.7 + seed * 0.00001) * 0.5 + 0.5;
    const density = (charCode / 255) * 0.75 + (normalized.length % 11) / 110;
    return Number(((wave * 0.6 + density * 0.4 + ((seed >> (index % 8)) & 0x1) * 0.05) % 1).toFixed(6));
  });
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return buildLocalEmbedding(text);
}

export async function generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
  return texts.map((text) => buildLocalEmbedding(text));
}
