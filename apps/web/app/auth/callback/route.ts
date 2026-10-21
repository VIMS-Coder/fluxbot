import { NextResponse } from 'next/server';
import { completeLogin } from '@/lib/auth';
import { env } from '@/lib/env';

export async function GET(request: Request): Promise<NextResponse> {
  const url = new URL(request.url);
  const error = url.searchParams.get('error');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (error) {
    return NextResponse.redirect(
      new URL(
        `/login?error=${encodeURIComponent(`Fluxer returned: ${error}`)}`,
        env.dashboardOrigin,
      ),
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL('/login?error=Missing%20authorization%20code', env.dashboardOrigin),
    );
  }

  try {
    await completeLogin({
      code,
      state,
      userAgent: request.headers.get('user-agent'),
      ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    });
  } catch (loginError) {
    const message = loginError instanceof Error ? loginError.message : 'Could not complete login';
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(message)}`, env.dashboardOrigin),
    );
  }

  return NextResponse.redirect(new URL('/guilds', env.dashboardOrigin));
}
