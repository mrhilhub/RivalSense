import { supabaseAdmin } from '@/lib/supabaseServer';

type CandidateStatus = 'pending' | 'promoted' | 'ignored' | 'rejected';
type HealthStatus = 'healthy' | 'unhealthy' | 'unknown';

type DiscoveredCompany = {
  name: string;
  domain: string;
  website: string;
  source: string;
  confidence: number;
  evidence: Record<string, unknown>;
  githubOrg?: string;
};

type SourceCandidate = {
  type: string;
  url: string;
  confidence: number;
};

type PersistedCompanyCandidate = {
  id: string;
  status: CandidateStatus;
};

type SourceProbeResult = {
  source: SourceCandidate;
  health: HealthStatus;
  httpStatus: number | null;
  resolvedUrl?: string;
};

type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

export type CompanyDiscoverySummary = {
  ownerUserId: string;
  discovered: number;
  upsertedCandidates: number;
  promotedCompanies: number;
  upsertedSources: number;
  healthySources: number;
  errors: string[];
};

const GITHUB_API = 'https://api.github.com';
const DEFAULT_DISCOVERY_LIMIT = 12;
const DEFAULT_PROMOTION_THRESHOLD = 0.65;
const MIN_HEALTHY_SOURCES_FOR_PROMOTION = 3;

function normalizeDomain(input: string) {
  const value = input.trim().toLowerCase();
  return value.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '');
}

function clampScore(value: number) {
  return Math.max(0, Math.min(0.99, Number(value.toFixed(3))));
}

function canonicalUrl(input: string) {
  try {
    const parsed = new URL(input);
    const pathname = parsed.pathname.replace(/\/$/, '') || '/';
    return `${parsed.protocol}//${parsed.host}${pathname}${parsed.search}`;
  } catch {
    const domain = normalizeDomain(input);
    return `https://${domain}`;
  }
}

function normalizeMonitoredSourceType(type: string) {
  // Backward compatibility: some deployed DBs still reject `release` in monitored_sources.type.
  if (type === 'release') {
    return 'changelog';
  }

  return type;
}

function discoveryHeaders() {
  const token = process.env.GITHUB_TOKEN;
  return {
    Accept: 'application/vnd.github+json',
    'User-Agent': 'RivalSense-Discovery/0.1',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: discoveryHeaders(),
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

function looksLikeCompany(name: string, domain: string) {
  const lowered = `${name} ${domain}`.toLowerCase();
  const blocked = [
    'awesome',
    'list',
    'community',
    'newsletter',
    'course',
    'tutorial',
    'bootcamp',
    'university',
  ];

  if (blocked.some((token) => lowered.includes(token))) {
    return false;
  }

  return /ai|model|labs|research|inference|agent|llm/.test(lowered);
}

function scoreDiscoveredCompany(input: {
  name: string;
  domain: string;
  followers: number;
  publicRepos: number;
  updatedAt?: string;
  hasWebsite: boolean;
}) {
  let score = 0.35;

  if (input.hasWebsite) score += 0.2;
  if (input.followers >= 250) score += 0.2;
  else if (input.followers >= 75) score += 0.1;

  if (input.publicRepos >= 12) score += 0.15;
  else if (input.publicRepos >= 4) score += 0.08;

  if (/ai|model|labs|inference|agent|llm/.test(`${input.name} ${input.domain}`.toLowerCase())) {
    score += 0.1;
  }

  if (input.updatedAt) {
    const ageDays = (Date.now() - Date.parse(input.updatedAt)) / (1000 * 60 * 60 * 24);
    if (ageDays <= 90) score += 0.1;
    else if (ageDays <= 180) score += 0.05;
  }

  return clampScore(score);
}

function buildSourcePlaybook(company: DiscoveredCompany): SourceCandidate[] {
  const domain = normalizeDomain(company.website);
  const root = `https://${domain}`;
  const statusHost = `https://status.${domain}`;
  const githubOrg = company.githubOrg;

  const candidates: SourceCandidate[] = [
    { type: 'website', url: root, confidence: 0.9 },
    { type: 'docs', url: `${root}/docs`, confidence: 0.8 },
    { type: 'pricing', url: `${root}/pricing`, confidence: 0.82 },
    { type: 'changelog', url: `${root}/changelog`, confidence: 0.8 },
    { type: 'release', url: `${root}/blog`, confidence: 0.72 },
    { type: 'release', url: `${root}/news`, confidence: 0.68 },
    { type: 'incident', url: statusHost, confidence: 0.72 },
  ];

  if (githubOrg) {
    candidates.push(
      { type: 'github', url: `https://github.com/${githubOrg}`, confidence: 0.86 },
      { type: 'release', url: `https://github.com/${githubOrg}/releases`, confidence: 0.84 }
    );
  }

  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${candidate.type}:${candidate.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function probeSource(candidate: SourceCandidate): Promise<SourceProbeResult> {
  try {
    const response = await fetch(candidate.url, {
      method: 'GET',
      redirect: 'follow',
      cache: 'no-store',
      signal: AbortSignal.timeout(7000),
      headers: {
        'user-agent': 'RivalSenseDiscovery/0.1',
      },
    });

    const health: HealthStatus = response.ok ? 'healthy' : 'unhealthy';

    return {
      source: candidate,
      health,
      httpStatus: response.status,
      resolvedUrl: response.url,
    };
  } catch {
    return {
      source: candidate,
      health: 'unhealthy',
      httpStatus: null,
    };
  }
}

async function discoverFromGitHub(maxCandidates: number): Promise<DiscoveredCompany[]> {
  const searches = [
    'type:org AI in:description',
    'type:org LLM in:description',
    'type:org model in:description',
  ];

  const orgLogins = new Set<string>();

  for (const query of searches) {
    const encoded = encodeURIComponent(query);
    const data = await fetchJson<{ items?: Array<{ login: string }> }>(
      `${GITHUB_API}/search/users?q=${encoded}&per_page=20`
    );

    for (const item of data?.items || []) {
      if (orgLogins.size >= maxCandidates * 2) break;
      orgLogins.add(item.login);
    }
  }

  const discovered: DiscoveredCompany[] = [];

  for (const login of Array.from(orgLogins).slice(0, maxCandidates * 2)) {
    const org = await fetchJson<{
      login: string;
      name: string | null;
      blog: string | null;
      html_url: string;
      followers: number;
      public_repos: number;
      updated_at?: string;
    }>(`${GITHUB_API}/orgs/${login}`);

    if (!org) continue;

    const blog = (org.blog || '').trim();
    const website = blog.startsWith('http://') || blog.startsWith('https://') ? blog : blog ? `https://${blog}` : '';
    const domain = website ? normalizeDomain(website) : '';

    if (!website || !domain || domain.includes('github.com')) {
      continue;
    }

    const name = org.name?.trim() || org.login;

    if (!looksLikeCompany(name, domain)) {
      continue;
    }

    const confidence = scoreDiscoveredCompany({
      name,
      domain,
      followers: org.followers || 0,
      publicRepos: org.public_repos || 0,
      updatedAt: org.updated_at,
      hasWebsite: Boolean(website),
    });

    discovered.push({
      name,
      domain,
      website: `https://${domain}`,
      source: 'github_org_discovery',
      confidence,
      githubOrg: org.login,
      evidence: {
        github_org: org.login,
        github_url: org.html_url,
        followers: org.followers,
        public_repos: org.public_repos,
        updated_at: org.updated_at,
      },
    });

    if (discovered.length >= maxCandidates) {
      break;
    }
  }

  return discovered;
}

async function upsertCompanyCandidate(
  ownerUserId: string,
  company: DiscoveredCompany
): Promise<PersistedCompanyCandidate | null> {
  const supabase = supabaseAdmin();

  const { data: existing, error: selectError } = await supabase
    .from('company_candidates')
    .select('id,status')
    .eq('owner_user_id', ownerUserId)
    .eq('domain', company.domain)
    .maybeSingle();

  if (selectError) {
    throw selectError;
  }

  if (existing) {
    const { data: updated, error } = await supabase
      .from('company_candidates')
      .update({
        name: company.name,
        website: company.website,
        discovery_source: company.source,
        confidence_score: company.confidence,
        evidence: company.evidence,
      })
      .eq('id', existing.id)
      .select('id,status')
      .single();

    if (error) {
      throw error;
    }

    return updated as PersistedCompanyCandidate;
  }

  const { data: created, error: insertError } = await supabase
    .from('company_candidates')
    .insert({
      owner_user_id: ownerUserId,
      name: company.name,
      domain: company.domain,
      website: company.website,
      discovery_source: company.source,
      confidence_score: company.confidence,
      evidence: company.evidence,
      status: 'pending',
    })
    .select('id,status')
    .single();

  if (insertError) {
    throw insertError;
  }

  return created as PersistedCompanyCandidate;
}

async function upsertSourceCandidates(
  ownerUserId: string,
  companyCandidateId: string,
  sources: SourceProbeResult[]
): Promise<{ upserted: number; healthy: number }> {
  const supabase = supabaseAdmin();
  let upserted = 0;
  let healthy = 0;

  for (const result of sources) {
    if (result.health === 'healthy') {
      healthy += 1;
    }

    const payload = {
      owner_user_id: ownerUserId,
      company_candidate_id: companyCandidateId,
      type: result.source.type,
      url: canonicalUrl(result.resolvedUrl || result.source.url),
      confidence_score: result.source.confidence,
      health_status: result.health,
      last_checked_at: new Date().toISOString(),
      last_http_status: result.httpStatus,
      evidence: {
        resolved_url: result.resolvedUrl || null,
      },
    };

    const { error } = await supabase
      .from('source_candidates')
      .upsert(payload, { onConflict: 'company_candidate_id,url' });

    if (error) {
      throw error;
    }

    upserted += 1;
  }

  return { upserted, healthy };
}

async function trySetSystemFlag(table: 'competitors' | 'monitored_sources', id: string) {
  const supabase = supabaseAdmin();
  // Best-effort only. Some environments may not yet have is_system columns.
  await supabase.from(table).update({ is_system: true }).eq('id', id);
}

function formatDiscoveryError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (error && typeof error === 'object') {
    const value = error as ErrorLike;
    const parts = [value.message, value.details, value.hint, value.code].filter(Boolean);

    if (parts.length > 0) {
      return parts.join(' | ');
    }
  }

  return String(error);
}

async function promoteCandidateToCompetitor(
  ownerUserId: string,
  candidateId: string,
  company: DiscoveredCompany,
  sources: SourceProbeResult[]
) {
  const supabase = supabaseAdmin();

  const { data: existingCompetitor } = await supabase
    .from('competitors')
    .select('id')
    .eq('user_id', ownerUserId)
    .eq('name', company.name)
    .maybeSingle();

  let competitorId = existingCompetitor?.id || null;

  if (!competitorId) {
    const { data: createdCompetitor, error: competitorError } = await supabase
      .from('competitors')
      .insert({
        user_id: ownerUserId,
        name: company.name,
        website: company.website,
      })
      .select('id')
      .single();

    if (competitorError) {
      throw competitorError;
    }

    competitorId = createdCompetitor.id;
  } else {
    await supabase
      .from('competitors')
      .update({ website: company.website })
      .eq('id', competitorId);
  }

  try {
    await trySetSystemFlag('competitors', competitorId);
  } catch {
    // Ignore best-effort system flag failures.
  }

  for (const result of sources.filter((source) => source.health === 'healthy')) {
    const url = result.resolvedUrl || result.source.url;
    const monitoredSourceType = normalizeMonitoredSourceType(result.source.type);

    const { data: existingSource } = await supabase
      .from('monitored_sources')
      .select('id')
      .eq('user_id', ownerUserId)
      .eq('competitor_id', competitorId)
      .eq('type', monitoredSourceType)
      .eq('url', url)
      .maybeSingle();

    if (existingSource?.id) {
      await supabase
        .from('monitored_sources')
        .update({ active: true })
        .eq('id', existingSource.id);

      try {
        await trySetSystemFlag('monitored_sources', existingSource.id);
      } catch {
        // Ignore best-effort system flag failures.
      }
      continue;
    }

    const { data: createdSource, error: sourceInsertError } = await supabase
      .from('monitored_sources')
      .insert({
        user_id: ownerUserId,
        competitor_id: competitorId,
        type: monitoredSourceType,
        url,
        active: true,
        last_status: 'not_checked',
      })
      .select('id')
      .single();

    if (sourceInsertError) {
      throw sourceInsertError;
    }

    try {
      await trySetSystemFlag('monitored_sources', createdSource.id);
    } catch {
      // Ignore best-effort system flag failures.
    }
  }

  const { error: updateCandidateError } = await supabase
    .from('company_candidates')
    .update({
      status: 'promoted',
      promoted_competitor_id: competitorId,
      promoted_at: new Date().toISOString(),
    })
    .eq('id', candidateId);

  if (updateCandidateError) {
    throw updateCandidateError;
  }
}

function shouldPromoteCandidate(confidence: number, healthySourceCount: number, sources: SourceProbeResult[]) {
  if (confidence < DEFAULT_PROMOTION_THRESHOLD) {
    return false;
  }

  if (healthySourceCount < MIN_HEALTHY_SOURCES_FOR_PROMOTION) {
    return false;
  }

  const healthyTypes = new Set(
    sources
      .filter((source) => source.health === 'healthy')
      .map((source) => source.source.type)
  );

  const hasKnowledgeSurface =
    healthyTypes.has('docs') || healthyTypes.has('website') || healthyTypes.has('github');
  const hasMarketSignal =
    healthyTypes.has('release') || healthyTypes.has('changelog') || healthyTypes.has('pricing');

  return hasKnowledgeSurface && hasMarketSignal;
}

export async function runCompanyDiscoveryForUser(
  ownerUserId: string,
  options?: {
    maxCandidates?: number;
  }
): Promise<CompanyDiscoverySummary> {
  const maxCandidates = Math.max(4, Math.min(25, options?.maxCandidates ?? DEFAULT_DISCOVERY_LIMIT));
  const errors: string[] = [];

  const discovered = await discoverFromGitHub(maxCandidates);

  let upsertedCandidates = 0;
  let promotedCompanies = 0;
  let upsertedSources = 0;
  let healthySources = 0;

  for (const company of discovered) {
    try {
      const persisted = await upsertCompanyCandidate(ownerUserId, company);
      if (!persisted) {
        continue;
      }

      upsertedCandidates += 1;

      const sourceCandidates = buildSourcePlaybook(company);
      const probeResults: SourceProbeResult[] = [];

      for (const source of sourceCandidates) {
        const result = await probeSource(source);
        probeResults.push(result);
      }

      const sourceSummary = await upsertSourceCandidates(ownerUserId, persisted.id, probeResults);
      upsertedSources += sourceSummary.upserted;
      healthySources += sourceSummary.healthy;

      if (
        persisted.status !== 'promoted' &&
        shouldPromoteCandidate(company.confidence, sourceSummary.healthy, probeResults)
      ) {
        await promoteCandidateToCompetitor(ownerUserId, persisted.id, company, probeResults);
        promotedCompanies += 1;
      }
    } catch (error) {
      const message = formatDiscoveryError(error);
      errors.push(`${company.name}: ${message}`);
    }
  }

  return {
    ownerUserId,
    discovered: discovered.length,
    upsertedCandidates,
    promotedCompanies,
    upsertedSources,
    healthySources,
    errors,
  };
}
