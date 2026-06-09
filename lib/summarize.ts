import OpenAI from 'openai';

export type MarketIntelligenceSummary = {
  title: string;
  summary: string;
  strategic_insight: string;
  category: string;
  topics: string[];
  importance_score: number;
  confidence_score: number;
};

export async function summarizeChange(input: {
  company: string;
  sourceType: string;
  url: string;
  oldText: string;
  newText: string;
  diff: string;
}): Promise<MarketIntelligenceSummary> {
  if (!process.env.OPENAI_API_KEY) {
    return {
      title: `${input.company} changed ${input.sourceType}`,
      summary: 'Change detected. Add OPENAI_API_KEY to generate AI market intelligence summaries.',
      strategic_insight: 'RivalSense captured a source change, but AI insight generation is not configured yet.',
      category: input.sourceType || 'company_update',
      topics: [input.company, input.sourceType].filter(Boolean),
      importance_score: 3,
      confidence_score: 0.5,
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [{ role: 'system', content: 'You convert raw AI-company source changes into structured market intelligence for founders, product leaders, investors, and strategy teams. Focus on what changed, why it matters competitively, and how another LLM could use this record to answer user questions. Return JSON only.' }, { role: 'user', content: JSON.stringify({
      company: input.company,
      source_type: input.sourceType,
      url: input.url,
      diff: input.diff.slice(0, 12000),
      instruction: 'Return title, summary, strategic_insight, category, topics array, importance_score 1-5, confidence_score 0-1. Categories should be like pricing, product_launch, model_release, agents, partnerships, funding, policy, research, hiring, platform, developer_tools, or company_update.'
    }) }],
    response_format: { type: 'json_object' }
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  try {
    const parsed = JSON.parse(raw) as Partial<MarketIntelligenceSummary>;

    return {
      title: parsed.title || `${input.company} changed ${input.sourceType}`,
      summary: parsed.summary || raw.slice(0, 1000),
      strategic_insight:
        parsed.strategic_insight ||
        'This change may affect competitive positioning in the AI market.',
      category: parsed.category || input.sourceType || 'company_update',
      topics: Array.isArray(parsed.topics)
        ? parsed.topics.map(String).slice(0, 12)
        : [input.company, input.sourceType].filter(Boolean),
      importance_score: parsed.importance_score || 3,
      confidence_score: parsed.confidence_score || 0.7,
    };
  } catch {
    return {
      title: `${input.company} changed ${input.sourceType}`,
      summary: raw.slice(0, 1000),
      strategic_insight: 'This change may affect competitive positioning in the AI market.',
      category: input.sourceType || 'company_update',
      topics: [input.company, input.sourceType].filter(Boolean),
      importance_score: 3,
      confidence_score: 0.6,
    };
  }
}
