export const dynamic = 'force-dynamic';

import { getDatabase, pingDatabase } from '@fluxbot/db';
import { env } from '@/lib/env';

export async function GET(): Promise<Response> {
  try {
    const { db } = getDatabase();
    await pingDatabase(db);
    return Response.json({
      ok: true,
      service: 'fluxbot-web',
      instance: env.instanceOrigin || 'demo',
      version: process.env.FLUXBOT_VERSION ?? '0.1.0',
      time: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        ok: false,
        service: 'fluxbot-web',
        error: error instanceof Error ? error.message : 'unknown error',
      },
      { status: 503 },
    );
  }
}
