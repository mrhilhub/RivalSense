'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { supabaseAnon } from '@/lib/supabaseClient';
import { sourceTypeLabels } from '@/lib/sourceTypes';

type Source = {
  id: string;
  type: string;
  url: string;
  active: boolean;
  last_checked_at?: string | null;
  last_status?: string | null;
  is_system?: boolean;
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

type IntelligenceItem = {
  source_id: string;
  competitor: string;
  type: string;
  url: string;
  last_checked_at?: string | null;
  last_status?: string | null;
  snapshot_created_at?: string | null;
  current_preview: string;
};

type BootstrapResult = {
  success: boolean;
  createdCompanies?: number;
  createdSources?: number;
};

type AutomationHealth = {
  lastRanAt: string | null;
  checkedSources: number;
  failedSources: number;
};

type CheckResultItem = {
  url: string;
  status: string;
  error?: string;
  summary?: string;
};

type CheckResult = {
  checked?: number;
  results?: CheckResultItem[];
  error?: string;
};

type QueryResult = {
  id: string;
  title: string;
  summary: string;
  strategic_insight?: string | null;
  category: string;
  topics: string[];
  source_url?: string | null;
  observed_at: string;
  confidence_score?: number | null;
  company?: string | null;
  company_name?: string | null;
};

type QueryResponse = {
  answer?: string | null;
  results?: QueryResult[];
};

const querySuggestions = [
  'Which companies are launching new database products?',
  'Show pricing changes from the last month',
  'What reliability incidents should I care about?',
  'Which products added vector or AI features?',
  'What migrations or schema changes were detected?',
  'Which companies are competing with Postgres?',
];

const pageStyle: CSSProperties = {
  minHeight: '100vh',
  background:
    'radial-gradient(circle at top left, rgba(99,102,241,0.20), transparent 32%), radial-gradient(circle at top right, rgba(14,165,233,0.14), transparent 30%), #070A12',
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
  boxShadow: '0 24px 80px rgba(0,0,0,0.34)',
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

function importanceBadge(score: number): CSSProperties {
  if (score >= 4) return statusBadgeStyle('changed');
  if (score >= 2) return statusBadgeStyle('baseline_created');
  return statusBadgeStyle('unchanged');
}

function importanceLabel(score: number) {
  if (score >= 4) return 'High priority';
  if (score >= 2) return 'Medium priority';
  return 'Low priority';
}

function canonicalizeResultText(value?: string | null) {
  return (value || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function compactSourceLabel(url?: string | null) {
  if (!url) return '';

  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function Dashboard() {
  const [userId, setUserId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [intelligence, setIntelligence] = useState<IntelligenceItem[]>([]);
  const [competitorCount, setCompetitorCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [query, setQuery] = useState('');
  const [queryFocused, setQueryFocused] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
  const [queryAnswer, setQueryAnswer] = useState('');
  const [queryError, setQueryError] = useState('');
  const [hasQueried, setHasQueried] = useState(false);

  async function load() {
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
      })
        .then((response) => response.json())
        .catch(() => ({ success: false } as BootstrapResult));
    }

    const [competitorsResponse, sourcesResponse, digestResponse, intelligenceResponse] = await Promise.all([
      fetch(`/api/competitors?user_id=${user.id}`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`/api/sources?user_id=${user.id}`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`/api/digest?user_id=${user.id}`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
      fetch(`/api/intelligence?user_id=${user.id}`, { headers: authHeaders }).then((r) => r.json()).catch(() => []),
    ]);

    setCompetitorCount(Array.isArray(competitorsResponse) ? competitorsResponse.length : 0);
    setSources(Array.isArray(sourcesResponse) ? sourcesResponse : []);
    setChanges(Array.isArray(digestResponse) ? digestResponse : []);
    setIntelligence(Array.isArray(intelligenceResponse) ? intelligenceResponse : []);

    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const health = useMemo(() => {
    const total = sources.length;
    const errors = sources.filter((source) => source.last_status === 'error').length;
    const healthy = total - errors;

    const lastCheckedDates = sources
      .map((source) => source.last_checked_at)
      .filter(Boolean)
      .map((value) => new Date(value as string).getTime());

    const lastCheckedAt =
      lastCheckedDates.length > 0
        ? new Date(Math.max(...lastCheckedDates)).toISOString()
        : null;

    return { total, healthy, errors, lastCheckedAt };
  }, [sources]);

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

  const highPriorityChanges = changes.filter((change) => change.importance_score >= 4);
  const recentChanges = changes.slice(0, 6);

  async function runDatabaseRefresh() {
    setRefreshing(true);
    setCheckResult(null);

    try {
      const defaultCheck = await fetch('/api/check-default-companies');
      const defaultJson = await defaultCheck.json();

      if (!defaultCheck.ok) {
        throw new Error(defaultJson.error || 'Default-company refresh failed.');
      }

      const manualCheck = await fetch('/api/check');
      const manualJson = await manualCheck.json();

      if (!manualCheck.ok) {
        throw new Error(manualJson.error || 'Database refresh failed.');
      }

      setCheckResult(manualJson);
      await load();
    } catch (error) {
      setCheckResult({ error: error instanceof Error ? error.message : 'Refresh failed.' });
    }

    setRefreshing(false);
  }

  async function askIntelligenceDatabase(searchQuery = query) {
    const cleanQuery = searchQuery.trim();

    if (!cleanQuery || !userId) return;

    setQuery(cleanQuery);
    setQuerying(true);
    setQueryError('');
    setHasQueried(true);

    try {
      const params = new URLSearchParams({
        q: cleanQuery,
      });
      const supabase = supabaseAnon();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/search-intelligence?${params.toString()}`, {
        headers: session?.access_token
          ? { authorization: `Bearer ${session.access_token}` }
          : {},
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Search failed.');
      }

      const payload = json as QueryResponse;
      setQueryAnswer(typeof payload.answer === 'string' ? payload.answer : '');
      setQueryResults(Array.isArray(payload.results) ? payload.results : []);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'Search failed.');
      setQueryAnswer('');
      setQueryResults([]);
    }

    setQuerying(false);
    setQueryFocused(false);
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 12,
                height: 12,
                borderRadius: 999,
                background: '#22C55E',
                boxShadow: '0 0 24px rgba(34,197,94,0.9)',
              }}
            />
            <strong>RivalSense</strong>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <Link className="btn" href="/dashboard/sources">
              Manage sources
            </Link>
            <button className="btn" onClick={runDatabaseRefresh} disabled={refreshing}>
              {refreshing ? 'Refreshing...' : 'Refresh database'}
            </button>
          </div>
        </nav>

        <section
          style={{
            ...cardStyle,
            padding: 34,
            marginBottom: 18,
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'linear-gradient(135deg, rgba(99,102,241,0.18), transparent 38%, rgba(14,165,233,0.12))',
              pointerEvents: 'none',
            }}
          />

          <div style={{ position: 'relative' }}>
            <p
              style={{
                ...mutedStyle,
                marginTop: 0,
                textTransform: 'uppercase',
                letterSpacing: 2,
                fontSize: 12,
                fontWeight: 800,
              }}
            >
              AI company intelligence
            </p>

            <h1
              style={{
                fontSize: 52,
                lineHeight: 1,
                letterSpacing: -2,
                maxWidth: 760,
                margin: '0 0 16px',
              }}
            >
              Ask the database first.
            </h1>

            <p style={{ ...mutedStyle, fontSize: 18, maxWidth: 720 }}>
              RivalSense should feel like a search product, not a monitoring console.
              Ask about launches, pricing, documentation, incidents, and strategic shifts,
              then review the sourced evidence underneath.
            </p>

            <div style={{ maxWidth: 860, marginTop: 28 }}>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  askIntelligenceDatabase();
                }}
                style={{ position: 'relative' }}
              >
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) auto',
                    gap: 10,
                  }}
                >
                  <input
                    className="input"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    onFocus={() => setQueryFocused(true)}
                    onBlur={() => setQueryFocused(false)}
                    placeholder="Ask about launches, pricing changes, incidents, partnerships, or product strategy..."
                    style={{ minHeight: 58, fontSize: 17 }}
                  />

                  <button className="btn" disabled={querying || !query.trim()}>
                    {querying ? 'Searching...' : 'Ask RivalSense'}
                  </button>
                </div>

                {queryFocused && (
                  <div
                    style={{
                      position: 'absolute',
                      zIndex: 5,
                      top: 70,
                      left: 0,
                      right: 0,
                      display: 'grid',
                      gap: 8,
                      padding: 12,
                      borderRadius: 16,
                      border: '1px solid rgba(148,163,184,0.18)',
                      background: 'rgba(2,6,23,0.98)',
                      boxShadow: '0 18px 60px rgba(0,0,0,0.38)',
                    }}
                  >
                    {querySuggestions
                      .filter((suggestion) =>
                        suggestion.toLowerCase().includes(query.toLowerCase().trim())
                      )
                      .slice(0, 5)
                      .map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => askIntelligenceDatabase(suggestion)}
                          style={{
                            width: '100%',
                            textAlign: 'left',
                            padding: '10px 12px',
                            borderRadius: 12,
                            border: '1px solid rgba(148,163,184,0.12)',
                            background: 'rgba(15,23,42,0.78)',
                            color: '#E2E8F0',
                            cursor: 'pointer',
                          }}
                        >
                          {suggestion}
                        </button>
                      ))}
                  </div>
                )}
              </form>

              <div
                style={{
                  display: 'flex',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 14,
                }}
              >
                {querySuggestions.slice(0, 4).map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => askIntelligenceDatabase(suggestion)}
                    style={{
                      borderRadius: 999,
                      border: '1px solid rgba(148,163,184,0.18)',
                      background: 'rgba(15,23,42,0.72)',
                      color: '#E2E8F0',
                      padding: '10px 14px',
                      cursor: 'pointer',
                      fontSize: 13,
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>

              {queryError && <p style={{ color: '#FCA5A5', marginTop: 16 }}>{queryError}</p>}

              {queryAnswer && (
                <div
                  style={{
                    marginTop: 18,
                    padding: 22,
                    borderRadius: 20,
                    border: '1px solid rgba(56,189,248,0.24)',
                    background: 'rgba(8,47,73,0.34)',
                    maxWidth: 820,
                  }}
                >
                  <p
                    style={{
                      ...mutedStyle,
                      margin: '0 0 8px',
                      textTransform: 'uppercase',
                      letterSpacing: 1.5,
                      fontSize: 12,
                      fontWeight: 800,
                    }}
                  >
                    Answer
                  </p>
                  <p style={{ margin: 0, fontSize: 16, lineHeight: 1.7 }}>{queryAnswer}</p>
                  <p style={{ ...mutedStyle, margin: '10px 0 0', fontSize: 13 }}>
                    Generated from the strongest matching intelligence signals in your database.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div style={{ ...cardStyle, padding: 18 }}>
            <p style={{ ...mutedStyle, margin: 0 }}>Companies</p>
            <strong style={{ fontSize: 28 }}>{competitorCount}</strong>
          </div>

          <div style={{ ...cardStyle, padding: 18 }}>
            <p style={{ ...mutedStyle, margin: 0 }}>Sources</p>
            <strong style={{ fontSize: 28 }}>{health.total}</strong>
          </div>

          <div style={{ ...cardStyle, padding: 18 }}>
            <p style={{ ...mutedStyle, margin: 0 }}>Healthy</p>
            <strong style={{ fontSize: 28 }}>{health.healthy}</strong>
          </div>

          <div style={{ ...cardStyle, padding: 18 }}>
            <p style={{ ...mutedStyle, margin: 0 }}>Changes detected</p>
            <strong style={{ fontSize: 28 }}>{changes.length}</strong>
          </div>

          <div style={{ ...cardStyle, padding: 18 }}>
            <p style={{ ...mutedStyle, margin: 0 }}>Default-company cron</p>
            <strong style={{ fontSize: 18 }}>
              {automation.lastRanAt ? formatDate(automation.lastRanAt) : 'Not yet run'}
            </strong>
            <p style={{ ...mutedStyle, margin: '6px 0 0' }}>
              {automation.checkedSources} checked, {automation.failedSources} failed
            </p>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: 24, marginBottom: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Why RivalSense Thinks This</h2>
            <p style={{ ...mutedStyle, marginBottom: 0 }}>
              The strongest supporting signals behind the answer, with direct source links.
            </p>
          </div>

          {queryResults.length > 0 && (
            <div style={{ display: 'grid', gap: 12 }}>
              {queryResults.map((result) => (
                (() => {
                  const insight =
                    result.strategic_insight &&
                    canonicalizeResultText(result.strategic_insight) !== canonicalizeResultText(result.summary)
                      ? result.strategic_insight
                      : null;

                  return (
                <article
                  key={result.id}
                  style={{
                    padding: 18,
                    borderRadius: 20,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(7,10,18,0.72)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: 12,
                      flexWrap: 'wrap',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      {(result.company || result.company_name) && (
                        <span style={statusBadgeStyle('not_checked')}>
                          {result.company || result.company_name}
                        </span>
                      )}
                      <span style={statusBadgeStyle('baseline_created')}>
                        {result.category}
                      </span>
                    </div>

                    <p style={{ ...mutedStyle, margin: 0, fontSize: 13 }}>
                      Observed {formatDate(result.observed_at)}
                    </p>
                  </div>

                  <h3 style={{ marginBottom: 8 }}>{result.title}</h3>

                  <p style={{ marginTop: 0, marginBottom: 10, fontSize: 15, lineHeight: 1.65 }}>
                    {result.summary}
                  </p>

                  {insight && (
                    <div
                      style={{
                        borderLeft: '2px solid rgba(56,189,248,0.42)',
                        paddingLeft: 12,
                        marginBottom: 12,
                      }}
                    >
                      <p
                        style={{
                          ...mutedStyle,
                          margin: '0 0 4px',
                          textTransform: 'uppercase',
                          letterSpacing: 1.2,
                          fontSize: 11,
                          fontWeight: 800,
                        }}
                      >
                        Implication
                      </p>
                      <p style={{ ...mutedStyle, margin: 0, lineHeight: 1.6 }}>{insight}</p>
                    </div>
                  )}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      flexWrap: 'wrap',
                      marginTop: 14,
                      paddingTop: 14,
                      borderTop: '1px solid rgba(148,163,184,0.12)',
                    }}
                  >
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {typeof result.confidence_score === 'number' && (
                        <span style={statusBadgeStyle('unchanged')}>
                          {Math.round(result.confidence_score * 100)}% confidence
                        </span>
                      )}
                      {(result.topics || [])
                        .filter((topic) => topic !== (result.company || result.company_name))
                        .slice(0, 2)
                        .map((topic) => (
                          <span
                            key={topic}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              borderRadius: 999,
                              padding: '5px 10px',
                              fontSize: 12,
                              border: '1px solid rgba(148,163,184,0.16)',
                              color: '#CBD5E1',
                              background: 'rgba(15,23,42,0.56)',
                            }}
                          >
                            {topic}
                          </span>
                        ))}
                    </div>

                    {result.source_url && (
                      <a
                        href={result.source_url}
                        target="_blank"
                        style={{ color: '#93C5FD', textDecoration: 'none' }}
                      >
                        Source: {compactSourceLabel(result.source_url)}
                      </a>
                    )}
                  </div>
                </article>
                  );
                })()
              ))}
            </div>
          )}

          {hasQueried && !querying && !queryError && queryResults.length === 0 && (
            <p style={{ ...mutedStyle, marginBottom: 0, marginTop: 16 }}>
              No matching intelligence items yet. As source changes become structured intelligence items,
              this search will start returning answers.
            </p>
          )}

          {!hasQueried && (
            <p style={{ ...mutedStyle, marginBottom: 0 }}>
              Run a search above to generate an answer and inspect the supporting evidence here.
            </p>
          )}
        </section>

        {checkResult && (
          <section style={{ ...cardStyle, padding: 22, marginBottom: 18 }}>
            <h2 style={{ marginTop: 0 }}>Latest check</h2>

            {checkResult.error ? (
              <p>{checkResult.error}</p>
            ) : (
              <p style={mutedStyle}>
                Checked {checkResult.checked ?? 0} sources.{' '}
                {checkResult.results?.filter((r) => r.status === 'error').length || 0}{' '}
                errors.
              </p>
            )}

            {checkResult.results && (
              <div style={{ display: 'grid', gap: 10 }}>
                {checkResult.results.map((result) => (
                  <div
                    key={result.url}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'auto 1fr',
                      gap: 12,
                      alignItems: 'center',
                    }}
                  >
                    <span style={statusBadgeStyle(result.status)}>
                      {statusLabel(result.status)}
                    </span>
                    <span style={{ ...mutedStyle, overflowWrap: 'anywhere' }}>
                      {result.url}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section style={{ ...cardStyle, padding: 24, marginBottom: 18 }}>
          <details>
            <summary
              style={{
                cursor: 'pointer',
                listStyle: 'none',
                outline: 'none',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <div>
                  <h2 style={{ margin: 0 }}>Current intelligence</h2>
                  <p style={{ ...mutedStyle, margin: '6px 0 0' }}>
                    Expand to inspect the latest known state of monitored signals.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={statusBadgeStyle('unchanged')}>{health.healthy} healthy</span>
                  <span style={statusBadgeStyle(health.errors > 0 ? 'error' : 'not_checked')}>
                    {health.errors} errors
                  </span>
                </div>
              </div>
            </summary>

            <div style={{ marginTop: 18 }}>
              {loading && <p style={mutedStyle}>Loading intelligence...</p>}

              {!loading && recentChanges.length > 0 && (
                <div style={{ display: 'grid', gap: 14, marginBottom: 22 }}>
                  {recentChanges.map((change) => (
                    <article
                      key={change.id}
                      style={{
                        padding: 20,
                        borderRadius: 20,
                        border: '1px solid rgba(148,163,184,0.16)',
                        background: 'rgba(2,6,23,0.38)',
                      }}
                    >
                      <span style={importanceBadge(change.importance_score)}>
                        {importanceLabel(change.importance_score)}
                      </span>

                      <h3 style={{ marginBottom: 6 }}>
                        {change.monitored_sources?.competitors?.name || 'System'} ·{' '}
                        {sourceTypeLabels[
                          change.monitored_sources?.type as keyof typeof sourceTypeLabels
                        ] || change.monitored_sources?.type || 'source'}
                      </h3>

                      <p style={mutedStyle}>{new Date(change.created_at).toLocaleString()}</p>

                      <p style={{ fontSize: 16 }}>{change.summary}</p>
                    </article>
                  ))}
                </div>
              )}

              {!loading && intelligence.length === 0 && (
                <div
                  style={{
                    border: '1px dashed rgba(148,163,184,0.28)',
                    borderRadius: 20,
                    padding: 26,
                    background: 'rgba(15,23,42,0.42)',
                  }}
                >
                  <h3 style={{ marginTop: 0 }}>No intelligence captured yet.</h3>
                  <p style={mutedStyle}>
                    Add monitored database sources, then run your first refresh to create baseline snapshots.
                  </p>
                </div>
              )}

              {!loading && intelligence.length > 0 && (
                <div style={{ display: 'grid', gap: 14 }}>
                  {intelligence.map((item) => (
                    <article
                      key={item.source_id}
                      style={{
                        padding: 20,
                        borderRadius: 20,
                        border: '1px solid rgba(148,163,184,0.16)',
                        background: 'rgba(2,6,23,0.38)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'flex-start',
                        }}
                      >
                        <div>
                          <span style={statusBadgeStyle(item.last_status)}>
                            {statusLabel(item.last_status)}
                          </span>

                          <h3 style={{ marginBottom: 6 }}>
                            {item.competitor} ·{' '}
                            {sourceTypeLabels[item.type as keyof typeof sourceTypeLabels] || item.type}
                          </h3>

                          <p style={mutedStyle}>
                            Snapshot captured: {formatDate(item.snapshot_created_at)}
                          </p>
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                          gap: 12,
                          marginTop: 16,
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <p style={{ ...mutedStyle, margin: 0, fontSize: 12 }}>Signal type</p>
                          <strong style={{ textTransform: 'capitalize' }}>
                            {sourceTypeLabels[item.type as keyof typeof sourceTypeLabels] || item.type}
                          </strong>
                        </div>

                        <div>
                          <p style={{ ...mutedStyle, margin: 0, fontSize: 12 }}>Status</p>
                          <strong>{statusLabel(item.last_status)}</strong>
                        </div>

                        <div>
                          <p style={{ ...mutedStyle, margin: 0, fontSize: 12 }}>Last checked</p>
                          <strong>{formatDate(item.last_checked_at)}</strong>
                        </div>
                      </div>

                      <p
                        style={{
                          ...mutedStyle,
                          fontSize: 15,
                          lineHeight: 1.6,
                          marginBottom: 0,
                        }}
                      >
                        Current version captured and monitored. RivalSense will surface a database intelligence summary when this source changes.
                      </p>

                      <a
                        href={item.url}
                        target="_blank"
                        style={{ color: '#93C5FD', overflowWrap: 'anywhere' }}
                      >
                        {item.url}
                      </a>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </details>
        </section>

        <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr)', gap: 18 }}>
          <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <section style={{ ...cardStyle, padding: 22 }}>
              <h2 style={{ marginTop: 0 }}>Priority alerts</h2>

              {highPriorityChanges.length === 0 ? (
                <p style={mutedStyle}>No high-priority alerts right now.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {highPriorityChanges.slice(0, 4).map((change) => (
                    <div key={change.id}>
                      <strong>{change.monitored_sources?.competitors?.name || 'System'}</strong>
                      <p style={{ ...mutedStyle, marginTop: 4 }}>{change.summary}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </aside>
        </section>
      </div>
    </main>
  );
}
