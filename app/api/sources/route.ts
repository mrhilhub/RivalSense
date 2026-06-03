import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const { user_id, competitor_id, type, url } = await req.json();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('monitored_sources').insert({ user_id, competitor_id, type, url }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
