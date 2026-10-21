import { describe, expect, it } from 'vitest';
import { apiUrl, discoverInstance, joinUrl, normalizeOrigin } from './discovery';
import type { InstanceDiscovery } from './types';

const discoveryDocument = {
  api_code_version: 1,
  endpoints: {
    api: 'https://chat.example.com/api',
    api_client: 'https://chat.example.com/api',
    api_public: 'https://chat.example.com/api',
    gateway: 'wss://chat.example.com/gateway',
    media: 'https://chat.example.com/media',
    static_cdn: 'https://chat.example.com/static',
    marketing: 'https://chat.example.com/marketing',
    admin: 'https://chat.example.com/admin',
    invite: 'https://chat.example.com/invite',
    gift: 'https://chat.example.com/gift',
    webapp: 'https://chat.example.com',
  },
  features: { self_hosted: true, voice_enabled: true },
};

function fakeFetch(body: unknown, status = 200) {
  return async () =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
}

describe('normalizeOrigin', () => {
  it('adds https and drops paths and trailing slashes', () => {
    expect(normalizeOrigin('fluxer.example.com')).toBe('https://fluxer.example.com');
    expect(normalizeOrigin('https://fluxer.example.com/')).toBe('https://fluxer.example.com');
    expect(normalizeOrigin('http://localhost:8080/some/path')).toBe('http://localhost:8080');
  });

  it('rejects empty input', () => {
    expect(() => normalizeOrigin('  ')).toThrow();
  });
});

describe('joinUrl', () => {
  it('keeps path prefixes from the discovered endpoint', () => {
    expect(joinUrl('https://host/api/', '/v1/oauth2/token')).toBe(
      'https://host/api/v1/oauth2/token',
    );
    expect(joinUrl('https://host', 'v1/x')).toBe('https://host/v1/x');
  });
});

describe('discoverInstance', () => {
  it('parses a self-hosted discovery document', async () => {
    const discovery = await discoverInstance('chat.example.com', {
      fetch: fakeFetch(discoveryDocument),
    });
    expect(discovery.endpoints.api_public).toBe('https://chat.example.com/api');
    expect(discovery.features.self_hosted).toBe(true);
  });

  it('builds versioned API URLs on top of the public base', async () => {
    const discovery = await discoverInstance('chat.example.com', {
      fetch: fakeFetch(discoveryDocument),
    });
    expect(apiUrl(discovery, '/oauth2/token')).toBe('https://chat.example.com/api/v1/oauth2/token');
  });

  it('rejects a non-Fluxer response', async () => {
    await expect(
      discoverInstance('chat.example.com', { fetch: fakeFetch({ hello: 'world' }) }),
    ).rejects.toThrow(/endpoints/);
  });

  it('surfaces HTTP failures with a helpful message', async () => {
    await expect(
      discoverInstance('chat.example.com', { fetch: fakeFetch({}, 404) }),
    ).rejects.toThrow(/discovery document/);
  });
});

describe('endpoint defaults', () => {
  it('keeps optional endpoints when present', () => {
    const discovery = { ...discoveryDocument.endpoints, docs: 'https://docs.example.com' };
    expect(discovery.docs).toBe('https://docs.example.com');
  });
});

// Type-level guard: the parsed shape is assignable to the public interface.
const _typecheck: InstanceDiscovery | null = null;
void _typecheck;
