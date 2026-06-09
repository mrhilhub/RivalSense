'use client';

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
};

type QueryAnswer = {
  answer: string;
  results: QueryResult[];
};

const querySuggestions = [
  'What changed at Anthropic this week?',
  'Which AI companies changed pricing recently?',
  'What are competitors doing with agents?',
  'Which companies launched new models?',
  'What changed in OpenAI developer tools?',
  'Which AI companies announced partnerships?',
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

export default function Dashboard() {
  const [userId, setUserId] = useState('');
  const [sources, setSources] = useState<Source[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [intelligence, setIntelligence] = useState<IntelligenceItem[]>([]);
  const [competitorCount, setCompetitorCount] = useState(0);
  const [intelligenceItemCount, setIntelligenceItemCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null);
  const [query, setQuery] = useState('');
  const [queryFocused, setQueryFocused] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [queryAnswer, setQueryAnswer] = useState('');
  const [queryResults, setQueryResults] = useState<QueryResult[]>([]);
  const [queryError, setQueryError] = useState('');
  const [hasQueried, setHasQueried] = useState(false);

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

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      await fetch('/api/bootstrap-defaults', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${session.access_token}`,
        },
      }).catch(() => null);
    }

    const comps = await supabase
      .from('competitors')
      .select('id')
      .eq('user_id', user.id);

    setCompetitorCount(comps.data?.length || 0);

    const itemCount = await supabase
      .from('intelligence_items')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id);

    setIntelligenceItemCount(itemCount.count || 0);

    const sourceRows = await supabase
      .from('monitored_sources')
      .select('id,type,url,active,last_checked_at,last_status')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    setSources((sourceRows.data || []) as Source[]);

    const digest = await fetch(`/api/digest?user_id=${user.id}`)
      .then((r) => r.json())
      .catch(() => []);

    setChanges(Array.isArray(digest) ? digest : []);

    const intel = await fetch(`/api/intelligence?user_id=${user.id}`)
      .then((r) => r.json())
      .catch(() => []);

    setIntelligence(Array.isArray(intel) ? intel : []);

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

  const highPriorityChanges = changes.filter((change) => change.importance_score >= 4);
  const recentChanges = changes.slice(0, 6);

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

  async function askRivalSense(searchQuery = query) {
    const cleanQuery = searchQuery.trim();

    if (!cleanQuery || !userId) return;

    setQuery(cleanQuery);
    setQuerying(true);
    setQueryError('');
    setHasQueried(true);
    setQueryAnswer('');

    try {
      const params = new URLSearchParams({
        q: cleanQuery,
      });
      const supabase = supabaseAnon();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const res = await fetch(`/api/query-intelligence?${params.toString()}`, {
        headers: session?.access_token
          ? { authorization: `Bearer ${session.access_token}` }
          : {},
      });
      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.error || 'Search failed.');
      }

      const answer = json as QueryAnswer;
      setQueryAnswer(answer.answer || '');
      setQueryResults(Array.isArray(answer.results) ? answer.results : []);
    } catch (error) {
      setQueryError(error instanceof Error ? error.message : 'Search failed.');
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
            <button className="btn" onClick={runCheckNow} disabled={checking}>
              {checking ? 'Updating...' : 'Refresh intel'}
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
              AI market intelligence
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
              Ask RivalSense anything about AI company changes.
            </h1>

            <p style={{ ...mutedStyle, fontSize: 18, maxWidth: 720 }}>
              RivalSense tracks AI companies in the background, turns changes into
              structured intelligence, and answers your questions with sources.
            </p>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
                gap: 12,
                marginTop: 28,
              }}
            >
              <div style={{ ...cardStyle, padding: 18 }}>
                <p style={{ ...mutedStyle, margin: 0 }}>AI companies</p>
                <strong style={{ fontSize: 34 }}>{competitorCount}</strong>
              </div>

              <div style={{ ...cardStyle, padding: 18 }}>
                <p style={{ ...mutedStyle, margin: 0 }}>Sources</p>
                <strong style={{ fontSize: 34 }}>{health.total}</strong>
              </div>

              <div style={{ ...cardStyle, padding: 18 }}>
                <p style={{ ...mutedStyle, margin: 0 }}>Healthy</p>
                <strong style={{ fontSize: 34 }}>{health.healthy}</strong>
              </div>

              <div style={{ ...cardStyle, padding: 18 }}>
                <p style={{ ...mutedStyle, margin: 0 }}>Intelligence items</p>
                <strong style={{ fontSize: 34 }}>{intelligenceItemCount}</strong>
              </div>
            </div>
          </div>
        </section>

        <section style={{ ...cardStyle, padding: 24, marginBottom: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ margin: 0 }}>Ask RivalSense</h2>
            <p style={{ ...mutedStyle, marginBottom: 0 }}>
              Ask about AI company changes, pricing, agents, models, partnerships, and strategy.
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              askRivalSense();
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
                placeholder="What changed at Anthropic this week?"
                style={{ minHeight: 46 }}
              />

              <button className="btn" disabled={querying || !query.trim()}>
                {querying ? 'Searching...' : 'Ask'}
              </button>
            </div>

            {queryFocused && (
              <div
                style={{
                  position: 'absolute',
                  zIndex: 5,
                  top: 58,
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
                      onClick={() => askRivalSense(suggestion)}
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

          {queryError && <p style={{ color: '#FCA5A5' }}>{queryError}</p>}

          {queryAnswer && (
            <div
              style={{
                marginTop: 18,
                padding: 20,
                borderRadius: 18,
                border: '1px solid rgba(148,163,184,0.16)',
                background: 'rgba(15,23,42,0.62)',
              }}
            >
              <p style={{ ...mutedStyle, marginTop: 0 }}>Answer</p>
              <p style={{ fontSize: 18, lineHeight: 1.6, marginBottom: 0 }}>
                {queryAnswer}
              </p>
            </div>
          )}

          {queryResults.length > 0 && (
            <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
              <h3 style={{ marginBottom: 0 }}>Related intelligence</h3>
              {queryResults.map((result) => (
                <article
                  key={result.id}
                  style={{
                    padding: 18,
                    borderRadius: 18,
                    border: '1px solid rgba(148,163,184,0.16)',
                    background: 'rgba(2,6,23,0.38)',
                  }}
                >
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <span style={statusBadgeStyle('baseline_created')}>
                      {result.category}
                    </span>
                    {result.company && (
                      <span style={statusBadgeStyle('not_checked')}>
                        {result.company}
                      </span>
                    )}
                  </div>

                  <h3 style={{ marginBottom: 6 }}>{result.title}</h3>
                  <p style={mutedStyle}>
                    Observed {formatDate(result.observed_at)}
                    {typeof result.confidence_score === 'number'
                      ? ` · ${Math.round(result.confidence_score * 100)}% confidence`
                      : ''}
                  </p>
                  <p>{result.summary}</p>

                  {result.strategic_insight && (
                    <p style={{ ...mutedStyle, marginBottom: 8 }}>
                      {result.strategic_insight}
                    </p>
                  )}

                  {result.topics.length > 0 && (
                    <p style={{ ...mutedStyle, marginBottom: 8 }}>
                      Topics: {result.topics.join(', ')}
                    </p>
                  )}

                  {result.source_url && (
                    <a
                      href={result.source_url}
                      target="_blank"
                      style={{ color: '#93C5FD', overflowWrap: 'anywhere' }}
                    >
                      {result.source_url}
                    </a>
                  )}
                </article>
              ))}
            </div>
          )}

          {hasQueried && !querying && !queryError && !queryAnswer && queryResults.length === 0 && (
            <p style={{ ...mutedStyle, marginBottom: 0, marginTop: 16 }}>
              No matching intelligence items yet. RivalSense is seeded with default AI companies;
              run a refresh or wait for background collection to capture changes.
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

        <section
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(280px, 0.8fr)',
            gap: 18,
          }}
        >
          <div style={{ ...cardStyle, padding: 24 }}>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0 }}>Current intelligence</h2>
              <p style={{ ...mutedStyle, marginBottom: 0 }}>
                Recent AI company changes captured from background sources.
              </p>
            </div>

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

                    <p style={mutedStyle}>
                      {new Date(change.created_at).toLocaleString()}
                    </p>

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
                  RivalSense is setting up default AI company coverage. Run a refresh to create the first baselines.
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
  Current version captured in the background. RivalSense will turn meaningful changes into searchable intelligence.
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

          <aside style={{ display: 'grid', gap: 18, alignContent: 'start' }}>
            <section style={{ ...cardStyle, padding: 22 }}>
              <h2 style={{ marginTop: 0 }}>Monitoring health</h2>

              <div style={{ display: 'grid', gap: 12 }}>
                <p style={mutedStyle}>
                  Last checked: {formatDate(health.lastCheckedAt)}
                </p>

                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <span style={statusBadgeStyle('unchanged')}>
                    {health.healthy} healthy
                  </span>
                  <span style={statusBadgeStyle(health.errors > 0 ? 'error' : 'not_checked')}>
                    {health.errors} errors
                  </span>
                </div>
              </div>
            </section>

            <section style={{ ...cardStyle, padding: 22 }}>
              <h2 style={{ marginTop: 0 }}>Priority alerts</h2>

              {highPriorityChanges.length === 0 ? (
                <p style={mutedStyle}>No high-priority alerts right now.</p>
              ) : (
                <div style={{ display: 'grid', gap: 12 }}>
                  {highPriorityChanges.slice(0, 4).map((change) => (
                    <div key={change.id}>
                      <strong>
                        {change.monitored_sources?.competitors?.name || 'System'}
                      </strong>
                      <p style={{ ...mutedStyle, marginTop: 4 }}>
                        {change.summary}
                      </p>
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
