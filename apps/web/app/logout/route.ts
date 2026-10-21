import { NextResponse } from 'next/server';
import { logout } from '@/lib/auth';
import { env } from '@/lib/env';

export async function POST(): Promise<NextResponse> {
  await logout();
  return NextResponse.redirect(new URL('/', env.dashboardOrigin));
}
