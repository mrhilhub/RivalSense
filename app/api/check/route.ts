import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseServer';
import { fetchCleanText, hashText } from '@/lib/crawler';
import { makeDiffExcerpt } from '@/lib/diff';
import { summarizeChange } from '@/lib/summarize';
import { sendAlert } from '@/lib/email';

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = supabaseAdmin();
  const { data: sources, error } = await supabase.from('monitored_sources').select('*, competitors(name)').eq('active', true).limit(25);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = [];
  for (const source of sources || []) {
    try {
      const text = await fetchCleanText(source.url);
      const contentHash = hashText(text);
      const { data: latest } = await supabase.from('snapshots').select('*').eq('source_id', source.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      await supabase.from('monitored_sources').update({ last_checked_at: new Date().toISOString() }).eq('id', source.id);

      if (!latest) {
        await supabase.from('snapshots').insert({ source_id: source.id, content_hash: contentHash, raw_text: text });
        results.push({ url: source.url, status: 'baseline_created' });
        continue;
      }
      if (latest.content_hash === contentHash) {
        results.push({ url: source.url, status: 'unchanged' });
        continue;
      }

      const { data: snapshot } = await supabase.from('snapshots').insert({ source_id: source.id, content_hash: contentHash, raw_text: text }).select().single();
      const diff = makeDiffExcerpt(latest.raw_text, text);
      const ai = await summarizeChange({ url: source.url, oldText: latest.raw_text, newText: text, diff });
      const { data: change } = await supabase.from('changes').insert({
        source_id: source.id,
        user_id: source.user_id,
        previous_snapshot_id: latest.id,
        current_snapshot_id: snapshot?.id,
        summary: ai.summary,
        importance_score: ai.importance_score || 3,
        diff_excerpt: diff
      }).select().single();

      const { data: user } = await supabase.auth.admin.getUserById(source.user_id);
      const email = user.user?.email;
      if (email) {
        await sendAlert(email, `Competitor change: ${source.competitors?.name || source.url}`, `<h2>${source.competitors?.name || 'Competitor'} changed</h2><p>${ai.summary}</p><p><a href="${source.url}">${source.url}</a></p><pre>${diff.replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c]!)).slice(0, 3000)}</pre>`);
        if (change?.id) await supabase.from('changes').update({ emailed_at: new Date().toISOString() }).eq('id', change.id);
      }
      results.push({ url: source.url, status: 'changed', summary: ai.summary });
    } catch (e) {
      results.push({ url: source.url, status: 'error', error: e instanceof Error ? e.message : String(e) });
    }
  }
  return NextResponse.json({ checked: results.length, results });
}
