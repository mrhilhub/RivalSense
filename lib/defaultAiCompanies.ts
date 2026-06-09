export type DefaultAiCompany = {
  name: string;
  website: string;
  sources: Array<{
    type: 'website' | 'pricing' | 'docs' | 'changelog' | 'github' | 'release';
    url: string;
  }>;
};

export const defaultAiCompanies: DefaultAiCompany[] = [
  {
    name: 'OpenAI',
    website: 'https://openai.com',
    sources: [
      { type: 'website', url: 'https://openai.com/news' },
      { type: 'pricing', url: 'https://openai.com/api/pricing' },
      { type: 'docs', url: 'https://platform.openai.com/docs' },
      { type: 'changelog', url: 'https://platform.openai.com/docs/changelog' },
      { type: 'github', url: 'https://github.com/openai' },
    ],
  },
  {
    name: 'Anthropic',
    website: 'https://anthropic.com',
    sources: [
      { type: 'website', url: 'https://www.anthropic.com/news' },
      { type: 'pricing', url: 'https://www.anthropic.com/pricing' },
      { type: 'docs', url: 'https://docs.anthropic.com' },
      { type: 'changelog', url: 'https://docs.anthropic.com/en/release-notes' },
    ],
  },
  {
    name: 'Google DeepMind',
    website: 'https://deepmind.google',
    sources: [
      { type: 'website', url: 'https://deepmind.google/discover/blog' },
      { type: 'release', url: 'https://deepmind.google/technologies' },
      { type: 'github', url: 'https://github.com/google-deepmind' },
    ],
  },
  {
    name: 'Perplexity',
    website: 'https://perplexity.ai',
    sources: [
      { type: 'website', url: 'https://www.perplexity.ai/hub/blog' },
      { type: 'pricing', url: 'https://www.perplexity.ai/pro' },
      { type: 'docs', url: 'https://docs.perplexity.ai' },
    ],
  },
  {
    name: 'Mistral AI',
    website: 'https://mistral.ai',
    sources: [
      { type: 'website', url: 'https://mistral.ai/news' },
      { type: 'pricing', url: 'https://mistral.ai/products/la-plateforme#pricing' },
      { type: 'docs', url: 'https://docs.mistral.ai' },
      { type: 'github', url: 'https://github.com/mistralai' },
    ],
  },
  {
    name: 'Cohere',
    website: 'https://cohere.com',
    sources: [
      { type: 'website', url: 'https://cohere.com/blog' },
      { type: 'pricing', url: 'https://cohere.com/pricing' },
      { type: 'docs', url: 'https://docs.cohere.com' },
      { type: 'github', url: 'https://github.com/cohere-ai' },
    ],
  },
  {
    name: 'xAI',
    website: 'https://x.ai',
    sources: [
      { type: 'website', url: 'https://x.ai/news' },
      { type: 'docs', url: 'https://docs.x.ai' },
      { type: 'pricing', url: 'https://x.ai/api' },
    ],
  },
];
