import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const { user_id, name, website } = await req.json();
  const supabase = supabaseAdmin();
  const { data, error } = await supabase.from('competitors').insert({ user_id, name, website }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
