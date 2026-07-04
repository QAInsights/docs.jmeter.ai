import { describe, it, expect } from 'vitest';
import {
  stripFrontmatter,
  parseFrontmatter,
  buildPageBlock,
  assembleDocument,
} from '../../scripts/generate-llms-full.mjs';
import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * generate-llms-full.mjs exports its core logic as pure functions, so we
 * can test them directly without mocking execSync or the filesystem (except
 * for buildPageBlock/assembleDocument, which use a temp docs dir).
 */

describe('stripFrontmatter', () => {
  it('strips a leading frontmatter block and returns it with the body', () => {
    const text = '---\ntitle: "Hello"\ndescription: "World"\n---\n\n# Body\n\nText.';
    const { frontmatter, body } = stripFrontmatter(text);
    expect(frontmatter).toBe('title: "Hello"\ndescription: "World"');
    expect(body).toBe('# Body\n\nText.');
  });

  it('returns null frontmatter and original body when no frontmatter present', () => {
    const text = '# Just a heading\n\nNo frontmatter here.';
    const { frontmatter, body } = stripFrontmatter(text);
    expect(frontmatter).toBeNull();
    expect(body).toBe(text);
  });

  it('treats a stray --- without a closing fence as no frontmatter', () => {
    const text = '---\ntitle: "Broken"\nno closing fence';
    const { frontmatter, body } = stripFrontmatter(text);
    expect(frontmatter).toBeNull();
    expect(body).toBe(text);
  });
});

describe('parseFrontmatter', () => {
  it('parses title and description, stripping quotes', () => {
    const fm = parseFrontmatter('title: "User\'s Manual: Getting Started"\ndescription: "Hi"');
    expect(fm.title).toBe("User's Manual: Getting Started");
    expect(fm.description).toBe('Hi');
  });

  it('parses single-quoted values', () => {
    const fm = parseFrontmatter("title: 'Single'");
    expect(fm.title).toBe('Single');
  });

  it('parses unquoted values', () => {
    const fm = parseFrontmatter('title: Bare');
    expect(fm.title).toBe('Bare');
  });

  it('returns empty object for null input', () => {
    expect(parseFrontmatter(null)).toEqual({});
  });

  it('skips lines that do not look like key: value', () => {
    const fm = parseFrontmatter('title: Keep\n  not a key\n# comment');
    expect(fm).toEqual({ title: 'Keep' });
  });
});

describe('buildPageBlock', () => {
  function makeDocsDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-full-'));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    return dir;
  }

  it('returns null for the landing-page link "/"', () => {
    const dir = makeDocsDir({});
    expect(buildPageBlock({ label: 'Overview', link: '/' }, dir, 'https://x')).toBeNull();
  });

  it('returns null for a missing file and is non-throwing', () => {
    const dir = makeDocsDir({});
    expect(buildPageBlock({ label: 'Ghost', link: '/ghost' }, dir, 'https://x')).toBeNull();
  });

  it('builds a block with title from frontmatter, URL, and stripped body', () => {
    const dir = makeDocsDir({
      'getting-started/get-started.mdx':
        '---\ntitle: "User\'s Manual: Getting Started"\ndescription: "x"\n---\n\n## 1. Getting Started\n\nBody text.',
    });
    const block = buildPageBlock(
      { label: 'Get Started', link: '/getting-started/get-started' },
      dir,
      'https://docs.jmeter.ai'
    );
    expect(block).toBe(
      "---\nTitle: User's Manual: Getting Started\nURL: https://docs.jmeter.ai/getting-started/get-started/\n---\n\n## 1. Getting Started\n\nBody text.\n"
    );
  });

  it('falls back to the sidebar label when frontmatter has no title', () => {
    const dir = makeDocsDir({
      'no-fm/index.mdx': '# Just a heading\n\nNo frontmatter.',
    });
    const block = buildPageBlock(
      { label: 'No FM', link: '/no-fm/index' },
      dir,
      'https://x'
    );
    expect(block).toContain('Title: No FM');
    expect(block).toContain('# Just a heading');
  });

  it('adds a trailing slash to the URL when the link has none', () => {
    const dir = makeDocsDir({
      'foo/bar.mdx': '---\ntitle: "T"\n---\n\nbody',
    });
    const block = buildPageBlock({ label: 'Bar', link: '/foo/bar' }, dir, 'https://x');
    expect(block).toContain('URL: https://x/foo/bar/\n');
  });
});

describe('assembleDocument', () => {
  function makeDocsDir(files) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'llms-full-'));
    for (const [rel, content] of Object.entries(files)) {
      const full = path.join(dir, rel);
      fs.mkdirSync(path.dirname(full), { recursive: true });
      fs.writeFileSync(full, content, 'utf8');
    }
    return dir;
  }

  it('assembles header + ordered blocks and counts included/skipped', () => {
    const dir = makeDocsDir({
      'a/page.mdx': '---\ntitle: "A"\n---\n\nA body.',
      'b/page.mdx': '---\ntitle: "B"\n---\n\nB body.',
    });
    const entries = [
      { label: 'A', link: '/a/page' },
      { label: 'Overview', link: '/' }, // skipped (landing)
      { label: 'B', link: '/b/page' },
      { label: 'Ghost', link: '/c/missing' }, // skipped (no file)
    ];
    const { content, included, skipped } = assembleDocument(entries, dir, 'https://x', {
      generatedAt: '2026-01-01T00:00:00.000Z',
    });
    expect(included).toBe(2);
    expect(skipped).toBe(2);
    expect(content).toContain('# JMeter Docs — Full Content');
    expect(content).toContain('Pages: 2');
    expect(content).toContain('Generated: 2026-01-01T00:00:00.000Z');
    // Order preserved: A before B.
    expect(content.indexOf('Title: A')).toBeLessThan(content.indexOf('Title: B'));
    // Blocks separated by a blank line, not a stray --- separator.
    expect(content).not.toMatch(/A body\.---/);
  });

  it('omits the Generated line when generatedAt is not provided', () => {
    const dir = makeDocsDir({ 'a/p.mdx': '---\ntitle: "A"\n---\n\nx' });
    const { content } = assembleDocument([{ label: 'A', link: '/a/p' }], dir, 'https://x');
    expect(content).not.toContain('Generated:');
  });
});
