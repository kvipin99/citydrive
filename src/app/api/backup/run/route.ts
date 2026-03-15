import { NextRequest, NextResponse } from 'next/server';
import { runFullDriveBackup } from '@/ai/flows/google-drive-sync-flow';

/**
 * API route to trigger the automated daily backup.
 * Intended to be called by a Cron job or scheduled trigger.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  const secret = process.env.BACKUP_SECRET || 'CitydriveSecret123';

  // Basic security check to prevent unauthorized triggers
  if (!authHeader || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    console.log("[CRON] Daily Drive backup trigger received.");
    const result = await runFullDriveBackup();
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("[CRON] Backup trigger failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({ message: "Use POST with Bearer token to trigger backup." });
}
