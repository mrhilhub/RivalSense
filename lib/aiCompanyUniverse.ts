export type SeedSourceType =
  | 'website'
  | 'docs'
  | 'pricing'
  | 'changelog'
  | 'release'
  | 'incident'
  | 'github';

export type SeedTrackedSource = {
  type: SeedSourceType;
  url: string;
  legacyUrls?: string[];
};

export type SeedCompany = {
  name: string;
  website: string;
  sources: SeedTrackedSource[];
};

export const defaultAiCompanies: SeedCompany[] = [
  {
    name: 'OpenAI',
    website: 'https://developers.openai.com',
    sources: [
      { type: 'website', url: 'https://developers.openai.com', legacyUrls: ['https://openai.com'] },
      {
        type: 'docs',
        url: 'https://developers.openai.com/api/docs',
        legacyUrls: ['https://platform.openai.com/docs'],
      },
      {
        type: 'pricing',
        url: 'https://developers.openai.com/api/pricing',
        legacyUrls: ['https://openai.com/pricing'],
      },
      {
        type: 'changelog',
        url: 'https://developers.openai.com/changelog',
        legacyUrls: ['https://platform.openai.com/docs/changelog'],
      },
      {
        type: 'release',
        url: 'https://github.com/openai/openai-node/releases',
        legacyUrls: ['https://openai.com/index/'],
      },
      {
        type: 'incident',
        url: 'https://status.openai.com',
        legacyUrls: ['https://help.openai.com'],
      },
      { type: 'github', url: 'https://github.com/openai/openai-openapi', legacyUrls: ['https://github.com/openai'] },
    ],
  },
  {
    name: 'Anthropic',
    website: 'https://anthropic.com',
    sources: [
      { type: 'website', url: 'https://anthropic.com' },
      { type: 'docs', url: 'https://docs.anthropic.com/en/' },
      { type: 'pricing', url: 'https://www.anthropic.com/pricing' },
      { type: 'changelog', url: 'https://docs.anthropic.com/en/changelog' },
      { type: 'release', url: 'https://www.anthropic.com/news' },
      { type: 'docs', url: 'https://support.anthropic.com' },
    ],
  },
  {
    name: 'Google DeepMind',
    website: 'https://deepmind.google',
    sources: [
      { type: 'website', url: 'https://deepmind.google' },
      { type: 'release', url: 'https://deepmind.google/discover/blog/' },
      { type: 'docs', url: 'https://ai.google.dev' },
      { type: 'docs', url: 'https://developers.generativeai.google' },
      { type: 'release', url: 'https://blog.google/technology/ai/' },
    ],
  },
  {
    name: 'Mistral',
    website: 'https://mistral.ai',
    sources: [
      { type: 'website', url: 'https://mistral.ai' },
      { type: 'docs', url: 'https://docs.mistral.ai' },
      { type: 'pricing', url: 'https://mistral.ai/pricing' },
      { type: 'release', url: 'https://mistral.ai/news/' },
      { type: 'docs', url: 'https://console.mistral.ai' },
      { type: 'incident', url: 'https://status.mistral.ai' },
    ],
  },
  {
    name: 'Cohere',
    website: 'https://cohere.com',
    sources: [
      { type: 'website', url: 'https://cohere.com' },
      { type: 'docs', url: 'https://docs.cohere.com' },
      { type: 'pricing', url: 'https://cohere.com/pricing' },
      { type: 'release', url: 'https://cohere.com/blog' },
      { type: 'docs', url: 'https://dashboard.cohere.com' },
      { type: 'incident', url: 'https://status.cohere.com' },
    ],
  },
  {
    name: 'xAI',
    website: 'https://x.ai',
    sources: [
      { type: 'website', url: 'https://x.ai' },
      { type: 'release', url: 'https://x.ai/news' },
      { type: 'docs', url: 'https://x.ai/api' },
      { type: 'github', url: 'https://github.com/xai-org' },
    ],
  },
  {
    name: 'Perplexity',
    website: 'https://perplexity.ai',
    sources: [
      { type: 'website', url: 'https://perplexity.ai' },
      { type: 'release', url: 'https://www.perplexity.ai/hub/blog' },
      { type: 'docs', url: 'https://docs.perplexity.ai' },
      { type: 'pricing', url: 'https://www.perplexity.ai/pro' },
      { type: 'docs', url: 'https://www.perplexity.ai/hub/help-center' },
      { type: 'incident', url: 'https://status.perplexity.ai' },
    ],
  },
  {
    name: 'Meta AI',
    website: 'https://ai.meta.com',
    sources: [
      { type: 'website', url: 'https://ai.meta.com' },
      { type: 'release', url: 'https://ai.meta.com/blog' },
      { type: 'github', url: 'https://github.com/facebookresearch' },
      { type: 'docs', url: 'https://llama.meta.com' },
      { type: 'release', url: 'https://developers.facebook.com/blog/category/ai/' },
    ],
  },
  {
    name: 'Hugging Face',
    website: 'https://huggingface.co',
    sources: [
      { type: 'website', url: 'https://huggingface.co' },
      { type: 'docs', url: 'https://huggingface.co/docs' },
      { type: 'pricing', url: 'https://huggingface.co/pricing' },
      { type: 'release', url: 'https://huggingface.co/blog' },
      { type: 'github', url: 'https://github.com/huggingface' },
      { type: 'incident', url: 'https://status.huggingface.co' },
    ],
  },
  {
    name: 'Stability AI',
    website: 'https://stability.ai',
    sources: [
      { type: 'website', url: 'https://stability.ai' },
      { type: 'docs', url: 'https://platform.stability.ai/docs' },
      { type: 'pricing', url: 'https://platform.stability.ai/pricing' },
      { type: 'release', url: 'https://stability.ai/news' },
      { type: 'docs', url: 'https://platform.stability.ai' },
      { type: 'incident', url: 'https://status.stability.ai' },
    ],
  },
  {
    name: 'DeepSeek',
    website: 'https://www.deepseek.com',
    sources: [
      { type: 'website', url: 'https://www.deepseek.com' },
      { type: 'docs', url: 'https://api-docs.deepseek.com' },
      { type: 'pricing', url: 'https://www.deepseek.com/pricing' },
      { type: 'release', url: 'https://www.deepseek.com' },
    ],
  },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function matchesDefaultCompany(name: string, website?: string | null) {
  const normalizedName = normalize(name);
  const normalizedWebsite = website ? normalize(website).replace(/^https?:\/\//, '') : '';

  return defaultAiCompanies.some((company) => {
    const companyWebsite = normalize(company.website).replace(/^https?:\/\//, '');

    return (
      normalize(company.name) === normalizedName ||
      (normalizedWebsite.length > 0 && companyWebsite === normalizedWebsite)
    );
  });
}

export function getDefaultCompanyByName(name: string) {
  return defaultAiCompanies.find((company) => normalize(company.name) === normalize(name)) || null;
}