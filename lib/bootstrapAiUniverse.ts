import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultAiCompanies } from './aiCompanyUniverse';
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

async function getOrCreateCompetitor(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  website: string,
  dryRun = false
) {
  const { data: existing, error: lookupError } = await supabase
    .from('competitors')
    .select('id,name,website,is_system')
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

    const { error: updateError } = await supabase
      .from('competitors')
      .update({
        website,
        is_system: true,
      })
      .eq('id', existing.id);

    if (updateError) {
      throw updateError;
    }

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
      is_system: true,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

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

async function historicItemExists(
  supabase: SupabaseClient,
  userId: string,
  seedKey: string
) {
  const { data, error } = await supabase
    .from('intelligence_items')
    .select('id')
    .eq('user_id', userId)
    .contains('metadata', { seed_key: seedKey })
    .maybeSingle();

  if (error) {
    throw error;
  }

  return Boolean(data);
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
      const exists = await sourceExists(supabase, userId, competitorId, url, source.type);

      if (exists) {
        continue;
      }

      if (dryRun) {
        log(`[DRY RUN] Would add ${company.name} → ${source.type}: ${url}`);
        createdSources += 1;
        continue;
      }

      const { error } = await supabase.from('monitored_sources').insert({
        user_id: userId,
        competitor_id: competitorId,
        type: source.type,
        url,
        active: true,
        last_status: 'not_checked',
        is_system: true,
      });

      if (error) {
        throw error;
      }

      createdSources += 1;
    }

    if (!seedHistorical) {
      continue;
    }

    const historicalSeeds = getHistoricSeedsForCompany(company.name);

    for (const seed of historicalSeeds) {
      const seedKey = `${normalizeKey(company.name)}:${normalizeKey(seed.title)}:${normalizeUrl(seed.sourceUrl)}`;
      const exists = await historicItemExists(supabase, userId, seedKey);

      if (exists) {
        continue;
      }

      if (dryRun) {
        log(`[DRY RUN] Would add historic item for ${company.name}: ${seed.title}`);
        createdHistoricalItems += 1;
        continue;
      }

      const { data: sourceMatch, error: sourceError } = await supabase
        .from('monitored_sources')
        .select('id')
        .eq('user_id', userId)
        .eq('competitor_id', competitorId)
        .eq('type', seed.sourceType)
        .eq('url', normalizeUrl(seed.sourceUrl))
        .maybeSingle();

      if (sourceError) {
        throw sourceError;
      }

      const { error } = await supabase.from('intelligence_items').insert({
        user_id: userId,
        company_id: competitorId,
        source_id: sourceMatch?.id || null,
        title: seed.title,
        summary: seed.summary,
        strategic_insight: seed.strategicInsight,
        category: seed.category,
        topics: seed.topics,
        source_url: normalizeUrl(seed.sourceUrl),
        observed_at: observedAtFromDaysAgo(seed.daysAgo),
        confidence_score: seed.confidenceScore ?? 0.75,
        metadata: {
          seed_key: seedKey,
          seeded: true,
          seeded_company: company.name,
          seeded_source_type: seed.sourceType,
          seeded_source_url: normalizeUrl(seed.sourceUrl),
        },
        language: 'en',
        original_title: seed.title,
        custom_tags: ['historic-seed', 'demo'],
        source_quality_score: 0.800,
        is_reviewed: true,
        is_dismissed: false,
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