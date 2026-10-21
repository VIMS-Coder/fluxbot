import { describe, expect, it } from 'vitest';
import { buildAuthorizeUrl, buildInviteUrl, createPkcePair, pkceChallenge } from './oauth';

describe('PKCE', () => {
  it('matches the RFC 7636 appendix B vector', async () => {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    await expect(pkceChallenge(verifier)).resolves.toBe(
      'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
    );
  });

  it('creates a 43 character base64url verifier', async () => {
    const pair = await createPkcePair();
    expect(pair.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(pair.method).toBe('S256');
    expect(pair.challenge).not.toBe(pair.verifier);
  });
});

describe('authorize URL', () => {
  it('uses the instance web app, not the hosted one', () => {
    const url = new URL(
      buildAuthorizeUrl({
        webapp: 'https://chat.example.com/',
        clientId: '123',
        redirectUri: 'https://bot.example.com/auth/callback',
        state: 'abc',
        codeChallenge: 'challenge',
      }),
    );

    expect(url.origin).toBe('https://chat.example.com');
    expect(url.pathname).toBe('/oauth2/authorize');
    expect(url.searchParams.get('scope')).toBe('identify guilds');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('redirect_uri')).toBe('https://bot.example.com/auth/callback');
  });

  it('supports requesting only bot install', () => {
    const url = new URL(
      buildInviteUrl({
        webapp: 'https://chat.example.com',
        clientId: '123',
        permissions: 2048n,
        guildId: '999',
      }),
    );
    expect(url.searchParams.get('scope')).toBe('bot');
    expect(url.searchParams.get('permissions')).toBe('2048');
    expect(url.searchParams.get('guild_id')).toBe('999');
  });
});
