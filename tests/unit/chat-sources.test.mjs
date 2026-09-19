import { describe, it, expect } from 'vitest';
import {
  canonicalizeDocUrl,
  extractDocSources,
  mergeDocSources,
} from '../../src/lib/chat-sources.mjs';
import { INDEX, normalizeDocPath } from '../../src/lib/rag.mjs';
import docPaths from '../../src/lib/doc-paths.json' with { type: 'json' };

describe('doc-paths.json', () => {
  it('matches the BM25 chunk index so citation chips cannot drift', () => {
    const expected = [
      ...new Set(
        INDEX.map((chunk) => {
          try {
            return normalizeDocPath(new URL(chunk.url).pathname);
          } catch {
            return '';
          }
        }).filter(Boolean),
      ),
    ].sort();
    expect(docPaths).toEqual(expected);
  });
});

describe('canonicalizeDocUrl', () => {
  it('accepts full docs.jmeter.ai URLs and adds a trailing slash', () => {
    expect(canonicalizeDocUrl('https://docs.jmeter.ai/user-manual/build-test-plan')).toBe(
      'https://docs.jmeter.ai/user-manual/build-test-plan/',
    );
  });

  it('resolves site-relative paths', () => {
    expect(canonicalizeDocUrl('/topics/errors/')).toBe('https://docs.jmeter.ai/topics/errors/');
  });

  it('rejects off-site hosts', () => {
    expect(canonicalizeDocUrl('https://jmeter.apache.org/usermanual/')).toBe('');
  });

  it('strips wrapping punctuation, backticks, and autolink brackets', () => {
    expect(canonicalizeDocUrl('`https://docs.jmeter.ai/mcp/`')).toBe(
      'https://docs.jmeter.ai/mcp/',
    );
    expect(canonicalizeDocUrl('<https://docs.jmeter.ai/mcp/>')).toBe(
      'https://docs.jmeter.ai/mcp/',
    );
  });

  it('strips trailing punctuation and fragments', () => {
    expect(canonicalizeDocUrl('https://docs.jmeter.ai/user-manual/functions/.')).toBe(
      'https://docs.jmeter.ai/user-manual/functions/',
    );
    expect(canonicalizeDocUrl('https://docs.jmeter.ai/user-manual/functions/#foo')).toBe(
      'https://docs.jmeter.ai/user-manual/functions/',
    );
  });

  it('rejects malformed, javascript, and asset URLs', () => {
    expect(canonicalizeDocUrl('https://docs.jmeter.ai/%')).toBe('');
    expect(canonicalizeDocUrl('javascript:alert(1)')).toBe('');
    expect(canonicalizeDocUrl('https://docs.jmeter.ai/images/foo.png')).toBe('');
    expect(canonicalizeDocUrl('https://docs.jmeter.ai/user-manual/timers/')).toBe('');
  });
});

describe('extractDocSources', () => {
  it('pulls markdown links with titles', () => {
    const sources = extractDocSources(
      'See the [Thread Group](https://docs.jmeter.ai/user-manual/build-test-plan/) page.',
    );
    expect(sources).toEqual([
      {
        title: 'Thread Group',
        url: 'https://docs.jmeter.ai/user-manual/build-test-plan/',
      },
    ]);
  });

  it('accepts relative markdown links to docs sections', () => {
    const sources = extractDocSources(
      'Read [Functions](/user-manual/functions/) next.',
    );
    expect(sources[0].url).toBe('https://docs.jmeter.ai/user-manual/functions/');
    expect(sources[0].title).toBe('Functions');
  });

  it('parses MCP search listings and get_jmeter_page Source lines', () => {
    const text = [
      '1. Thread Group',
      'URL: https://docs.jmeter.ai/user-manual/build-test-plan/',
      'Snippet: virtual users',
      '',
      '# Functions',
      'Source: https://docs.jmeter.ai/user-manual/functions/',
    ].join('\n');
    const urls = extractDocSources(text).map((s) => s.url);
    expect(urls).toContain('https://docs.jmeter.ai/user-manual/build-test-plan/');
    expect(urls).toContain('https://docs.jmeter.ai/user-manual/functions/');
  });

  it('dedupes the same page cited twice', () => {
    const sources = extractDocSources(
      '[A](https://docs.jmeter.ai/mcp/) and https://docs.jmeter.ai/mcp/',
    );
    expect(sources).toHaveLength(1);
  });

  it('does not chip backtick-wrapped, autolinked, or image URLs', () => {
    const sources = extractDocSources(
      [
        'See `https://docs.jmeter.ai/user-manual/` in passing.',
        'Also <https://docs.jmeter.ai/mcp/>.',
        '![x](https://docs.jmeter.ai/images/foo.png)',
        'Fake [Timers](https://docs.jmeter.ai/user-manual/timers/).',
      ].join('\n'),
    );
    expect(sources.map((s) => s.url)).not.toContain('https://docs.jmeter.ai/user-manual/%60/');
    expect(sources.map((s) => s.url)).not.toContain('https://docs.jmeter.ai/images/foo.png/');
    expect(sources.map((s) => s.url)).not.toContain('https://docs.jmeter.ai/user-manual/timers/');
    expect(sources.some((s) => s.url.includes('%60') || s.url.includes('%3E'))).toBe(false);
  });
});

describe('mergeDocSources', () => {
  it('keeps header sources and adds markdown citations', () => {
    const merged = mergeDocSources(
      [{ title: 'Thread Group', url: '/user-manual/build-test-plan/' }],
      [{ title: 'Functions', url: 'https://docs.jmeter.ai/user-manual/functions/' }],
    );
    expect(merged.map((s) => s.url)).toEqual([
      'https://docs.jmeter.ai/user-manual/build-test-plan/',
      'https://docs.jmeter.ai/user-manual/functions/',
    ]);
  });

  it('drops javascript and off-origin URLs instead of passing them through', () => {
    const merged = mergeDocSources(
      [{ title: 'xss', url: 'javascript:alert(1)' }],
      [{ title: 'evil', url: 'https://evil.example/steal' }],
    );
    expect(merged).toEqual([]);
  });
});
