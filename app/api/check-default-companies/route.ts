import { NextResponse } from 'next/server';
import { runSourceChecks } from '@/lib/runSourceChecks';

export const maxDuration = 60;

export async function GET() {
  try {
    const result = await runSourceChecks('system');

    return NextResponse.json(result);
  } catch (error) {
    console.error('Default-company check failed:', error);

    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Default-company check failed',
      },
      { status: 500 }
    );
  }
}