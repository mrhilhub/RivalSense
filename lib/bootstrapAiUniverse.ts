import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultAiCompanies } from './aiCompanyUniverse';
import { generateIntelligenceEmbedding } from './embeddings';
import { getHistoricSeedsForCompany } from './historicIntelligenceSeeds';

function normalizeUrl(url: string) {
  return url.trim().replace(/\/$/, '');
}

function normalizeKey(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}

function observedAtFromDaysAgo(daysAgo: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - daysAgo);
  return date.toISOString();
}

// is_system requires migration 202606300001_system_ai_universe.sql.
// We set it best-effort so bootstrap works even before the migration is applied.
async function trySetSystemFlag(
  supabase: SupabaseClient,
  table: string,
  id: string
) {
  await supabase.from(table).update({ is_system: true }).eq('id', id);
  // Ignore errors — column may not exist yet in production.
}

async function getOrCreateCompetitor(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  website: string,
  dryRun = false
) {
  const { data: existing, error: lookupError } = await supabase
    .from('competitors')
    .select('id,name,website')
    .eq('user_id', userId)
    .or(`name.eq.${name},website.eq.${website}`)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (existing) {
    if (dryRun) {
      return existing.id as string;
    }

    await supabase
      .from('competitors')
      .update({ website })
      .eq('id', existing.id);

    await trySetSystemFlag(supabase, 'competitors', existing.id);

    return existing.id as string;
  }

  if (dryRun) {
    return 'dry-run-competitor-id';
  }

  const { data, error } = await supabase
    .from('competitors')
    .insert({
      user_id: userId,
      name,
      website,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  await trySetSystemFlag(supabase, 'competitors', data.id);

  return data.id as string;
}

async function sourceExists(
  supabase: SupabaseClient,
  userId: string,
  competitorId: string,
  url: string,
  type: string
) {
  const { data, error } = await supabase
    .from('monitored_sources')
    .select('id')
    .eq('user_id', userId)
    .eq('competitor_id', competitorId)
    .eq('type', type)
    .eq('url', url)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function replaceLegacySourceUrl(
  supabase: SupabaseClient,
  userId: string,
  competitorId: string,
  type: string,
  url: string,
  legacyUrls?: string[]
) {
  if (!legacyUrls || legacyUrls.length === 0) {
    return false;
  }

  const normalizedLegacyUrls = legacyUrls.map((legacyUrl) => normalizeUrl(legacyUrl));

  const { data: existing, error } = await supabase
    .from('monitored_sources')
    .select('id,url')
    .eq('user_id', userId)
    .eq('competitor_id', competitorId)
    .eq('type', type)
    .in('url', normalizedLegacyUrls)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!existing) {
    return false;
  }

  await supabase
    .from('monitored_sources')
    .update({
      url,
      active: true,
      last_status: 'not_checked',
      last_checked_at: null,
    })
    .eq('id', existing.id);

  await trySetSystemFlag(supabase, 'monitored_sources', existing.id);

  return true;
}

type HistoricItemRecord = {
  id: string;
  source_id?: string | null;
  source_url?: string | null;
  embedding?: number[] | null;
};

async function findHistoricItem(
  supabase: SupabaseClient,
  userId: string,
  seedKey: string
) {
  const { data, error } = await supabase
    .from('intelligence_items')
    .select('id,source_id,source_url,embedding')
    .eq('user_id', userId)
    .contains('metadata', { seed_key: seedKey })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as HistoricItemRecord | null) || null;
}

function getCanonicalSourceUrl(companyName: string, sourceType: string, fallbackUrl: string) {
  const company = defaultAiCompanies.find((candidate) => candidate.name === companyName);
  const matchingSource = company?.sources.find((source) => source.type === sourceType);

  return normalizeUrl(matchingSource?.url || fallbackUrl);
}

async function ensureHistoricItemEmbedding(
  supabase: SupabaseClient,
  itemId: string,
  title: string,
  summary: string,
  strategicInsight: string
) {
  const embedding = await generateIntelligenceEmbedding(title, summary, strategicInsight);

  const { error } = await supabase
    .from('intelligence_items')
    .update({ embedding })
    .eq('id', itemId);

  if (error) {
    throw error;
  }
}

export async function bootstrapAiUniverseForUser(
  supabase: SupabaseClient,
  userId: string,
  options?: {
    dryRun?: boolean;
    seedHistorical?: boolean;
    log?: (message: string) => void;
  }
) {
  const dryRun = options?.dryRun ?? false;
  const seedHistorical = options?.seedHistorical ?? true;
  const log = options?.log ?? (() => {});

  let createdCompanies = 0;
  let createdSources = 0;
  let createdHistoricalItems = 0;

  for (const company of defaultAiCompanies) {
    const competitorId = await getOrCreateCompetitor(
      supabase,
      userId,
      company.name,
      normalizeUrl(company.website),
      dryRun
    );

    createdCompanies += 1;

    for (const source of company.sources) {
      const url = normalizeUrl(source.url);
      const repairedLegacySource = await replaceLegacySourceUrl(
        supabase,
        userId,
        competitorId,
        source.type,
        url,
        source.legacyUrls
      );

      if (repairedLegacySource) {
        createdSources += 1;
        log(`Updated ${company.name} → ${source.type}: ${url}`);
        continue;
      }

      const exists = await sourceExists(supabase, userId, competitorId, url, source.type);

      if (exists) {
        continue;
      }

      if (dryRun) {
        log(`[DRY RUN] Would add ${company.name} → ${source.type}: ${url}`);
        createdSources += 1;
        continue;
      }

      const { error, data: inserted } = await supabase
        .from('monitored_sources')
        .insert({
          user_id: userId,
          competitor_id: competitorId,
          type: source.type,
          url,
          active: true,
          last_status: 'not_checked',
        })
        .select('id')
        .single();

      if (error) {
        throw error;
      }

      if (inserted?.id) {
        await trySetSystemFlag(supabase, 'monitored_sources', inserted.id);
      }

      createdSources += 1;
    }

    if (!seedHistorical) {
      continue;
    }

    const historicalSeeds = getHistoricSeedsForCompany(company.name);

    for (const seed of historicalSeeds) {
      const canonicalSourceUrl = getCanonicalSourceUrl(company.name, seed.sourceType, seed.sourceUrl);
      const seedKey = `${normalizeKey(company.name)}:${normalizeKey(seed.title)}:${canonicalSourceUrl}`;
      const existingHistoricItem = await findHistoricItem(supabase, userId, seedKey);

      const { data: sourceMatch, error: sourceError } = await supabase
        .from('monitored_sources')
        .select('id')
        .eq('user_id', userId)
        .eq('competitor_id', competitorId)
        .eq('type', seed.sourceType)
        .eq('url', canonicalSourceUrl)
        .maybeSingle();

      if (sourceError) {
        throw sourceError;
      }

      if (existingHistoricItem) {
        const needsUpdate =
          existingHistoricItem.source_id !== (sourceMatch?.id || null) ||
          normalizeUrl(existingHistoricItem.source_url || '') !== canonicalSourceUrl;

        if (needsUpdate) {
          const { error } = await supabase
            .from('intelligence_items')
            .update({
              source_id: sourceMatch?.id || null,
              source_url: canonicalSourceUrl,
              metadata: {
                seed_key: seedKey,
                seeded: true,
                seeded_company: company.name,
                seeded_source_type: seed.sourceType,
                seeded_source_url: canonicalSourceUrl,
              },
            })
            .eq('id', existingHistoricItem.id);

          if (error) {
            throw error;
          }
        }

        if (!existingHistoricItem.embedding) {
          await ensureHistoricItemEmbedding(
            supabase,
            existingHistoricItem.id,
            seed.title,
            seed.summary,
            seed.strategicInsight
          );
          log(`Embedded historic item for ${company.name}: ${seed.title}`);
        }

        continue;
      }

      if (dryRun) {
        log(`[DRY RUN] Would add historic item for ${company.name}: ${seed.title}`);
        createdHistoricalItems += 1;
        continue;
      }

      const embedding = await generateIntelligenceEmbedding(
        seed.title,
        seed.summary,
        seed.strategicInsight
      );

      const { error } = await supabase.from('intelligence_items').insert({
        user_id: userId,
        company_id: competitorId,
        source_id: sourceMatch?.id || null,
        title: seed.title,
        summary: seed.summary,
        strategic_insight: seed.strategicInsight,
        category: seed.category,
        topics: seed.topics,
        source_url: canonicalSourceUrl,
        observed_at: observedAtFromDaysAgo(seed.daysAgo),
        confidence_score: seed.confidenceScore ?? 0.75,
        metadata: {
          seed_key: seedKey,
          seeded: true,
          seeded_company: company.name,
          seeded_source_type: seed.sourceType,
          seeded_source_url: canonicalSourceUrl,
        },
        language: 'en',
        original_title: seed.title,
        custom_tags: ['historic-seed', 'demo'],
        source_quality_score: 0.800,
        is_reviewed: true,
        is_dismissed: false,
        embedding,
      });

      if (error) {
        throw error;
      }

      createdHistoricalItems += 1;
      log(`✅ Added historic item for ${company.name}: ${seed.title}`);
    }
  }

  return {
    createdCompanies,
    createdSources,
    createdHistoricalItems,
  };
}