import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSharedOwnerUserId } from '@/lib/sharedOwner';

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
    const ownerUserId = getSharedOwnerUserId(user_id);

    if (!ownerUserId) {
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
        user_id: ownerUserId,
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

export async function GET(req: NextRequest) {
  const ownerUserId = getSharedOwnerUserId(req.nextUrl.searchParams.get('user_id'));

  if (!ownerUserId) {
    return NextResponse.json({ error: 'user_id required' }, { status: 400 });
  }

  const supabase = supabaseAdmin();
  const { data, error } = await supabase
    .from('competitors')
    .select('id,name,website,is_system,created_at')
    .eq('user_id', ownerUserId)
    .order('created_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data || []);
}

export async function DELETE(req: NextRequest) {
  try {
    const { id, user_id } = await req.json();
    const ownerUserId = getSharedOwnerUserId(user_id);

    if (!ownerUserId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    if (!id) {
      return NextResponse.json({ error: 'id required' }, { status: 400 });
    }

    const supabase = supabaseAdmin();

    await supabase
      .from('monitored_sources')
      .delete()
      .eq('competitor_id', id)
      .eq('user_id', ownerUserId);

    const { error } = await supabase
      .from('competitors')
      .delete()
      .eq('id', id)
      .eq('user_id', ownerUserId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
