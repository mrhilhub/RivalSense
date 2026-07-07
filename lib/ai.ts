export interface SummaryResult {
  summary: string;
  importance_score: number;
}

export interface SearchAnswerEvidence {
  company: string;
  title: string;
  summary: string;
  strategic_insight?: string | null;
  category: string;
  observed_at: string;
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
  const lines = input.diff
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('+') || line.startsWith('-'));

  const additions = lines
    .filter((line) => line.startsWith('+'))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.length > 8)
    .slice(0, 2);

  const removals = lines
    .filter((line) => line.startsWith('-'))
    .map((line) => line.slice(1).trim())
    .filter((line) => line.length > 8)
    .slice(0, 2);

  const preview = input.diff.replace(/\s+/g, ' ').slice(0, 220).trim();
  const score = input.diff.length > 4000 ? 4 : input.diff.length > 1200 ? 3 : 2;
  const changeDetails = [
    additions.length > 0 ? `Added: ${additions.join(' | ')}` : '',
    removals.length > 0 ? `Removed: ${removals.join(' | ')}` : '',
  ]
    .filter(Boolean)
    .join('. ');

  const summary = changeDetails
    ? `A tracked source changed at ${input.url}. ${changeDetails}.`
    : preview
      ? `Change detected at ${input.url}. Review the updated content for product, infrastructure, or pricing impact. Preview: ${preview}`
      : `Change detected at ${input.url}. Review the updated content for product, infrastructure, or pricing impact.`;

  return {
    summary,
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

function buildLocalSearchAnswer(input: {
  query: string;
  results: SearchAnswerEvidence[];
}): string {
  const topResults = input.results.slice(0, 3);
  const companies = Array.from(
    new Set(topResults.map((item) => item.company).filter((name) => name && name !== 'Unknown'))
  );

  const evidence = topResults
    .map((item) => item.strategic_insight || item.summary)
    .map((text) => normalizeSummary(text).replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const uniqueEvidence = Array.from(new Set(evidence));
  const opener = companies.length > 0
    ? `For "${input.query}", the clearest signals are coming from ${companies.join(', ')}.`
    : `For "${input.query}", RivalSense found ${input.results.length} relevant intelligence signals.`;
  const body = uniqueEvidence.slice(0, 2).join(' ');
  const closer = input.results.length > 3
    ? `There are ${input.results.length - 3} additional supporting items below.`
    : 'The evidence below supports this brief.';

  return [opener, body, closer].filter(Boolean).join(' ');
}

async function callGroqSearchAnswer(input: {
  query: string;
  results: SearchAnswerEvidence[];
}): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || input.results.length === 0) {
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
              'You write concise strategic answers for an AI market intelligence product. Respond like a strong chat assistant: 2-4 sentences, plain English, synthesized from the evidence, no bullets, no markdown, no hedging, no JSON wrapper text.',
          },
          {
            role: 'user',
            content: JSON.stringify({
              query: input.query,
              evidence: input.results.slice(0, 5).map((item) => ({
                company: item.company,
                title: item.title,
                category: item.category,
                observed_at: item.observed_at,
                summary: item.summary,
                strategic_insight: item.strategic_insight,
              })),
              instruction:
                'Answer the query directly using only this evidence. Combine overlapping items into one coherent brief and mention the most important companies or themes.',
            }),
          },
        ],
      }),
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const content = payload.choices?.[0]?.message?.content?.trim();
    return content || null;
  } catch (error) {
    console.warn('Groq search answer request failed, falling back to local answer:', error);
  }

  return null;
}

export async function generateSearchAnswer(input: {
  query: string;
  results: SearchAnswerEvidence[];
}): Promise<string> {
  const answer = await callGroqSearchAnswer(input);
  return answer || buildLocalSearchAnswer(input);
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
