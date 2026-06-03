'use client';

import { useEffect, useState } from 'react';
import { supabaseAnon } from '@/lib/supabaseClient';

type Competitor = {
  id: string;
  name: string;
  website: string | null;
};

type Source = {
  id: string;
  competitor_id: string;
  user_id: string;
  type: string;
  url: string;
  active: boolean;
  created_at: string;
  competitors?: {
    name: string;
  };
};

type Change = {
  id: string;
  summary: string;
  diff_excerpt: string;
  created_at: string;
  importance_score: number;
  monitored_sources?: {
    url: string;
    type: string;
    competitors?: {
      name: string;
    };
  };
};

export default function Dashboard() {
  const [userId, setUserId] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('pricing');
  const [competitorId, setCompetitorId] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState('');

  async function load() {
    const supabase = supabaseAnon();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    setUserId(user.id);

    const comps = await supabase
      .from('competitors')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    const compData = (comps.data || []) as Competitor[];
    setCompetitors(compData);

    if (compData[0] && !competitorId) {
      setCompetitorId(compData[0].id);
    }

    const sourceRows = await supabase
      .from('monitored_sources')
      .select('*, competitors(name)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setSources((sourceRows.data || []) as Source[]);

    const digest = await fetch(`/api/digest?user_id=${user.id}`)
      .then((r) => r.json())
      .catch(() => []);

    setChanges(Array.isArray(digest) ? digest : []);
  }

  useEffect(() => {
    load();
  }, []);

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) return;

    await fetch('/api/competitors', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        name: name.trim(),
        website: website.trim() || null,
      }),
      headers: { 'content-type': 'application/json' },
    });

    setName('');
    setWebsite('');
    load();
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();

    if (!competitorId || !sourceUrl.trim()) return;

    await fetch('/api/sources', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        competitor_id: competitorId,
        type: sourceType,
        url: sourceUrl.trim(),
      }),
      headers: { 'content-type': 'application/json' },
    });

    setSourceUrl('');
    load();
  }

  async function deleteSource(id: string) {
    const confirmed = window.confirm('Delete this monitored URL?');
    if (!confirmed) return;

    const supabase = supabaseAnon();

    await supabase
      .from('monitored_sources')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    load();
  }

  async function runCheckNow() {
    setChecking(true);
    setCheckResult('');

    try {
      const res = await fetch('/api/check?secret=' + encodeURIComponent(process.env.NEXT_PUBLIC_CRON_SECRET || ''));
      const json = await res.json();
      setCheckResult(JSON.stringify(json, null, 2));
      load();
    } catch {
      setCheckResult('Check failed.');
    }

    setChecking(false);
  }

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: 24 }} className="grid">
      <h1>RivalSense</h1>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <form onSubmit={addCompetitor} className="card grid">
          <h2>Add competitor</h2>
          <input
            className="input"
            placeholder="Anthropic"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input"
            placeholder="https://anthropic.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
          <button className="btn">Add</button>
        </form>

        <form onSubmit={addSource} className="card grid">
          <h2>Add monitored URL</h2>

          <select
            className="input"
            value={competitorId}
            onChange={(e) => setCompetitorId(e.target.value)}
          >
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            {['pricing', 'docs', 'changelog', 'github', 'website'].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <input
            className="input"
            placeholder="https://docs.anthropic.com/en/release-notes/overview"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />

          <button className="btn">Monitor URL</button>
        </form>
      </section>

      <section className="card grid">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <h2>Monitored URLs</h2>
          <button className="btn" onClick={runCheckNow} disabled={checking}>
            {checking ? 'Checking...' : 'Run check now'}
          </button>
        </div>

        {sources.length === 0 && <p className="muted">No monitored URLs yet.</p>}

        {sources.map((s) => (
          <div key={s.id} className="card" style={{ display: 'grid', gap: 8 }}>
            <strong>
              {s.competitors?.name || 'Competitor'} · {s.type}
            </strong>
            <a className="muted" href={s.url} target="_blank">
              {s.url}
            </a>
            <button className="btn" onClick={() => deleteSource(s.id)}>
              Delete
            </button>
          </div>
        ))}

        {checkResult && (
          <pre className="card" style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {checkResult}
          </pre>
        )}
      </section>

      <section className="card grid">
        <h2>Recent changes</h2>

        {changes.length === 0 && (
          <p className="muted">No changes yet. First check creates baselines.</p>
        )}

        {changes.map((c) => (
          <article key={c.id} className="card">
            <p className="muted">
              Importance {c.importance_score}/5 · {new Date(c.created_at).toLocaleString()}
            </p>
            <h3>
              {c.monitored_sources?.competitors?.name || 'Competitor'} ·{' '}
              {c.monitored_sources?.type}
            </h3>
            <p>{c.summary}</p>
            <p>
              <a className="muted" href={c.monitored_sources?.url} target="_blank">
                {c.monitored_sources?.url}
              </a>
            </p>
          </article>
        ))}
      </section>
    </main>
  );
}
