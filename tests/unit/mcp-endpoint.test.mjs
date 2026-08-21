import { describe, it, expect } from 'vitest';
import { normalizeDocPath, findChunkByPath, GET } from '../../src/pages/api/mcp.ts';
import { INDEX } from '../../src/lib/rag.mjs';

describe('normalizeDocPath', () => {
  it('accepts full URLs', () => {
    expect(normalizeDocPath('https://docs.jmeter.ai/topics/api-load-testing/')).toBe(
      'topics/api-load-testing',
    );
  });

  it('accepts absolute and bare paths', () => {
    expect(normalizeDocPath('/user-manual/functions/')).toBe('user-manual/functions');
    expect(normalizeDocPath('user-manual/functions')).toBe('user-manual/functions');
  });

  it('strips file extensions and surrounding slashes', () => {
    expect(normalizeDocPath('/topics/errors/connect-exception.mdx')).toBe(
      'topics/errors/connect-exception',
    );
    expect(normalizeDocPath('//tools///')).toBe('tools');
  });

  it('returns empty string for empty input', () => {
    expect(normalizeDocPath('')).toBe('');
    expect(normalizeDocPath('///')).toBe('');
  });
});

describe('findChunkByPath', () => {
  it('finds a known indexed page by bare path', () => {
    const chunk = findChunkByPath('getting-started/get-started');
    expect(chunk).toBeDefined();
    expect(chunk.title).toBeTruthy();
    expect(chunk.url).toContain('docs.jmeter.ai');
  });

  it('finds the same page regardless of input shape', () => {
    const a = findChunkByPath('https://docs.jmeter.ai/getting-started/get-started/');
    const b = findChunkByPath('/getting-started/get-started');
    const c = findChunkByPath('getting-started/get-started/');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('returns undefined for unknown paths', () => {
    expect(findChunkByPath('does/not/exist')).toBeUndefined();
    expect(findChunkByPath('')).toBeUndefined();
  });

  it('every chunk URL is a docs.jmeter.ai URL agents can cite', () => {
    for (const chunk of INDEX) {
      expect(chunk.url.startsWith('https://docs.jmeter.ai/')).toBe(true);
    }
  });
});

describe('GET /api/mcp endpoint discovery', () => {
  it('advertises all 7 MCP tools and streamable HTTP metadata', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe('jmeter-docs');
    expect(body.transport).toBe('streamable-http');
    expect(body.tools).toContain('search_jmeter_docs');
    expect(body.tools).toContain('get_jmeter_page');
    expect(body.tools).toContain('lint_jmx_snippet');
    expect(body.tools).toContain('calculate_workload_model');
    expect(body.tools).toContain('lookup_jmeter_property');
    expect(body.tools).toContain('get_jsr223_recipe');
    expect(body.tools).toContain('lookup_error_playbook');
  });
});

