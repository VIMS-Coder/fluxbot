import { apiUrl, type FetchLike } from './discovery';
import type { InstanceDiscovery } from './types';
import {
  type ApplicationMe,
  FluxerApiError,
  type GatewayBotInfo,
  type GuildSummary,
  type OAuthErrorBody,
  type OAuthToken,
  type OAuthUserInfo,
} from './types';

const TIMEOUT_MS = 15_000;

function toBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

export interface PkcePair {
  verifier: string;
  challenge: string;
  method: 'S256';
}

export async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return toBase64Url(new Uint8Array(digest));
}

export async function createPkcePair(): Promise<PkcePair> {
  const random = crypto.getRandomValues(new Uint8Array(32));
  const verifier = toBase64Url(random);
  const challenge = await pkceChallenge(verifier);
  return {
    verifier,
    challenge,
    method: 'S256',
  };
}

export interface AuthorizeUrlOptions {
  webapp: string;
  clientId: string;
  redirectUri: string;
  scopes?: string[];
  state: string;
  codeChallenge?: string;
  guildId?: string;
  prompt?: 'consent' | 'none';
}

/**
 * Build the URL that sends the browser to the instance's own consent screen.
 * Fluxer handles login and consent on `endpoints.webapp`.
 */
export function buildAuthorizeUrl(options: AuthorizeUrlOptions): string {
  const url = new URL(`${options.webapp.replace(/\/+$/, '')}/oauth2/authorize`);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('redirect_uri', options.redirectUri);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('scope', (options.scopes ?? ['identify', 'guilds']).join(' '));
  url.searchParams.set('state', options.state);
  if (options.codeChallenge) {
    url.searchParams.set('code_challenge', options.codeChallenge);
    url.searchParams.set('code_challenge_method', 'S256');
  }
  if (options.guildId) url.searchParams.set('guild_id', options.guildId);
  if (options.prompt) url.searchParams.set('prompt', options.prompt);
  return url.toString();
}

/** Build a bot install URL. `permissions` is a decimal permission mask. */
export function buildInviteUrl(options: {
  webapp: string;
  clientId: string;
  permissions?: bigint | string;
  guildId?: string;
  disableGuildSelect?: boolean;
}): string {
  const url = new URL(`${options.webapp.replace(/\/+$/, '')}/oauth2/authorize`);
  url.searchParams.set('client_id', options.clientId);
  url.searchParams.set('scope', 'bot');
  if (options.permissions !== undefined) {
    url.searchParams.set('permissions', String(options.permissions));
  }
  if (options.guildId) url.searchParams.set('guild_id', options.guildId);
  if (options.disableGuildSelect) url.searchParams.set('disable_guild_select', 'true');
  return url.toString();
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: Record<string, string>;
  token?: string;
  tokenPrefix?: 'Bot' | 'Bearer';
  fetch?: FetchLike;
  signal?: AbortSignal;
}

async function request<T>(
  discovery: InstanceDiscovery,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const fetchImpl = options.fetch ?? fetch;
  const headers: Record<string, string> = { accept: 'application/json' };

  let body: string | undefined;
  if (options.form) {
    headers['content-type'] = 'application/x-www-form-urlencoded';
    body = new URLSearchParams(options.form).toString();
  } else if (options.body !== undefined) {
    headers['content-type'] = 'application/json';
    body = JSON.stringify(options.body);
  }
  if (options.token) {
    headers.authorization = `${options.tokenPrefix ?? 'Bearer'} ${options.token}`;
  }

  const response = await fetchImpl(apiUrl(discovery, path), {
    method: options.method ?? 'GET',
    headers,
    body,
    signal: options.signal ?? AbortSignal.timeout(TIMEOUT_MS),
  });

  const text = await response.text();
  let parsed: unknown = null;
  if (text) {
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = text;
    }
  }

  if (!response.ok) {
    const oauth = parsed as Partial<OAuthErrorBody> | null;
    const code =
      oauth && typeof oauth.error === 'string'
        ? oauth.error
        : typeof (parsed as { code?: unknown })?.code === 'string'
          ? String((parsed as { code: string }).code)
          : `HTTP_${response.status}`;
    const message =
      (oauth && typeof oauth.error_description === 'string' && oauth.error_description) ||
      (parsed as { message?: string })?.message ||
      `Fluxer API returned HTTP ${response.status}`;
    throw new FluxerApiError(response.status, code, message, parsed);
  }

  return parsed as T;
}

export interface TokenRequest {
  discovery: InstanceDiscovery;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  code: string;
  codeVerifier?: string;
  fetch?: FetchLike;
}

/** Exchange an authorization code for an access/refresh token pair. */
export async function exchangeCode(requestOptions: TokenRequest): Promise<OAuthToken> {
  const form: Record<string, string> = {
    grant_type: 'authorization_code',
    client_id: requestOptions.clientId,
    client_secret: requestOptions.clientSecret,
    code: requestOptions.code,
    redirect_uri: requestOptions.redirectUri,
  };
  if (requestOptions.codeVerifier) form.code_verifier = requestOptions.codeVerifier;

  return request<OAuthToken>(requestOptions.discovery, '/oauth2/token', {
    method: 'POST',
    form,
    fetch: requestOptions.fetch,
  });
}

export interface RefreshRequest {
  discovery: InstanceDiscovery;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  fetch?: FetchLike;
}

/** Rotate a refresh token. Every refresh returns a new refresh token. */
export async function refreshAccessToken(requestOptions: RefreshRequest): Promise<OAuthToken> {
  return request<OAuthToken>(requestOptions.discovery, '/oauth2/token', {
    method: 'POST',
    form: {
      grant_type: 'refresh_token',
      client_id: requestOptions.clientId,
      client_secret: requestOptions.clientSecret,
      refresh_token: requestOptions.refreshToken,
    },
    fetch: requestOptions.fetch,
  });
}

export async function revokeToken(options: {
  discovery: InstanceDiscovery;
  clientId: string;
  clientSecret: string;
  token: string;
  fetch?: FetchLike;
}): Promise<void> {
  await request(options.discovery, '/oauth2/token/revoke', {
    method: 'POST',
    form: {
      client_id: options.clientId,
      client_secret: options.clientSecret,
      token: options.token,
    },
    fetch: options.fetch,
  });
}

/** `identify` scope. */
export async function fetchOAuthUser(options: {
  discovery: InstanceDiscovery;
  accessToken: string;
  fetch?: FetchLike;
}): Promise<OAuthUserInfo> {
  return request<OAuthUserInfo>(options.discovery, '/oauth2/userinfo', {
    token: options.accessToken,
    fetch: options.fetch,
  });
}

/**
 * `guilds` scope.
 *
 * Fluxer only returns the caller's permission mask when `limit <= 100`, so we
 * always page with 100 and follow the `after` cursor.
 */
export async function fetchUserGuilds(options: {
  discovery: InstanceDiscovery;
  accessToken: string;
  fetch?: FetchLike;
  maxGuilds?: number;
}): Promise<GuildSummary[]> {
  const pageSize = 100;
  const maxGuilds = options.maxGuilds ?? 1_000;
  const guilds: GuildSummary[] = [];
  let after: string | undefined;

  while (guilds.length < maxGuilds) {
    const params = new URLSearchParams({ limit: String(pageSize) });
    if (after) params.set('after', after);

    const page = await request<GuildSummary[]>(
      options.discovery,
      `/users/@me/guilds?${params.toString()}`,
      { token: options.accessToken, fetch: options.fetch },
    );

    guilds.push(...page);
    if (page.length < pageSize) break;
    const last = page[page.length - 1];
    if (!last) break;
    after = last.id;
  }

  return guilds.slice(0, maxGuilds);
}

export async function fetchGuild(options: {
  discovery: InstanceDiscovery;
  accessToken: string;
  guildId: string;
  fetch?: FetchLike;
}): Promise<GuildSummary> {
  return request<GuildSummary>(options.discovery, `/guilds/${options.guildId}`, {
    token: options.accessToken,
    fetch: options.fetch,
  });
}

/** Validate a bot token. Returns the application (and its bot account). */
export async function fetchApplicationMe(options: {
  discovery: InstanceDiscovery;
  botToken: string;
  fetch?: FetchLike;
}): Promise<ApplicationMe> {
  return request<ApplicationMe>(options.discovery, '/applications/@me', {
    token: options.botToken,
    tokenPrefix: 'Bot',
    fetch: options.fetch,
  });
}

/** Recommended shard count and session-start budget for a bot. */
export async function fetchGatewayBot(options: {
  discovery: InstanceDiscovery;
  botToken: string;
  fetch?: FetchLike;
}): Promise<GatewayBotInfo> {
  return request<GatewayBotInfo>(options.discovery, '/gateway/bot', {
    token: options.botToken,
    tokenPrefix: 'Bot',
    fetch: options.fetch,
  });
}

/** Generic authenticated bot REST call, used by the dashboard for one-off actions. */
export async function botRequest<T>(options: {
  discovery: InstanceDiscovery;
  botToken: string;
  method?: string;
  path: string;
  body?: unknown;
  reason?: string;
  fetch?: FetchLike;
}): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.reason) headers['x-audit-log-reason'] = options.reason;
  const response = await request<T>(options.discovery, options.path, {
    method: options.method ?? 'GET',
    body: options.body,
    token: options.botToken,
    tokenPrefix: 'Bot',
    fetch: options.fetch,
  });
  return response;
}

/** Send a message as the bot. Returns the new message. */
export async function botSendMessage(options: {
  discovery: InstanceDiscovery;
  botToken: string;
  channelId: string;
  content?: string;
  embeds?: unknown[];
}): Promise<{ id: string }> {
  return botRequest<{ id: string }>({
    discovery: options.discovery,
    botToken: options.botToken,
    method: 'POST',
    path: `/channels/${options.channelId}/messages`,
    body: { content: options.content, embeds: options.embeds },
  });
}

/** Add the bot's own reaction to a message. */
export async function botAddReaction(options: {
  discovery: InstanceDiscovery;
  botToken: string;
  channelId: string;
  messageId: string;
  emoji: string;
}): Promise<void> {
  await botRequest<null>({
    discovery: options.discovery,
    botToken: options.botToken,
    method: 'PUT',
    path: `/channels/${options.channelId}/messages/${options.messageId}/reactions/${encodeURIComponent(options.emoji)}/@me`,
  });
}
