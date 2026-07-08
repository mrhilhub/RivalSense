'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { CSSProperties, FormEvent } from 'react';
import { supabaseAnon } from '@/lib/supabaseClient';
import { sourceTypeLabels, sourceTypes } from '@/lib/sourceTypes';

type Competitor = {
  id: string;
  name: string;
  website: string | null;
  is_system?: boolean;
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
  is_system?: boolean;
  competitors?: {
    name: string;
    is_system?: boolean;
  };
};

type AutomationHealth = {
  lastRanAt: string | null;
  checkedSources: number;
  failedSources: number;
};

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(99,102,241,0.18), transparent 32%), #070A12',
  color: '#F8FAFC',
};

const shellStyle: CSSProperties = {
  maxWidth: 1180,
  margin: '0 auto',
  padding: 28,
};

const cardStyle: CSSProperties = {
  background: 'rgba(15,23,42,0.72)',
  border: '1px solid rgba(148,163,184,0.16)',
  borderRadius: 24,
  boxShadow: '0 24px 80px rgba(0,0,0,0.28)',
};

const mutedStyle: CSSProperties = {
  color: '#94A3B8',
};

function formatDate(value?: string | null) {
  if (!value) return 'Not checked yet';
  return new Date(value).toLocaleString();
}

function statusLabel(status?: string | null) {
  if (!status) return 'Not checked';
  return status.replaceAll('_', ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

function badgeStyle(type: string): CSSProperties {
  const colors: Record<string, CSSProperties> = {
    schema: { background: 'rgba(20,184,166,0.16)', color: '#5EEAD4' },
    migration: { background: 'rgba(245,158,11,0.16)', color: '#FCD34D' },
    incident: { background: 'rgba(239,68,68,0.16)', color: '#FCA5A5' },
    performance: { background: 'rgba(14,165,233,0.16)', color: '#7DD3FC' },
    benchmark: { background: 'rgba(168,85,247,0.16)', color: '#D8B4FE' },
    release: { background: 'rgba(34,197,94,0.16)', color: '#86EFAC' },
    pricing: { background: 'rgba(124,58,237,0.16)', color: '#C4B5FD' },
    docs: { background: 'rgba(37,99,235,0.16)', color: '#93C5FD' },
    changelog: { background: 'rgba(22,163,74,0.16)', color: '#86EFAC' },
    github: { background: 'rgba(255,255,255,0.10)', color: '#E5E7EB' },
    website: { background: 'rgba(148,163,184,0.12)', color: '#CBD5E1' },
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'capitalize',
    border: '1px solid rgba(255,255,255,0.10)',
    ...(colors[type] || colors.website),
  };
}

function statusBadgeStyle(status?: string | null): CSSProperties {
  const normalized = status || 'not_checked';

  const colors: Record<string, CSSProperties> = {
    changed: { background: 'rgba(239,68,68,0.16)', color: '#FCA5A5' },
    unchanged: { background: 'rgba(34,197,94,0.16)', color: '#86EFAC' },
    baseline_created: { background: 'rgba(59,130,246,0.16)', color: '#93C5FD' },
    error: { background: 'rgba(239,68,68,0.16)', color: '#FCA5A5' },
    not_checked: { background: 'rgba(148,163,184,0.12)', color: '#CBD5E1' },
  };

  return {
    display: 'inline-flex',
    alignItems: 'center',
    borderRadius: 999,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 800,
    border: '1px solid rgba(255,255,255,0.10)',
    ...(colors[normalized] || colors.not_checked),
  };
}

export default function SourcesPage() {
  const [userId, setUserId] = useState('');
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState('');
  const [website, setWebsite] = useState('');

  const [sourceUrl, setSourceUrl] = useState('');
  const [sourceType, setSourceType] = useState('pricing');
  const [competitorId, setCompetitorId] = useState('');

  const load = useCallback(async () => {
    setLoading(true);

    const supabase = supabaseAnon();

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      window.location.href = '/login';
      return;
    }

    setUserId(user.id);

    const authHeaders = session?.access_token
      ? { authorization: `Bearer ${session.access_token}` }
      : undefined;

    if (session?.access_token) {
      await fetch('/api/bootstrap-ai-universe', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => null);
    }

    const [competitorsResponse, sourcesResponse] = await Promise.all([
      fetch(`/api/competitors?user_id=${user.id}`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`/api/sources?user_id=${user.id}`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
    ]);

    const compData = Array.isArray(competitorsResponse) ? (competitorsResponse as Competitor[]) : [];
    setCompetitors(compData);

    if (compData[0] && !competitorId) {
      setCompetitorId(compData[0].id);
    }

    setSources(Array.isArray(sourcesResponse) ? (sourcesResponse as Source[]) : []);
    setLoading(false);
  }, [competitorId]);

  useEffect(() => {
    load();
  }, [load]);

  const sourcesByCompetitor = useMemo(() => {
    return competitors.map((competitor) => ({
      competitor,
      sources: sources.filter((source) => source.competitor_id === competitor.id),
    }));
  }, [competitors, sources]);

  const automation = useMemo<AutomationHealth>(() => {
    const systemSources = sources.filter((source) => source.is_system);
    const checkedSources = systemSources.filter((source) => Boolean(source.last_checked_at)).length;
    const failedSources = systemSources.filter((source) => source.last_status === 'error').length;

    const lastRanDates = systemSources
      .map((source) => source.last_checked_at)
      .filter(Boolean)
      .map((value) => new Date(value as string).getTime());

    const lastRanAt =
      lastRanDates.length > 0 ? new Date(Math.max(...lastRanDates)).toISOString() : null;

    return { lastRanAt, checkedSources, failedSources };
  }, [sources]);

  async function addCompetitor(e: FormEvent) {
    e.preventDefault();

    if (!name.trim()) {
      alert('Add a system name first.');
      return;
    }

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
    await load();
  }

  async function addSource(e: FormEvent) {
    e.preventDefault();

    if (!competitorId) {
      alert('Add or select a system first.');
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
    const source = sources.find((item) => item.id === id);
    if (source?.is_system || source?.competitors?.is_system) {
      alert('These default AI sources are required and cannot be deleted.');
      return;
    }

    const confirmed = window.confirm('Delete this monitored source?');
    if (!confirmed) return;

    await fetch('/api/sources', {
      method: 'DELETE',
      body: JSON.stringify({ id, user_id: userId }),
      headers: { 'content-type': 'application/json' },
    });

    await load();
  }

  async function deleteCompetitor(id: string, competitorName: string) {
    const competitor = competitors.find((item) => item.id === id);
    if (competitor?.is_system) {
      alert('These default AI companies are required and cannot be deleted.');
      return;
    }

    const confirmed = window.confirm(
      `Delete ${competitorName} and all monitored sources attached to it?`
    );

    if (!confirmed) return;

    await fetch('/api/competitors', {
      method: 'DELETE',
      body: JSON.stringify({ id, user_id: userId }),
      headers: { 'content-type': 'application/json' },
    });

    if (competitorId === id) {
      setCompetitorId('');
    }

    await load();
  }

  return (
    <main style={pageStyle}>
      <div style={shellStyle}>
        <nav
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 28,
          }}
        >
          <div>
            <h1 style={{ margin: 0 }}>Sources</h1>
            <p style={{ ...mutedStyle, marginBottom: 0 }}>
              Add AI companies and configure sources to track their intelligence.
            </p>
          </div>

          <Link className="btn" href="/dashboard">
            Back to intelligence
          </Link>
        </nav>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 16,
            marginBottom: 18,
          }}
        >
          <form onSubmit={addCompetitor} style={{ ...cardStyle, padding: 22 }}>
            <h2 style={{ marginTop: 0 }}>Add AI company</h2>
            <p style={mutedStyle}>
              Add an AI company to track. Intelligence collection begins when you
              configure sources for the company.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              <input
                className="input"
                placeholder="Company name, e.g. Anthropic"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />

              <input
                className="input"
                placeholder="Optional homepage, e.g. https://postgresql.org"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
              />

              <button className="btn">Add system</button>
            </div>
          </form>

          <form onSubmit={addSource} style={{ ...cardStyle, padding: 22 }}>
            <h2 style={{ marginTop: 0 }}>Add source</h2>
            <p style={mutedStyle}>
              Track documentation, pricing pages, release notes, blog posts,
              GitHub repos, and news to detect strategic shifts.
            </p>

            <div style={{ display: 'grid', gap: 12 }}>
              <select
                className="input"
                value={competitorId}
                onChange={(e) => setCompetitorId(e.target.value)}
              >
                <option value="">Select company</option>
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
                    {sourceTypeLabels[type]}
                  </option>
                ))}
              </select>

              <input
                className="input"
                placeholder="https://example.com/releases"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
              />

              <button className="btn">Add source</button>
            </div>
          </form>
        </section>

        <section style={{ ...cardStyle, padding: 24 }}>
          <h2 style={{ marginTop: 0 }}>Monitored sources</h2>
          <p style={mutedStyle}>
            {competitors.length} systems · {sources.length} sources
          </p>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: 12,
              marginBottom: 18,
            }}
          >
            <div style={{ ...cardStyle, padding: 16 }}>
              <p style={{ ...mutedStyle, margin: 0 }}>Default-company cron</p>
              <strong style={{ fontSize: 24 }}>
                {automation.lastRanAt ? formatDate(automation.lastRanAt) : 'Not yet run'}
              </strong>
            </div>

            <div style={{ ...cardStyle, padding: 16 }}>
              <p style={{ ...mutedStyle, margin: 0 }}>Checked</p>
              <strong style={{ fontSize: 24 }}>{automation.checkedSources}</strong>
            </div>

            <div style={{ ...cardStyle, padding: 16 }}>
              <p style={{ ...mutedStyle, margin: 0 }}>Failed</p>
              <strong style={{ fontSize: 24 }}>{automation.failedSources}</strong>
            </div>
          </div>

          {loading && <p style={mutedStyle}>Loading...</p>}

          {!loading && competitors.length === 0 && (
            <p style={mutedStyle}>No companies yet.</p>
          )}

          <div style={{ display: 'grid', gap: 16 }}>
            {sourcesByCompetitor.map(({ competitor, sources }) => (
              <article
                key={competitor.id}
                style={{
                  border: '1px solid rgba(148,163,184,0.16)',
                  borderRadius: 22,
                  padding: 20,
                  background: 'rgba(2,6,23,0.32)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 16,
                    alignItems: 'flex-start',
                    marginBottom: 16,
                  }}
                >
                  <div>
                    <h3 style={{ margin: 0 }}>{competitor.name}</h3>
                    <p style={mutedStyle}>
                      {sources.length} monitored source
                      {sources.length === 1 ? '' : 's'}
                    </p>

                    {competitor.website && (
                      <a
                        href={competitor.website}
                        target="_blank"
                        style={{ color: '#93C5FD', overflowWrap: 'anywhere' }}
                      >
                        {competitor.website}
                      </a>
                    )}
                  </div>

                  {competitor.is_system ? (
                    <span style={badgeStyle('website')}>Required</span>
                  ) : (
                    <button
                      className="btn"
                      onClick={() => deleteCompetitor(competitor.id, competitor.name)}
                    >
                      Delete system
                    </button>
                  )}
                </div>

                {sources.length === 0 && (
                  <p style={mutedStyle}>No monitored sources yet.</p>
                )}

                <div style={{ display: 'grid', gap: 12 }}>
                  {sources.map((source) => (
                    <div
                      key={source.id}
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto 1fr auto',
                        gap: 14,
                        alignItems: 'center',
                        border: '1px solid rgba(148,163,184,0.14)',
                        borderRadius: 18,
                        padding: 14,
                        background: 'rgba(15,23,42,0.42)',
                      }}
                    >
                      <div style={{ display: 'grid', gap: 8 }}>
                        <span style={badgeStyle(source.type)}>
                          {sourceTypeLabels[source.type as keyof typeof sourceTypeLabels] || source.type}
                        </span>
                        <span style={statusBadgeStyle(source.last_status)}>
                          {statusLabel(source.last_status)}
                        </span>
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <a
                          href={source.url}
                          target="_blank"
                          style={{ color: '#CBD5E1', overflowWrap: 'anywhere' }}
                        >
                          {source.url}
                        </a>

                        <p style={{ ...mutedStyle, marginBottom: 0 }}>
                          Last checked: {formatDate(source.last_checked_at)}
                        </p>
                      </div>

                      {source.is_system ? (
                        <span style={badgeStyle('website')}>Required</span>
                      ) : (
                        <button className="btn" onClick={() => deleteSource(source.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
