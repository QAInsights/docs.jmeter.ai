import { describe, it, expect } from 'vitest';
import {
  parseDotEnv,
  resolveSecrets,
  patchWranglerConfig,
} from '../../scripts/deploy-cloudflare.mjs';

describe('parseDotEnv', () => {
  it('parses KEY=value lines and skips comments/blanks', () => {
    const env = parseDotEnv('# comment\nFOO=bar\n\n  \nBAZ=qux\n');
    expect(env).toEqual({ FOO: 'bar', BAZ: 'qux' });
  });

  it('strips quotes and inline comments, keeps # inside values', () => {
    const env = parseDotEnv(
      'A="quoted value"\nB=\'single\'\nC=value # trailing comment\nD=tok#en\n',
    );
    expect(env.A).toBe('quoted value');
    expect(env.B).toBe('single');
    expect(env.C).toBe('value');
    expect(env.D).toBe('tok#en');
  });

  it('ignores lines without =', () => {
    expect(parseDotEnv('not a kv line\nOK=1\n')).toEqual({ OK: '1' });
  });
});

describe('resolveSecrets', () => {
  it('maps legacy KV_REST_API_* names to UPSTASH_REDIS_REST_*', () => {
    const secrets = resolveSecrets({
      GOOGLE_GENERATIVE_AI_API_KEY: 'gemini',
      TURNSTILE_SECRET_KEY: 'turnstile',
      KV_REST_API_URL: 'https://upstash.example.com',
      KV_REST_API_TOKEN: 'redis-token',
    });
    expect(secrets).toEqual({
      GOOGLE_GENERATIVE_AI_API_KEY: 'gemini',
      TURNSTILE_SECRET_KEY: 'turnstile',
      UPSTASH_REDIS_REST_URL: 'https://upstash.example.com',
      UPSTASH_REDIS_REST_TOKEN: 'redis-token',
    });
  });

  it('prefers UPSTASH_REDIS_REST_* over KV_REST_API_*', () => {
    const secrets = resolveSecrets({
      UPSTASH_REDIS_REST_URL: 'new-url',
      KV_REST_API_URL: 'old-url',
    });
    expect(secrets.UPSTASH_REDIS_REST_URL).toBe('new-url');
  });

  it('omits missing secrets so the caller can warn', () => {
    expect(resolveSecrets({})).toEqual({});
  });
});

describe('patchWranglerConfig', () => {
  it('inserts kv_namespaces before the build-time vars comment', () => {
    const input = '{\n  "name": "docs-jmeter-ai",\n  // Public build-time config\n  "vars": {}\n}\n';
    const out = patchWranglerConfig(input, 'abc123');
    expect(out).toContain('"kv_namespaces": [{ "binding": "SESSION", "id": "abc123" }],');
    expect(out.indexOf('kv_namespaces')).toBeLessThan(out.indexOf('"vars"'));
  });

  it('replaces an existing kv_namespaces entry', () => {
    const input = '{ "kv_namespaces": [{ "binding": "SESSION", "id": "old" }], "vars": {} }';
    const out = patchWranglerConfig(input, 'new-id');
    expect(out).toContain('"id": "new-id"');
    expect(out).not.toContain('"old"');
  });
});
