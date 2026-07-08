import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { getSharedOwnerUserId } from '@/lib/sharedOwner';

export async function GET(req: NextRequest) {
  const userId = getSharedOwnerUserId(req.nextUrl.searchParams.get('user_id'));
  if (!userId) return NextResponse.json({ error: 'Missing user_id' }, { status: 400 });
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('changes').select('*, monitored_sources(url,type, competitors(name))').eq('user_id', userId).order('created_at', { ascending: false }).limit(50);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
