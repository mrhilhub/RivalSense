import { diffWords } from 'diff';

export function makeDiffExcerpt(oldText: string, newText: string): string {
  const parts = diffWords(oldText.slice(0, 40000), newText.slice(0, 40000));
  const changed = parts.filter(p => p.added || p.removed).map(p => `${p.added ? '+' : '-'} ${p.value.trim()}`).join('\n');
  return changed.slice(0, 8000) || 'Content changed, but no compact word-level diff was produced.';
}
