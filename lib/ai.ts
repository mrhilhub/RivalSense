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

type SearchIntent = 'pricing' | 'release' | 'incident' | 'docs' | 'github' | 'general';

type ChatRole = 'system' | 'user' | 'assistant';

type ChatMessage = {
  role: ChatRole;
  content: string;
};

type LlmConfig = {
  apiKey: string;
  baseUrl: string;
  model: string;
  providerLabel: string;
};

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '');
}

function resolveLlmConfig(): LlmConfig | null {
  const unifiedKey = process.env.LLM_API_KEY || process.env.AI_API_KEY;
  const unifiedBase = process.env.LLM_BASE_URL || process.env.AI_BASE_URL;
  const unifiedModel = process.env.LLM_MODEL || process.env.AI_MODEL;

  if (unifiedKey) {
    return {
      apiKey: unifiedKey,
      baseUrl: normalizeBaseUrl(unifiedBase || 'https://api.openai.com/v1'),
      model: unifiedModel || 'gpt-4o-mini',
      providerLabel: 'configured-llm',
    };
  }

  if (process.env.GROQ_API_KEY) {
    return {
      apiKey: process.env.GROQ_API_KEY,
      baseUrl: 'https://api.groq.com/openai/v1',
      model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile',
      providerLabel: 'groq',
    };
  }

  return null;
}

async function callChatCompletion(input: {
  messages: ChatMessage[];
  temperature?: number;
  responseFormat?: { type: 'json_object' };
}): Promise<string | null> {
  const config = resolveLlmConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`,
      },
      body: JSON.stringify({
        model: config.model,
        temperature: input.temperature ?? 0.2,
        messages: input.messages,
        ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown LLM error');
      console.warn(`LLM request failed (${config.providerLabel}):`, errorText.slice(0, 500));
      return null;
    }

    const payload = (await response.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    return payload.choices?.[0]?.message?.content?.trim() || null;
  } catch (error) {
    console.warn('LLM request failed, using local fallback:', error);
  }

  return null;
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
  try {
    const raw = await callChatCompletion({
      temperature: 0.2,
      responseFormat: { type: 'json_object' },
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
    });

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SummaryResult>;

    if (parsed.summary && typeof parsed.importance_score === 'number') {
      return {
        summary: parsed.summary,
        importance_score: parsed.importance_score,
      };
    }
  } catch (error) {
    console.warn('LLM summary request failed, falling back to local summary:', error);
  }

  return null;
}

function buildCompanyRollup(results: SearchAnswerEvidence[]) {
  const counts = new Map<string, number>();

  for (const result of results) {
    const company = result.company && result.company !== 'Unknown' ? result.company : 'Unknown';
    counts.set(company, (counts.get(company) || 0) + 1);
  }

  return Array.from(counts.entries())
    .filter(([company]) => company !== 'Unknown')
    .map(([company, count]) => ({ company, count }))
    .sort((left, right) => right.count - left.count || left.company.localeCompare(right.company));
}

function formatCompanyRollup(companies: Array<{ company: string; count: number }>, limit = 5) {
  const slice = companies.slice(0, limit);

  if (slice.length === 0) {
    return '';
  }

  return slice.map((entry) => `${entry.company} (${entry.count})`).join(', ');
}

function inferSearchIntent(query: string): SearchIntent {
  const normalized = query.toLowerCase();

  if (/price|pricing|cost|plan|billing/.test(normalized)) return 'pricing';
  if (/incident|outage|downtime|reliability|status/.test(normalized)) return 'incident';
  if (/launch|release|ship|announce|announcement|news/.test(normalized)) return 'release';
  if (/docs|documentation|api|schema|migration/.test(normalized)) return 'docs';
  if (/github|repo|sdk|package|library/.test(normalized)) return 'github';
  return 'general';
}

function categoryMatchesIntent(category: string, intent: SearchIntent) {
  if (intent === 'general') {
    return false;
  }

  if (intent === 'release') {
    return ['release', 'changelog', 'website'].includes(category);
  }

  if (intent === 'docs') {
    return ['docs', 'changelog'].includes(category);
  }

  return category === intent;
}

function extractClaim(item: SearchAnswerEvidence) {
  const raw = normalizeSummary(item.strategic_insight || item.summary)
    .replace(/A tracked source changed at https?:\/\/\S+\.\s*/gi, '')
    .replace(/Change detected at https?:\/\/\S+\.\s*/gi, '')
    .replace(/Review the updated content for[^.]*\.?/gi, '')
    .replace(/Review the latest content for[^.]*\.?/gi, '')
    .replace(/Preview:\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!raw) {
    return '';
  }

  const capitalized = raw.charAt(0).toUpperCase() + raw.slice(1);
  return capitalized.endsWith('.') ? capitalized : `${capitalized}.`;
}

function evidenceScore(query: string, item: SearchAnswerEvidence, index: number) {
  const intent = inferSearchIntent(query);
  const claim = extractClaim(item).toLowerCase();
  const normalizedQuery = query.toLowerCase();
  const terms = normalizedQuery.split(/[^a-z0-9]+/).filter((term) => term.length > 2);

  let score = 0;
  if (categoryMatchesIntent(item.category, intent)) score += 4;
  if (item.strategic_insight) score += 2;
  if (item.company && item.company !== 'Unknown') score += 1;
  score += Math.max(0, 3 - index);

  score += terms.reduce((sum, term) => sum + (claim.includes(term) ? 1 : 0), 0);

  return score;
}

function selectEvidenceForAnswer(query: string, results: SearchAnswerEvidence[]) {
  const ranked = results
    .map((item, index) => ({ item, index, score: evidenceScore(query, item, index) }))
    .sort((left, right) => right.score - left.score);

  const selected: SearchAnswerEvidence[] = [];
  const seenCompanies = new Set<string>();
  const seenClaims = new Set<string>();

  for (const entry of ranked) {
    const claim = extractClaim(entry.item);
    const company = entry.item.company || 'Unknown';

    if (!claim || seenClaims.has(claim)) {
      continue;
    }

    if (selected.length === 0 || !seenCompanies.has(company)) {
      selected.push(entry.item);
      seenCompanies.add(company);
      seenClaims.add(claim);
      continue;
    }

    if (selected.length < 3 && selected.every((existing) => (existing.company || 'Unknown') === company)) {
      selected.push(entry.item);
      seenCompanies.add(company);
      seenClaims.add(claim);
    }

    if (selected.length === 3) {
      break;
    }
  }

  return selected.length > 0 ? selected : results.slice(0, 3);
}

function buildLeadSentence(
  query: string,
  intent: SearchIntent,
  companies: string[],
  resultCount: number,
  companyRollup: Array<{ company: string; count: number }>,
  totalResults: number
) {
  const companyList = companies.length > 0 ? companies.join(', ') : 'the tracked companies';
  const rollupLabel = formatCompanyRollup(companyRollup);
  const hasMultipleCompanies = companyRollup.length > 1;

  switch (intent) {
    case 'pricing':
      return hasMultipleCompanies
        ? `I found ${totalResults} pricing-related updates across ${companyRollup.length} companies: ${rollupLabel}.`
        : `On pricing, the strongest current signals come from ${companyList}.`;
    case 'incident':
      return hasMultipleCompanies
        ? `I found ${totalResults} reliability or incident updates across ${companyRollup.length} companies: ${rollupLabel}.`
        : `On reliability and incident risk, the clearest current signals come from ${companyList}.`;
    case 'release':
      return hasMultipleCompanies
        ? `I found ${totalResults} launch or release updates across ${companyRollup.length} companies: ${rollupLabel}.`
        : `On launches and releases, the strongest current signals come from ${companyList}.`;
    case 'docs':
      return hasMultipleCompanies
        ? `I found ${totalResults} documentation or API updates across ${companyRollup.length} companies: ${rollupLabel}.`
        : `On documentation and API changes, the clearest current signals come from ${companyList}.`;
    case 'github':
      return hasMultipleCompanies
        ? `I found ${totalResults} GitHub or SDK updates across ${companyRollup.length} companies: ${rollupLabel}.`
        : `On SDK and repository activity, the clearest current signals come from ${companyList}.`;
    default:
      if (hasMultipleCompanies) {
        return `I found ${totalResults} relevant updates across ${companyRollup.length} companies: ${rollupLabel}.`;
      }

      return companies.length > 0
        ? `For "${query}", the strongest current signals come from ${companyList}.`
        : `For "${query}", RivalSense found ${resultCount} relevant intelligence signals.`;
  }
}

function buildEvidenceSentence(claims: string[]) {
  if (claims.length === 0) {
    return '';
  }

  if (claims.length === 1) {
    return claims[0];
  }

  const [first, second, third] = claims;
  const pieces = [first, second, third].filter(Boolean);
  return pieces.join(' ');
}

function buildLocalSearchAnswer(input: {
  query: string;
  results: SearchAnswerEvidence[];
}): string {
  const intent = inferSearchIntent(input.query);
  const selectedEvidence = selectEvidenceForAnswer(input.query, input.results);
  const companyRollup = buildCompanyRollup(input.results);
  const companies = companyRollup.map((entry) => entry.company);

  const claims = selectedEvidence
    .map((item) => extractClaim(item))
    .filter(Boolean) as string[];

  const lead = buildLeadSentence(
    input.query,
    intent,
    companies,
    claims.length || input.results.length,
    companyRollup,
    input.results.length
  );
  const evidenceSentence = buildEvidenceSentence(claims);
  const scopeSentence =
    input.results.length > selectedEvidence.length
      ? `This answer is based on the strongest ${selectedEvidence.length} signals, with more supporting evidence listed below.`
      : 'This answer is based on the strongest available evidence in the results below.';

  return [lead, evidenceSentence, scopeSentence]
    .filter(Boolean)
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function callGroqSearchAnswer(input: {
  query: string;
  results: SearchAnswerEvidence[];
}): Promise<string | null> {
  if (input.results.length === 0) {
    return null;
  }

  try {
    const companyRollup = buildCompanyRollup(input.results);
    const evidence = selectEvidenceForAnswer(input.query, input.results).slice(0, 6);

    return await callChatCompletion({
      temperature: 0.2,
      messages: [
        {
          role: 'system',
          content:
            'You write concise strategic answers for an AI market intelligence product. Respond like a strong chat assistant. Start with the direct answer, then synthesize the strongest supporting signals into one coherent brief. If the query is broad or the evidence spans multiple companies, summarize the spread across companies and include counts. Use 3-4 sentences, plain English, no bullets, no markdown, no hedging, and do not repeat evidence verbatim.',
        },
        {
          role: 'user',
          content: JSON.stringify({
            query: input.query,
            company_rollup: companyRollup,
            evidence: evidence.map((item) => ({
              company: item.company,
              title: item.title,
              category: item.category,
              observed_at: item.observed_at,
              summary: item.summary,
              strategic_insight: item.strategic_insight,
            })),
            instruction:
              'Answer the query directly using only this evidence. If the query is broad or the evidence spans multiple companies, summarize the spread across companies and include counts. Do not collapse the response into a single company unless the evidence truly only supports one company. Prioritize the most recent and relevant signals, collapse duplicates, and make the answer feel like one polished analyst response rather than stitched snippets.',
          }),
        },
      ],
    });
  } catch (error) {
    console.warn('LLM search answer request failed, falling back to local answer:', error);
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
