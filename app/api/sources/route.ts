import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { isSourceType } from '@/lib/sourceTypes';
import { getSharedOwnerUserId } from '@/lib/sharedOwner';

type SourceInput = {
  type: string;
  url: string;
};

function normalizeUrl(url: string) {
  let value = url.trim();

  if (!value) return '';

  if (!value.startsWith('http://') && !value.startsWith('https://')) {
    value = `https://${value}`;
  }

  return value;
}

function isValidUrl(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const { user_id, competitor_id } = body;
    const ownerUserId = getSharedOwnerUserId(user_id);

    if (!ownerUserId) {
      return NextResponse.json({ error: 'user_id required' }, { status: 400 });
    }

    if (!competitor_id) {
      return NextResponse.json(
        { error: 'competitor_id required' },
        { status: 400 }
      );
    }

    const rawSources: SourceInput[] = Array.isArray(body.sources)
      ? body.sources
      : [
          {
            type: body.type,
            url: body.url,
          },
        ];

    const sources = rawSources
      .map((source) => ({
        type: String(source.type || '').trim().toLowerCase(),
        url: normalizeUrl(String(source.url || '')),
      }))
      .filter((source) => source.type && source.url);

    if (sources.length === 0) {
      return NextResponse.json(
        { error: 'At least one source is required' },
        { status: 400 }
      );
    }

    const invalidType = sources.find((source) => !isSourceType(source.type));

    if (invalidType) {
      return NextResponse.json(
        { error: `Invalid source type: ${invalidType.type}` },
        { status: 400 }
      );
    }

    const invalidUrl = sources.find((source) => !isValidUrl(source.url));

    if (invalidUrl) {
      return NextResponse.json(
        { error: `Invalid URL: ${invalidUrl.url}` },
        { status: 400 }
      );
    }

    const supabase = supabaseAdmin();

    const rows = sources.map((source) => ({
      user_id: ownerUserId,
      competitor_id,
      type: source.type,
      url: source.url,
      active: true,
      last_status: 'not_checked',
    }));

    const { data, error } = await supabase
      .from('monitored_sources')
      .insert(rows)
      .select();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      created: data?.length || 0,
      sources: data || [],
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
    .from('monitored_sources')
    .select('*, competitors(name,is_system)')
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
    const { error } = await supabase
      .from('monitored_sources')
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
