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
  last_checked_at?: string | null;
  last_status?: string | null;
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

type CheckResultItem = {
  url: string;
  status: string;
};

type CheckResult = {
  checked?: number;
  results?: CheckResultItem[];
  error?: string;
};

const sourceTypes = ['pricing', 'docs', 'changelog', 'github', 'website'];

function formatDate(value?: string | null) {
  if (!value) return 'Not checked yet';
  return new Date(value).toLocaleString();
}

function statusLabel(status?: string | null) {
  if (!status) return 'Not checked';

  return status
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function importanceLabel(score: number) {
  if (score >= 4) return 'High';
  if (score >= 2) return 'Medium';
  return 'Low';
}

function badgeStyle(type: string): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    textTransform: 'capitalize',
    border: '1px solid rgba(255,255,255,0.12)',
  };

  const colors: Record<string, React.CSSProperties> = {
    pricing: { background: 'rgba(124, 58, 237, 0.14)', color: '#c4b5fd' },
    docs: { background: 'rgba(37, 99, 235, 0.14)', color: '#93c5fd' },
    changelog: { background: 'rgba(22, 163, 74, 0.14)', color: '#86efac' },
    github: { background: 'rgba(255,255,255,0.10)', color: '#e5e7eb' },
    website: { background: 'rgba(107,114,128,0.14)', color: '#d1d5db' },
  };

  return { ...base, ...(colors[type] || colors.website) };
}

function statusBadgeStyle(status?: string | null): React.CSSProperties {
  const normalized = status || 'not_checked';

  const colors: Record<string, React.CSSProperties> = {
    changed: { background: 'rgba(239,68,68,0.14)', color: '#fca5a5' },
    unchanged: { background: 'rgba(34,197,94,0.14)', color: '#86efac' },
    baseline_created: { background: 'rgba(59,130,246,0.14)', color: '#93c5fd' },
    error: { background: 'rgba(239,68,68,0.14)', color: '#fca5a5' },
    not_checked: { background: 'rgba(107,114,128,0.14)', color: '#d1d5db' },
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 700,
    border: '1px solid rgba(255,255,255,0.12)',
    ...(colors[normalized] || colors.not_checked),
  };
}

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
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sourcesByCompetitor = useMemo(() => {
    return competitors.map((competitor) => {
      const competitorSources = sources.filter(
        (source) => source.competitor_id === competitor.id
      );

      const competitorChanges = changes.filter(
        (change) =>
          change.monitored_sources?.competitors?.name === competitor.name
      );

      const lastCheckedDates = competitorSources
        .map((source) => source.last_checked_at)
        .filter(Boolean)
        .map((value) => new Date(value as string).getTime());

      const lastCheckedAt =
        lastCheckedDates.length > 0
          ? new Date(Math.max(...lastCheckedDates)).toISOString()
          : null;

      return {
        competitor,
        sources: competitorSources,
        changeCount: competitorChanges.length,
        lastCheckedAt,
      };
    });
  }, [competitors, sources, changes]);

  async function addCompetitor(e: React.FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert('Add a competitor name first.');
      return;
    }

    const cleanWebsite = website.trim();

    await fetch('/api/competitors', {
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

  async function deleteCompetitor(id: string, competitorName: string) {
    const confirmed = window.confirm(
      `Delete ${competitorName} and all monitored sources attached to it?`
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
    setCheckResult(null);

    try {
      const secret = window.prompt('Enter your CRON_SECRET');

      if (!secret) {
        setChecking(false);
        return;
      }

      const res = await fetch('/api/check?secret=' + encodeURIComponent(secret));
      const json = await res.json();

      setCheckResult(json);
      await load();
    } catch {
      setCheckResult({ error: 'Check failed.' });
    }

    setChecking(false);
  }

  return (
    <main
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 28,
      }}
      className="grid"
    >
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 16,
          alignItems: 'center',
        }}
      >
        <div>
          <h1 style={{ marginBottom: 6 }}>RivalSense</h1>
          <p className="muted" style={{ marginTop: 0 }}>
            Track competitor pricing pages, docs, changelogs, GitHub repos, and
            product updates.
          </p>
        </div>

        <button className="btn" onClick={runCheckNow} disabled={checking}>
          {checking ? 'Checking...' : 'Run check now'}
        </button>
      </header>

      <section
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        <form onSubmit={addCompetitor} className="card grid">
          <div>
            <h2>Add competitor</h2>
            <p className="muted">
              Add a competitor company. Monitoring starts only when you add
              specific sources.
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
            placeholder="Optional homepage, e.g. https://anthropic.com"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />

          <button className="btn">Add competitor</button>
        </form>

        <form onSubmit={addSource} className="card grid">
          <div>
            <h2>Add monitored source</h2>
            <p className="muted">
              Add specific URLs like pricing pages, docs, changelogs, or GitHub
              repos.
            </p>
          </div>

          <select
            className="input"
            value={competitorId}
            onChange={(e) => setCompetitorId(e.target.value)}
          >
            <option value="">Select competitor</option>
            {competitors.map((competitor) => (
              <option key={competitor.id} value={competitor.id}>
                {competitor.name}
              </option>
            ))}
          </select>

          <select
            className="input"
            value={sourceType}
            onChange={(e) => setSourceType(e.target.value)}
          >
            {sourceTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
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
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
          }}
        >
          <div>
            <h2>Competitors</h2>
            <p className="muted">
              {competitors.length} competitors · {sources.length} monitored
              sources · {changes.length} detected changes
            </p>
          </div>
        </div>

        {loading && <p className="muted">Loading...</p>}

        {!loading && competitors.length === 0 && (
          <p className="muted">No competitors yet. Add your first one above.</p>
        )}

        <div className="grid">
          {sourcesByCompetitor.map(
            ({ competitor, sources, changeCount, lastCheckedAt }) => (
              <article key={competitor.id} className="card grid">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                  }}
                >
                  <div>
                    <h3 style={{ marginBottom: 6 }}>{competitor.name}</h3>

                    <p className="muted" style={{ marginTop: 0 }}>
                      {sources.length} monitored source
                      {sources.length === 1 ? '' : 's'} · {changeCount} change
                      {changeCount === 1 ? '' : 's'}
                    </p>

                    <p className="muted" style={{ marginTop: 0 }}>
                      Last checked: {formatDate(lastCheckedAt)}
                    </p>

                    {competitor.website ? (
                      <a
                        className="muted"
                        href={competitor.website}
                        target="_blank"
                      >
                        {competitor.website}
                      </a>
                    ) : (
                      <p className="muted">No homepage saved.</p>
                    )}
                  </div>

                  <button
                    className="btn"
                    onClick={() =>
                      deleteCompetitor(competitor.id, competitor.name)
                    }
                    style={{ maxWidth: 180 }}
                  >
                    Delete competitor
                  </button>
                </div>

                {sources.length === 0 && (
                  <div className="card">
                    <p className="muted" style={{ margin: 0 }}>
                      No monitored sources yet. Add a pricing page, docs page,
                      changelog, or GitHub repo above.
                    </p>
                  </div>
                )}

                {sources.length > 0 && (
                  <div className="grid">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="card"
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'auto 1fr auto',
                          gap: 12,
                          alignItems: 'center',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            alignItems: 'flex-start',
                          }}
                        >
                          <span style={badgeStyle(source.type)}>
                            {source.type}
                          </span>

                          <span style={statusBadgeStyle(source.last_status)}>
                            {statusLabel(source.last_status)}
                          </span>
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <a
                            className="muted"
                            href={source.url}
                            target="_blank"
                            style={{ overflowWrap: 'anywhere' }}
                          >
                            {source.url}
                          </a>

                          <p className="muted" style={{ marginBottom: 0 }}>
                            Last checked: {formatDate(source.last_checked_at)}
                          </p>
                        </div>

                        <button
                          className="btn"
                          onClick={() => deleteSource(source.id)}
                        >
                          Delete
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </article>
            )
          )}
        </div>

        {checkResult && (
          <section className="card grid">
            <div>
              <h3 style={{ marginBottom: 6 }}>Latest check result</h3>

              {checkResult.error ? (
                <p>{checkResult.error}</p>
              ) : (
                <p className="muted" style={{ marginTop: 0 }}>
                  Checked {checkResult.checked ?? 0} source
                  {checkResult.checked === 1 ? '' : 's'}.
                </p>
              )}
            </div>

            {Array.isArray(checkResult.results) &&
              checkResult.results.length > 0 && (
                <div className="grid">
                  {checkResult.results.map((item) => (
                    <div
                      key={item.url}
                      className="card"
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr',
                        gap: 12,
                        alignItems: 'center',
                      }}
                    >
                      <span style={statusBadgeStyle(item.status)}>
                        {statusLabel(item.status)}
                      </span>

                      <a
                        className="muted"
                        href={item.url}
                        target="_blank"
                        style={{ overflowWrap: 'anywhere' }}
                      >
                        {item.url}
                      </a>
                    </div>
                  ))}
                </div>
              )}
          </section>
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

        {changes.map((change) => (
          <article key={change.id} className="card grid">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: 12,
                alignItems: 'flex-start',
              }}
            >
              <div>
                <span
                  style={statusBadgeStyle(
                    change.importance_score >= 4
                      ? 'changed'
                      : change.importance_score >= 2
                        ? 'baseline_created'
                        : 'unchanged'
                  )}
                >
                  {importanceLabel(change.importance_score)} importance
                </span>

                <h3 style={{ marginBottom: 6 }}>
                  {change.monitored_sources?.competitors?.name || 'Competitor'}{' '}
                  · {change.monitored_sources?.type || 'source'}
                </h3>

                <p className="muted" style={{ marginTop: 0 }}>
                  {new Date(change.created_at).toLocaleString()}
                </p>
              </div>
            </div>

            <p>{change.summary}</p>

            {change.diff_excerpt && (
              <pre
                className="card"
                style={{ overflowX: 'auto', whiteSpace: 'pre-wrap' }}
              >
                {change.diff_excerpt}
              </pre>
            )}

            {change.monitored_sources?.url && (
              <p>
                <a
                  className="muted"
                  href={change.monitored_sources.url}
                  target="_blank"
                >
                  {change.monitored_sources.url}
                </a>
              </p>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
```
