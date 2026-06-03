'use client';
import { useEffect, useState } from 'react';
import { supabaseAnon } from '@/lib/supabaseClient';

type Competitor = { id: string; name: string; website: string | null };

type Change = { id:string; summary:string; diff_excerpt:string; created_at:string; importance_score:number; monitored_sources?: { url:string; type:string; competitors?: { name:string } } };

export default function Dashboard() {
  const [userId, setUserId] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('pricing');
  const [competitorId, setCompetitorId] = useState('');

  async function load() {
    const supabase = supabaseAnon();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { window.location.href = '/login'; return; }
    setUserId(user.id);
    const comps = await supabase.from('competitors').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
    setCompetitors((comps.data || []) as Competitor[]);
    if ((comps.data || [])[0] && !competitorId) setCompetitorId((comps.data || [])[0].id);
    const digest = await fetch(`/api/digest?user_id=${user.id}`).then(r=>r.json()).catch(()=>[]);
    setChanges(Array.isArray(digest) ? digest : []);
  }
  useEffect(() => { load(); }, []);

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/competitors', { method:'POST', body: JSON.stringify({ user_id:userId, name, website }), headers:{'content-type':'application/json'} });
    setName(''); setWebsite(''); load();
  }
  async function addSource(e: React.FormEvent) {
    e.preventDefault();
    await fetch('/api/sources', { method:'POST', body: JSON.stringify({ user_id:userId, competitor_id:competitorId, type:sourceType, url:sourceUrl }), headers:{'content-type':'application/json'} });
    setSourceUrl(''); load();
  }

  return <main style={{maxWidth:1100, margin:'0 auto', padding:24}} className="grid">
    <h1>Competitor Monitor</h1>
    <section style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:16}}>
      <form onSubmit={addCompetitor} className="card grid">
        <h2>Add competitor</h2>
        <input className="input" placeholder="OpenAI" value={name} onChange={e=>setName(e.target.value)} />
        <input className="input" placeholder="https://openai.com" value={website} onChange={e=>setWebsite(e.target.value)} />
        <button className="btn">Add</button>
      </form>
      <form onSubmit={addSource} className="card grid">
        <h2>Add monitored URL</h2>
        <select className="input" value={competitorId} onChange={e=>setCompetitorId(e.target.value)}>{competitors.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="input" value={sourceType} onChange={e=>setSourceType(e.target.value)}>{['pricing','docs','changelog','github','website'].map(t=><option key={t}>{t}</option>)}</select>
        <input className="input" placeholder="https://example.com/pricing" value={sourceUrl} onChange={e=>setSourceUrl(e.target.value)} />
        <button className="btn">Monitor URL</button>
      </form>
    </section>
    <section className="card grid">
      <h2>Recent changes</h2>
      {changes.length === 0 && <p className="muted">No changes yet. First cron run creates baselines.</p>}
      {changes.map(c => <article key={c.id} className="card">
        <p className="muted">Importance {c.importance_score}/5 · {new Date(c.created_at).toLocaleString()}</p>
        <h3>{c.monitored_sources?.competitors?.name || 'Competitor'} · {c.monitored_sources?.type}</h3>
        <p>{c.summary}</p>
        <p><a className="muted" href={c.monitored_sources?.url} target="_blank">{c.monitored_sources?.url}</a></p>
      </article>)}
    </section>
  </main>;
}
