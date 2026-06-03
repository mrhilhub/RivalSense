import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

function normalizeWebsite(url?: string | null) {
  if (!url) return null;

  let value = url.trim();

  if (!value) return null;

  if (
    !value.startsWith('http://') &&
    !value.startsWith('https://')
  ) {
    value = `https://${value}`;
  }

  return value;
}

function buildSuggestedSources(website: string | null) {
  if (!website) return [];

  try {
    const hostname = new URL(website).hostname.replace(/^www\./, '');

    const root = `https://${hostname}`;

    return [
      {
        type: 'docs',
        url: `https://docs.${hostname}`,
      },
      {
        type: 'changelog',
        url: `${root}/changelog`,
      },
      {
        type: 'pricing',
        url: `${root}/pricing`,
      },
      {
        type: 'github',
        url: `https://github.com/${hostname.split('.')[0]}`,
      },
    ];
  } catch {
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { user_id, name, website } = await req.json();

    if (!user_id) {
      return NextResponse.json(
        { error: 'user_id required' },
        { status: 400 }
      );
    }

    if (!name?.trim()) {
      return NextResponse.json(
        { error: 'name required' },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const cleanWebsite = normalizeWebsite(website);

    const { data, error } = await supabase
      .from('competitors')
      .insert({
        user_id,
        name: name.trim(),
        website: cleanWebsite,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      competitor: data,
      suggested_sources: buildSuggestedSources(cleanWebsite),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
