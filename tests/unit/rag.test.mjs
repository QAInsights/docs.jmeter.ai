import { describe, it, expect } from 'vitest';
import {
  tokenize,
  retrieve,
  findChunkByPath,
  normalizeDocPath,
  INDEX,
  TOP_K,
} from '../../src/lib/rag.mjs';

describe('rag: normalizeDocPath', () => {
  it('normalizes urls and extensions', () => {
    expect(normalizeDocPath('https://docs.jmeter.ai/tools/cli-builder/')).toBe('tools/cli-builder');
    expect(normalizeDocPath('/user-manual/best-practices.mdx')).toBe('user-manual/best-practices');
  });
});

describe('rag: tokenize', () => {
  it('lowercases and splits on non-alphanumeric boundaries', () => {
    expect(tokenize('Thread Groups & Samplers!')).toEqual(
      expect.arrayContaining(['thread', 'groups', 'samplers']),
    );
  });

  it('drops stop words and tokens shorter than 2 chars', () => {
    const terms = tokenize('How do I use the HTTP recorder?');
    expect(terms).not.toContain('how');
    expect(terms).not.toContain('do');
    expect(terms).not.toContain('i');
    expect(terms).not.toContain('use');
    expect(terms).not.toContain('the');
    // "http" is a stop word in the RAG tokenizer (too noisy in a docs corpus).
    expect(terms).not.toContain('http');
    expect(terms).toContain('recorder');
  });

  it('returns an empty array for whitespace-only input', () => {
    expect(tokenize('   ')).toEqual([]);
  });
});

describe('rag: index integrity', () => {
  it('has loaded the generated chunk index', () => {
    expect(INDEX.length).toBeGreaterThan(0);
  });

  it('every chunk has title, url, body, terms, and length', () => {
    for (const c of INDEX) {
      expect(typeof c.title).toBe('string');
      expect(c.title.length).toBeGreaterThan(0);
      expect(c.url).toMatch(/^https:\/\/docs\.jmeter\.ai\//);
      expect(typeof c.body).toBe('string');
      expect(c.body.length).toBeGreaterThan(0);
      expect(c.terms).toBeInstanceOf(Object);
      expect(typeof c.length).toBe('number');
      expect(c.length).toBeGreaterThan(0);
    }
  });
});

describe('rag: retrieve', () => {
  it('returns at most TOP_K chunks', () => {
    const results = retrieve('distributed testing controller workers');
    expect(results.length).toBeLessThanOrEqual(TOP_K);
  });

  it('surfaces the distributed-testing page for a distributed-testing query', () => {
    const results = retrieve('How do I set up distributed testing with remote workers?');
    expect(results.length).toBeGreaterThan(0);
    const urls = results.map((c) => c.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('distributed-testing'),
      ]),
    );
  });

  it('surfaces the dashboard page for an APDEX/report query', () => {
    const results = retrieve('How do I read the HTML dashboard report APDEX percentiles?');
    expect(results.length).toBeGreaterThan(0);
    const urls = results.map((c) => c.url);
    expect(urls).toEqual(
      expect.arrayContaining([
        expect.stringContaining('generating-dashboard'),
      ]),
    );
  });

  it('returns an empty array for a query with only stop words', () => {
    expect(retrieve('the a an of to')).toEqual([]);
  });

  it('pins the current page first when pagePath is provided', () => {
    const page = findChunkByPath('tools/thread-calculator');
    expect(page).toBeDefined();
    const results = retrieve('how many threads for a target rps', {
      pagePath: '/tools/thread-calculator/',
    });
    expect(results[0].url).toBe(page.url);
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(TOP_K);
  });

  it('returns the current page alone when the query has no terms', () => {
    const results = retrieve('   ', { pagePath: '/tools/thread-calculator' });
    expect(results).toHaveLength(1);
    expect(results[0].url).toContain('thread-calculator');
  });

  it('returns chunks in descending score order (best first)', () => {
    const results = retrieve('build a web test plan');
    // We can't read scores back, but the first result should be the
    // most relevant page — the build-web-test-plan page.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toContain('build-web-test-plan');
  });
});
