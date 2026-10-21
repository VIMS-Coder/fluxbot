import { NextResponse } from 'next/server';
import { startDemoLogin, startLogin } from '@/lib/auth';
import { env } from '@/lib/env';

export async function GET(): Promise<NextResponse> {
  try {
    if (env.demoMode) {
      await startDemoLogin();
      return NextResponse.redirect(new URL('/guilds', env.dashboardOrigin));
    }

    const url = await startLogin();
    return NextResponse.redirect(url);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Could not start the login flow';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, env.dashboardOrigin),
    );
  }
}
