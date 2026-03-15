import { NextRequest, NextResponse } from 'next/server';
import { runFullDriveBackup } from '@/ai/flows/google-drive-sync-flow';

/**
 * API route to trigger the automated backup.
 * Intended to be called by a Cron job.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.BACKUP_SECRET || 'CitydriveSecret123';

  // Basic security check
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const result = await runFullDriveBackup();
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "Use POST with Bearer token to trigger backup." });
}
