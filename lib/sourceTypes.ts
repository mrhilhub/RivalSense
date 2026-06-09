export const sourceTypes = [
  'pricing',
  'docs',
  'changelog',
  'github',
  'website',
  'release',
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const sourceTypeLabels: Record<SourceType, string> = {
  pricing: 'Pricing',
  docs: 'Docs',
  changelog: 'Changelog',
  github: 'GitHub',
  website: 'Website',
  release: 'Release',
};

export function isSourceType(value: string): value is SourceType {
  return sourceTypes.includes(value as SourceType);
}
