import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

type SourceRow = {
  id: string;
  url: string;
  type: string;
  last_checked_at: string | null;
  last_status: string | null;
  competitors?: { name?: string | null } | { name?: string | null }[] | null;
};

function previewText(text: string) {
  return text.replace(/\s+/g, ' ').trim().slice(0, 420);
}

function competitorName(
  competitors?: SourceRow['competitors']
) {
  if (Array.isArray(competitors)) {
    return competitors[0]?.name || 'Competitor';
  }

  return competitors?.name || 'Competitor';
}

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('user_id');

  if (!userId) {
    return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  }

  const supabase = supabaseAdmin();

  const { data: sourceRows, error } = await supabase
    .from('monitored_sources')
    .select('id,url,type,last_checked_at,last_status,competitors(name)')
    .eq('user_id', userId)
    .eq('active', true)
    .order('last_checked_at', { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const sources = (sourceRows || []) as SourceRow[];

  const intelligence = [];

  for (const source of sources) {
    const { data: snapshot } = await supabase
      .from('snapshots')
      .select('id,raw_text,created_at')
      .eq('source_id', source.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    intelligence.push({
      source_id: source.id,
      competitor: competitorName(source.competitors),
      type: source.type,
      url: source.url,
      last_checked_at: source.last_checked_at,
      last_status: source.last_status,
      snapshot_created_at: snapshot?.created_at || null,
      current_preview: snapshot?.raw_text
        ? previewText(snapshot.raw_text)
        : 'No snapshot captured yet. Run a check to create the first baseline.',
    });
  }

  return NextResponse.json(intelligence);
}
