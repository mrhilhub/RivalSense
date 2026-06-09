import { NextRequest, NextResponse } from 'next/server';
import { defaultAiCompanies } from '@/lib/defaultAiCompanies';
import { supabaseAdmin } from '@/lib/supabaseServer';

export async function POST(req: NextRequest) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = supabaseAdmin();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: existingCompanies, error: companiesError } = await supabase
    .from('competitors')
    .select('id,name')
    .eq('user_id', user.id);

  if (companiesError) {
    return NextResponse.json({ error: companiesError.message }, { status: 500 });
  }

  const companiesByName = new Map(
    (existingCompanies || []).map((company) => [
      String(company.name).trim().toLowerCase(),
      company.id as string,
    ])
  );

  let companiesCreated = 0;
  let sourcesCreated = 0;

  for (const company of defaultAiCompanies) {
    const key = company.name.trim().toLowerCase();
    let companyId = companiesByName.get(key);

    if (!companyId) {
      const { data: createdCompany, error: createCompanyError } = await supabase
        .from('competitors')
        .insert({
          user_id: user.id,
          name: company.name,
          website: company.website,
        })
        .select('id')
        .single();

      if (createCompanyError) {
        return NextResponse.json(
          { error: createCompanyError.message },
          { status: 500 }
        );
      }

      const createdCompanyId = createdCompany?.id;

      if (!createdCompanyId) {
        return NextResponse.json(
          { error: `Failed to create ${company.name}` },
          { status: 500 }
        );
      }

      companyId = createdCompanyId;
      companiesByName.set(key, companyId);
      companiesCreated += 1;
    }

    if (!companyId) {
      return NextResponse.json(
        { error: `Missing company id for ${company.name}` },
        { status: 500 }
      );
    }

    const { data: existingSources, error: sourcesError } = await supabase
      .from('monitored_sources')
      .select('url')
      .eq('user_id', user.id)
      .eq('competitor_id', companyId);

    if (sourcesError) {
      return NextResponse.json({ error: sourcesError.message }, { status: 500 });
    }

    const existingUrls = new Set(
      (existingSources || []).map((source) => String(source.url).trim())
    );
    const sourceRows = company.sources
      .filter((source) => !existingUrls.has(source.url))
      .map((source) => ({
        user_id: user.id,
        competitor_id: companyId,
        type: source.type,
        url: source.url,
        active: true,
        last_status: 'not_checked',
      }));

    if (sourceRows.length > 0) {
      const { error: createSourcesError } = await supabase
        .from('monitored_sources')
        .insert(sourceRows);

      if (createSourcesError) {
        return NextResponse.json(
          { error: createSourcesError.message },
          { status: 500 }
        );
      }

      sourcesCreated += sourceRows.length;
    }
  }

  return NextResponse.json({
    companies_created: companiesCreated,
    sources_created: sourcesCreated,
  });
}
