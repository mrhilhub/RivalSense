'use client';

import { useEffect, useMemo, useState } from 'react';
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

const sourceTypes = ['pricing', 'docs', 'changelog', 'github', 'website'];

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
  const [loading, setLoading] = useState(true);

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
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const sourcesByCompetitor = useMemo(() => {
    return competitors.map((competitor) => ({
      competitor,
      sources: sources.filter((s) => s.competitor_id === competitor.id),
    }));
  }, [competitors, sources]);

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert('Add a competitor name first.');
      return;
    }

    const cleanWebsite = website.trim();

    const res = await fetch('/api/competitors', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        name: name.trim(),
        website: cleanWebsite || null,
      }),
      headers: { 'content-type': 'application/json' },
    });

    setName('');
    setWebsite('');
    await load();
  }

  async function addSource(e: React.FormEvent) {
    e.preventDefault();

    if (!competitorId) {
      alert('Add or select a competitor first.');
      return;
    }

    if (!sourceUrl.trim()) {
      alert('Add a URL first.');
      return;
    }

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
    await load();
  }

  async function deleteSource(id: string) {
    const confirmed = window.confirm('Delete this monitored source?');
    if (!confirmed) return;

    const supabase = supabaseAnon();

    await supabase
      .from('monitored_sources')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    await load();
  }

  async function deleteCompetitor(id: string, name: string) {
    const confirmed = window.confirm(
      `Delete ${name} and all monitored sources attached to it?`
    );

    if (!confirmed) return;

    const supabase = supabaseAnon();

    await supabase
      .from('monitored_sources')
      .delete()
      .eq('competitor_id', id)
      .eq('user_id', userId);

    await supabase
      .from('competitors')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (competitorId === id) {
      setCompetitorId('');
    }

    await load();
  }

  async function runCheckNow() {
    setChecking(true);
    setCheckResult('');

    try {
      const secret = window.prompt('Enter your CRON_SECRET');

      if (!secret) {
        setChecking(false);
        return;
      }

      const res = await fetch('/api/check?secret=' + encodeURIComponent(secret));
      const json = await res.json();

      setCheckResult(JSON.stringify(json, null, 2));
      await load();
    } catch {
      setCheckResult('Check failed.');
    }

    setChecking(false);
  }

  return (
    <main style={{ maxWidth: 1180, margin: '0 auto', padding: 28 }} className="grid">
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
        <div>
          <h1 style={{ marginBottom: 6 }}>RivalSense</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Track competitor websites, pricing, docs, changelogs, and GitHub updates.
          </p>
        </div>

        <button className="btn" onClick={runCheckNow} disabled={checking}>
          {checking ? 'Checking...' : 'Run check now'}
        </button>
      </header>

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <form onSubmit={addCompetitor} className="card grid">
          <div>
            <h2>Add competitor</h2>
            <p className="muted">
              Add the company once. Its main website becomes the first monitored source.
            </p>
          </div>

          <input
            className="input"
            placeholder="Company name, e.g. Anthropic"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />

          <input
            className="input"
            placeholder="Main website, e.g. https://anthropic.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <button className="btn">Add competitor</button>
        </form>

        <form onSubmit={addSource} className="card grid">
          <div>
            <h2>Add extra source</h2>
            <p className="muted">
              Add specific URLs like pricing pages, docs, changelogs, or GitHub repos.
            </p>
          </div>

          <select
            className="input"
            value={competitorId}
            onChange={(e) => setCompetitorId(e.target.value)}
          >
            <option value="">Select competitor</option>
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
            {sourceTypes.map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>

          <input
            className="input"
            placeholder="https://example.com/pricing"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
          />

          <button className="btn">Add source</button>
        </form>
      </section>

      <section className="card grid">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
          <div>
            <h2>Competitors</h2>
            <p className="muted">
              {competitors.length} competitors · {sources.length} monitored sources
            </p>
          </div>
        </div>

        {loading && <p className="muted">Loading...</p>}

        {!loading && competitors.length === 0 && (
          <p className="muted">No competitors yet. Add your first one above.</p>
        )}

        {sourcesByCompetitor.map(({ competitor, sources }) => (
          <article key={competitor.id} className="card grid">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ marginBottom: 6 }}>{competitor.name}</h3>

                {competitor.website ? (
                  <a className="muted" href={competitor.website} target="_blank">
                    {competitor.website}
                  </a>
                ) : (
                  <p className="muted">No homepage saved.</p>
                )}
              </div>

              <button
                className="btn"
                onClick={() => deleteCompetitor(competitor.id, competitor.name)}
                style={{ maxWidth: 180 }}
              >
                Delete competitor
              </button>
            </div>

            {sources.length === 0 && (
              <p className="muted">No monitored sources yet.</p>
            )}

            <div className="grid">
              {sources.map((s) => (
                <div
                  key={s.id}
                  className="card"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '130px 1fr 150px',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <strong style={{ textTransform: 'capitalize' }}>{s.type}</strong>

                  <a className="muted" href={s.url} target="_blank" style={{ overflowWrap: 'anywhere' }}>
                    {s.url}
                  </a>

                  <button className="btn" onClick={() => deleteSource(s.id)}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          </article>
        ))}

        {checkResult && (
          <pre className="card" style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
            {checkResult}
          </pre>
        )}
      </section>

      <section className="card grid">
        <div>
          <h2>Recent changes</h2>
          <p className="muted">
            New changes will appear here after a monitored page changes.
          </p>
        </div>

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

            {c.diff_excerpt && (
              <pre className="card" style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}>
                {c.diff_excerpt}
              </pre>
            )}

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
