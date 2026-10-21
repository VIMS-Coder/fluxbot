import {
  decryptSecret,
  encryptSecret,
  randomToken,
  sha256,
  signValue,
  verifySignedValue,
} from '@fluxbot/core';
import {
  createSession,
  deleteSession,
  getSessionWithUser,
  type SessionWithUser,
  syncUserGuilds,
  updateSessionTokens,
  upsertUser,
} from '@fluxbot/db';
import {
  buildAuthorizeUrl,
  createPkcePair,
  exchangeCode,
  fetchOAuthUser,
  fetchUserGuilds,
  refreshAccessToken,
} from '@fluxbot/fluxer';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { getDb } from './db';
import { ensureDemoData, getDemoUser } from './demo';
import { env, redirectUri } from './env';
import { getDiscovery, getInstance } from './instance';

const SESSION_COOKIE = 'fluxbot_session';
const OAUTH_COOKIE = 'fluxbot_oauth';
const SESSION_DAYS = 30;
const OAUTH_TTL_SECONDS = 10 * 60;

interface OAuthState {
  state: string;
  verifier: string;
  createdAt: number;
}

function sessionCookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: env.secureCookies,
    path: '/',
    maxAge,
  };
}

function encodeState(payload: OAuthState): string {
  const raw = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return signValue(raw, env.sessionSecret);
}

function decodeState(value: string): OAuthState | null {
  const raw = verifySignedValue(value, env.sessionSecret);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as OAuthState;
    if (!parsed.state || !parsed.verifier) return null;
    if (Date.now() - parsed.createdAt > OAUTH_TTL_SECONDS * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Build the instance consent URL and remember the PKCE verifier. */
export async function startLogin(): Promise<string> {
  const discovery = await getDiscovery();
  const { verifier, challenge } = await createPkcePair();
  const state = randomToken(16);

  const store = await cookies();
  store.set(
    OAUTH_COOKIE,
    encodeState({ state, verifier, createdAt: Date.now() }),
    sessionCookieOptions(OAUTH_TTL_SECONDS),
  );

  return buildAuthorizeUrl({
    webapp: discovery.endpoints.webapp,
    clientId: env.appId,
    redirectUri,
    scopes: ['identify', 'guilds'],
    state,
    codeChallenge: challenge,
  });
}

/** Demo login: no Fluxer instance required. */
export async function startDemoLogin(): Promise<void> {
  await ensureDemoData();
  const instance = await getInstance();
  const user = await getDemoUser();

  const token = randomToken(32);
  const db = getDb();
  await createSession(db, {
    userId: user.id,
    tokenHash: sha256(token),
    accessTokenEnc: encryptSecret('demo-access-token', env.encryptionKey),
    refreshTokenEnc: encryptSecret('demo-refresh-token', env.encryptionKey),
    accessExpiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    userAgent: 'demo',
    ip: null,
  });
  void instance;

  const store = await cookies();
  store.set(SESSION_COOKIE, token, sessionCookieOptions(SESSION_DAYS * 24 * 60 * 60));
}

/** Exchange the code, upsert the user, sync guilds and open a session. */
export async function completeLogin(input: {
  code: string;
  state: string;
  userAgent: string | null;
  ip: string | null;
}): Promise<void> {
  const store = await cookies();
  const raw = store.get(OAUTH_COOKIE)?.value;
  if (!raw) throw new Error('Login expired — please start again.');

  const expected = decodeState(raw);
  if (!expected || expected.state !== input.state) {
    throw new Error('Invalid login state — please start again.');
  }

  const discovery = await getDiscovery();
  const instance = await getInstance();
  const db = getDb();

  const token = await exchangeCode({
    discovery,
    clientId: env.appId,
    clientSecret: env.clientSecret,
    redirectUri,
    code: input.code,
    codeVerifier: expected.verifier,
  });

  const info = await fetchOAuthUser({ discovery, accessToken: token.access_token });
  const user = await upsertUser(db, instance.id, {
    fluxerId: info.id,
    username: info.username,
    globalName: info.global_name,
    avatar: info.avatar,
    email: info.email ?? null,
  });

  const guilds = await fetchUserGuilds({ discovery, accessToken: token.access_token });
  await syncUserGuilds(
    db,
    instance.id,
    user.id,
    guilds.map((guild) => ({
      guildId: guild.id,
      name: guild.name,
      icon: guild.icon,
      permissions: guild.permissions ?? '0',
      isOwner: guild.owner ?? false,
      ownerFluxerId: info.id,
    })),
  );

  const sessionToken = randomToken(32);
  await createSession(db, {
    userId: user.id,
    tokenHash: sha256(sessionToken),
    accessTokenEnc: encryptSecret(token.access_token, env.encryptionKey),
    refreshTokenEnc: encryptSecret(token.refresh_token, env.encryptionKey),
    accessExpiresAt: new Date(Date.now() + token.expires_in * 1000),
    refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
    userAgent: input.userAgent,
    ip: input.ip,
  });

  store.set(SESSION_COOKIE, sessionToken, sessionCookieOptions(SESSION_DAYS * 24 * 60 * 60));
  store.delete(OAUTH_COOKIE);
}

/** Read the current session (per-request cached). */
export const getSession = cache(async (): Promise<SessionWithUser | null> => {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const row = await getSessionWithUser(getDb(), sha256(token));
  if (!row) return null;
  if (row.session.expiresAt.getTime() <= Date.now()) return null;
  return row;
});

export async function requireSession(): Promise<SessionWithUser> {
  const session = await getSession();
  if (!session) redirect('/login');
  return session;
}

export async function logout(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    const row = await getSessionWithUser(getDb(), sha256(token));
    if (row) await deleteSession(getDb(), row.session.id);
  }
  store.delete(SESSION_COOKIE);
}

/**
 * Return a usable OAuth access token, refreshing it in place when it is close
 * to expiry. Refresh tokens rotate, so the new pair is persisted.
 */
export async function getAccessToken(session: SessionWithUser): Promise<string> {
  if (env.demoMode) return 'demo-access-token';

  const access = session.session.accessTokenEnc;
  const expiresAt = session.session.accessExpiresAt?.getTime() ?? 0;
  if (access && expiresAt > Date.now() + 60_000) {
    return decryptSecret(access, env.encryptionKey);
  }

  const refresh = session.session.refreshTokenEnc;
  if (!refresh) {
    await logout();
    redirect('/login');
  }

  try {
    const discovery = await getDiscovery();
    const token = await refreshAccessToken({
      discovery,
      clientId: env.appId,
      clientSecret: env.clientSecret,
      refreshToken: decryptSecret(refresh, env.encryptionKey),
    });

    await updateSessionTokens(getDb(), session.session.id, {
      accessTokenEnc: encryptSecret(token.access_token, env.encryptionKey),
      refreshTokenEnc: encryptSecret(token.refresh_token, env.encryptionKey),
      accessExpiresAt: new Date(Date.now() + token.expires_in * 1000),
      refreshExpiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    return token.access_token;
  } catch {
    await logout();
    redirect('/login?error=session-expired');
  }
}

/** Re-read the caller's guilds and permission masks from Fluxer. */
export async function syncGuildsForSession(session: SessionWithUser): Promise<void> {
  if (env.demoMode) return;
  const discovery = await getDiscovery();
  const accessToken = await getAccessToken(session);
  const guilds = await fetchUserGuilds({ discovery, accessToken });

  await syncUserGuilds(
    getDb(),
    session.instance.id,
    session.user.id,
    guilds.map((guild) => ({
      guildId: guild.id,
      name: guild.name,
      icon: guild.icon,
      permissions: guild.permissions ?? '0',
      isOwner: guild.owner ?? false,
      ownerFluxerId: session.user.fluxerId,
    })),
  );
}
