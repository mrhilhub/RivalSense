import { NextRequest, NextResponse } from 'next/server';
import type { SourceType } from '@/lib/sourceTypes';

type SuggestedSource = {
  type: SourceType;
  url: string;
};

function normalizeWebsite(url?: string | null) {
  if (!url) return null;

  let value = url.trim();

  if (!value) return null;

  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = `https://${value}`;
  }

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function buildSuggestions(website: string | null): SuggestedSource[] {
  if (!website) return [];

  const parsed = new URL(website);
  const hostname = parsed.hostname.replace(/^www\./, '');
  const brand = hostname.split('.')[0];
  const root = `https://${hostname}`;

  return [
    {
      type: 'release',
      url: `${root}/releases`,
    },
    {
      type: 'incident',
      url: `${root}/status`,
    },
    {
      type: 'benchmark',
      url: `${root}/benchmarks`,
    },
    {
      type: 'pricing',
      url: `${root}/pricing`,
    },
    {
      type: 'docs',
      url: `https://docs.${hostname}`,
    },
    {
      type: 'changelog',
      url: `${root}/changelog`,
    },
    {
      type: 'github',
      url: `https://github.com/${brand}`,
    },
  ];
}

export async function POST(req: NextRequest) {
  try {
    const { website } = await req.json();

    const cleanWebsite = normalizeWebsite(website);
    const suggestions = buildSuggestions(cleanWebsite);

    return NextResponse.json({
      suggestions,
    });
  } catch {
    return NextResponse.json({
      suggestions: [],
    });
  }
}
