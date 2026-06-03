import OpenAI from 'openai';

export async function summarizeChange(input: { url: string; oldText: string; newText: string; diff: string }) {
  if (!process.env.OPENAI_API_KEY) {
    return { summary: 'Change detected. Add OPENAI_API_KEY to generate AI summaries.', importance_score: 3 };
  }
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const completion = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    temperature: 0.2,
    messages: [{ role: 'system', content: 'You summarize competitor intelligence changes for AI product teams. Be concise and practical. Return JSON only.' }, { role: 'user', content: JSON.stringify({
      url: input.url,
      diff: input.diff.slice(0, 12000),
      instruction: 'Summarize what changed, why it matters, and assign importance_score 1-5.'
    }) }],
    response_format: { type: 'json_object' }
  });
  const raw = completion.choices[0]?.message?.content || '{}';
  try { return JSON.parse(raw) as { summary: string; importance_score: number }; }
  catch { return { summary: raw.slice(0, 1000), importance_score: 3 }; }
}
