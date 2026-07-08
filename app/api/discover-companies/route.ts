import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import { runCompanyDiscoveryForUser } from '@/lib/companyDiscovery';
import { getSharedOwnerUserId } from '@/lib/sharedOwner';

export const maxDuration = 60;

function parseLimit(value: string | null) {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return undefined;
  return Math.max(4, Math.min(25, parsed));
}

async function getUserIdFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');

  if (!authHeader) {
    return process.env.DISCOVERY_OWNER_USER_ID || null;
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    }
  );

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return null;
  }

  return user.id;
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getUserIdFromRequest(req);
    const ownerUserId = getSharedOwnerUserId(userId);

    if (!ownerUserId) {
      return NextResponse.json(
        {
          error:
            'Missing user context. Provide Authorization header or set DISCOVERY_OWNER_USER_ID for cron runs.',
        },
        { status: 401 }
      );
    }

    const limit = parseLimit(req.nextUrl.searchParams.get('limit'));
    const result = await runCompanyDiscoveryForUser(ownerUserId, {
      maxCandidates: limit,
    });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('Company discovery failed:', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Company discovery failed',
      },
      { status: 500 }
    );
  }
}
