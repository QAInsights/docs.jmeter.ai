import { describe, it, expect } from 'vitest';
import {
  tokenize,
  retrieve,
  buildSystemPrompt,
  buildUngroundedPrompt,
  INDEX,
  TOP_K,
} from '../../src/lib/rag.mjs';

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

  it('returns chunks in descending score order (best first)', () => {
    const results = retrieve('build a web test plan');
    // We can't read scores back, but the first result should be the
    // most relevant page — the build-web-test-plan page.
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].url).toContain('build-web-test-plan');
  });
});

describe('rag: buildSystemPrompt', () => {
  it('includes the assistant identity and grounding instructions', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('JMeter Docs AI assistant');
    expect(prompt).toContain('ONLY the documentation context');
  });

  it('embeds retrieved chunk titles, urls, and bodies', () => {
    const [chunk] = retrieve('regular expressions');
    if (!chunk) return; // skip if nothing retrieved
    const prompt = buildSystemPrompt([chunk]);
    expect(prompt).toContain(chunk.title);
    expect(prompt).toContain(chunk.url);
    expect(prompt).toContain(chunk.body.slice(0, 80));
  });

  it('falls back to a no-context note when nothing is retrieved', () => {
    const prompt = buildSystemPrompt([]);
    expect(prompt).toContain('DOCUMENTATION CONTEXT');
    // With no chunks, the context section should be empty (the ungrounded
    // fallback is handled by buildUngroundedPrompt, not buildSystemPrompt).
    expect(prompt).not.toContain('Source:');
  });
});

describe('rag: buildUngroundedPrompt', () => {
  it('includes the assistant identity and general knowledge instructions', () => {
    const prompt = buildUngroundedPrompt();
    expect(prompt).toContain('JMeter Docs AI assistant');
    expect(prompt).toContain('general knowledge');
    expect(prompt).toContain('jmeter.apache.org');
  });

  it('does not include a documentation context section', () => {
    const prompt = buildUngroundedPrompt();
    expect(prompt).not.toContain('DOCUMENTATION CONTEXT');
  });
});
