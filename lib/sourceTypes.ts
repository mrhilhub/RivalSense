export const sourceTypes = [
  'schema',
  'migration',
  'incident',
  'performance',
  'benchmark',
  'release',
  'pricing',
  'docs',
  'changelog',
  'github',
  'website',
] as const;

export type SourceType = (typeof sourceTypes)[number];

export const sourceTypeLabels: Record<SourceType, string> = {
  schema: 'Schema',
  migration: 'Migration',
  incident: 'Incident',
  performance: 'Performance',
  benchmark: 'Benchmark',
  release: 'Release',
  pricing: 'Pricing',
  docs: 'Docs',
  changelog: 'Changelog',
  github: 'GitHub',
  website: 'Website',
};

export function isSourceType(value: string): value is SourceType {
  return sourceTypes.includes(value as SourceType);
}
