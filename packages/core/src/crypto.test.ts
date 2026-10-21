import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  safeEqual,
  sha256,
  signValue,
  verifySignedValue,
} from './crypto';

const KEY = 'test-key-with-enough-entropy';

describe('encryptSecret', () => {
  it('round-trips', () => {
    const ciphertext = encryptSecret('bot-token-123', KEY);
    expect(ciphertext).not.toContain('bot-token-123');
    expect(decryptSecret(ciphertext, KEY)).toBe('bot-token-123');
  });

  it('uses a fresh IV per call', () => {
    expect(encryptSecret('same', KEY)).not.toBe(encryptSecret('same', KEY));
  });

  it('rejects the wrong key', () => {
    const ciphertext = encryptSecret('secret', KEY);
    expect(() => decryptSecret(ciphertext, 'other-key')).toThrow();
  });

  it('rejects tampered payloads', () => {
    const ciphertext = encryptSecret('secret', KEY);
    const parts = ciphertext.split('.');
    parts[3] = `${parts[3]?.slice(0, -2)}aa`;
    expect(() => decryptSecret(parts.join('.'), KEY)).toThrow();
  });
});

describe('hashing and signing', () => {
  it('hashes deterministically', () => {
    expect(sha256('abc')).toBe(sha256('abc'));
    expect(sha256('abc')).not.toBe(sha256('abd'));
  });

  it('verifies signatures', () => {
    const signed = signValue('session-token', KEY);
    expect(verifySignedValue(signed, KEY)).toBe('session-token');
    expect(verifySignedValue(signed, 'wrong')).toBeNull();
    expect(verifySignedValue('garbage', KEY)).toBeNull();
  });

  it('compares safely', () => {
    expect(safeEqual('abc', 'abc')).toBe(true);
    expect(safeEqual('abc', 'abd')).toBe(false);
    expect(safeEqual('a', 'ab')).toBe(false);
  });
});
