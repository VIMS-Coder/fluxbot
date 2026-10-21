import { FluxerApiError, type InstanceDiscovery, type InstanceEndpoints } from './types';

export const DISCOVERY_PATH = '/.well-known/fluxer';

export type FetchLike = (input: string | URL, init?: RequestInit) => Promise<Response>;

export interface DiscoverOptions {
  fetch?: FetchLike;
  signal?: AbortSignal;
  timeoutMs?: number;
}

/**
 * Normalise whatever the operator typed into a bare origin.
 *
 * Accepts `fluxer.example.com`, `https://fluxer.example.com/` and
 * `https://fluxer.example.com/some/path`, and returns `https://fluxer.example.com`.
 */
export function normalizeOrigin(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Instance origin is empty');

  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withScheme);

  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error(`Unsupported instance scheme: ${url.protocol}`);
  }
  if (!url.hostname) throw new Error('Instance origin has no host');

  return `${url.protocol}//${url.host}`;
}

/** Join a base URL (which may contain a path prefix) with an absolute path. */
export function joinUrl(base: string, path: string): string {
  const cleanBase = base.replace(/\/+$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${cleanBase}${cleanPath}`;
}

/** Absolute URL for a versioned public API route, e.g. `/v1/users/@me`. */
export function apiUrl(discovery: InstanceDiscovery, path: string): string {
  return joinUrl(discovery.endpoints.api_public, `/v1${path}`);
}

/** Absolute URL on the instance's web application (OAuth2 consent, invites). */
export function webappUrl(discovery: InstanceDiscovery, path: string): string {
  return joinUrl(discovery.endpoints.webapp, path);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`Instance discovery is missing ${field}`);
  }
  return value;
}

const REQUIRED_ENDPOINTS = [
  'api',
  'api_client',
  'api_public',
  'gateway',
  'media',
  'static_cdn',
  'marketing',
  'admin',
  'invite',
  'gift',
  'webapp',
] as const;

function parseEndpoints(value: unknown): InstanceEndpoints {
  if (!isRecord(value)) throw new Error('Instance discovery has no endpoints object');

  const endpoints: Record<string, string> = {};
  for (const key of REQUIRED_ENDPOINTS) {
    endpoints[key] = requireString(value[key], `endpoints.${key}`);
  }
  if (typeof value.docs === 'string') endpoints.docs = value.docs;
  if (typeof value.upload_relay === 'string') endpoints.upload_relay = value.upload_relay;

  return endpoints as unknown as InstanceEndpoints;
}

/**
 * Fetch and validate `/.well-known/fluxer` from an instance origin.
 *
 * The discovery document is the only deployment-specific input Fluxbot needs:
 * everything else (API base with path prefix, gateway, web app, media) is read
 * from it, so the same build works against fluxer.app and any self-hosted
 * deployment.
 */
export async function discoverInstance(
  origin: string,
  options: DiscoverOptions = {},
): Promise<InstanceDiscovery> {
  const normalized = normalizeOrigin(origin);
  const fetchImpl = options.fetch ?? fetch;
  const signal = options.signal ?? AbortSignal.timeout(options.timeoutMs ?? 10_000);

  let response: Response;
  try {
    response = await fetchImpl(`${normalized}${DISCOVERY_PATH}`, {
      headers: { accept: 'application/json' },
      signal,
    });
  } catch (error) {
    throw new Error(`Could not reach ${normalized}${DISCOVERY_PATH}: ${(error as Error).message}`);
  }

  if (!response.ok) {
    throw new FluxerApiError(
      response.status,
      'DISCOVERY_FAILED',
      `${normalized} did not return a Fluxer discovery document (HTTP ${response.status}). ` +
        'Check that the URL is your Fluxer origin, not the API path.',
      null,
    );
  }

  const raw: unknown = await response.json();
  return parseDiscovery(raw);
}

/**
 * Validate a stored discovery document. The dashboard keeps the raw JSON in
 * Postgres and rehydrates it here, so pages do not refetch discovery on every
 * request.
 */
export function parseDiscovery(raw: unknown): InstanceDiscovery {
  if (!isRecord(raw)) throw new Error('Instance discovery is not a JSON object');

  const endpoints = parseEndpoints(raw.endpoints);
  const features = isRecord(raw.features) ? (raw.features as InstanceDiscovery['features']) : {};

  return {
    codename: typeof raw.codename === 'string' ? raw.codename : undefined,
    api_code_version: typeof raw.api_code_version === 'number' ? raw.api_code_version : undefined,
    endpoints,
    features,
    raw,
  };
}

/** Small TTL cache used by both the bot and the dashboard. */
export class DiscoveryCache {
  private readonly entries = new Map<string, { value: InstanceDiscovery; expiresAt: number }>();

  constructor(private readonly ttlMs = 10 * 60 * 1000) {}

  async get(origin: string, options: DiscoverOptions = {}): Promise<InstanceDiscovery> {
    const key = normalizeOrigin(origin);
    const hit = this.entries.get(key);
    if (hit && hit.expiresAt > Date.now()) return hit.value;

    const value = await discoverInstance(key, options);
    this.entries.set(key, { value, expiresAt: Date.now() + this.ttlMs });
    return value;
  }

  invalidate(origin: string): void {
    this.entries.delete(normalizeOrigin(origin));
  }
}
