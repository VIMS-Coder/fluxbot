/**
 * Dashboard runtime configuration.
 *
 * Secrets are read lazily by the auth helpers so `next build` does not need a
 * fully configured environment; runtime requests still fail loudly when a
 * required value is missing.
 */

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(
      `Missing ${name}. Set it in .env (see .env.example) and restart the dashboard.`,
    );
  }
  return value;
}

export const env = {
  instanceOrigin: process.env.FLUXER_INSTANCE_ORIGIN?.trim() ?? '',
  dashboardOrigin: (process.env.DASHBOARD_ORIGIN?.trim() ?? 'http://localhost:3000').replace(
    /\/+$/,
    '',
  ),
  get appId() {
    return env.demoMode
      ? (process.env.FLUXER_APP_ID ?? '900000000000000001')
      : required('FLUXER_APP_ID');
  },
  get clientSecret() {
    return env.demoMode
      ? (process.env.FLUXER_CLIENT_SECRET ?? 'demo-secret')
      : required('FLUXER_CLIENT_SECRET');
  },
  get botToken() {
    return env.demoMode
      ? (process.env.FLUXER_BOT_TOKEN ?? 'demo-token')
      : required('FLUXER_BOT_TOKEN');
  },
  get sessionSecret() {
    return env.demoMode
      ? (process.env.SESSION_SECRET ?? 'demo-session-secret')
      : required('SESSION_SECRET');
  },
  get encryptionKey() {
    return env.demoMode
      ? (process.env.ENCRYPTION_KEY ?? 'demo-encryption-key')
      : required('ENCRYPTION_KEY');
  },
  demoMode: process.env.DEMO_MODE === 'true',
  secureCookies: (process.env.DASHBOARD_ORIGIN ?? '').startsWith('https://'),
};

export const redirectUri = `${env.dashboardOrigin}/auth/callback`;
