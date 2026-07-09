import { describe, it, expect } from 'vitest';
import { JSDOM } from 'jsdom';
import {
  buildCitation,
  buildMarkdownExport,
  htmlToMarkdown,
} from '../../src/lib/page-export.mjs';

describe('buildCitation', () => {
  it('includes title, url, and site line', () => {
    const text = buildCitation({
      title: 'Best Practices',
      url: 'https://docs.jmeter.ai/user-manual/best-practices/',
      description: 'Guidelines for reliable load tests.',
      lastUpdated: '2026-07-01',
    });
    expect(text).toContain('# Best Practices');
    expect(text).toContain('Guidelines for reliable load tests.');
    expect(text).toContain('Source: https://docs.jmeter.ai/user-manual/best-practices/');
    expect(text).toContain('Last updated: 2026-07-01');
    expect(text).toContain('docs.jmeter.ai');
  });

  it('handles missing optional fields', () => {
    const text = buildCitation({
      url: 'https://docs.jmeter.ai/tools/thread-calculator/',
    });
    expect(text).toContain('# docs.jmeter.ai');
    expect(text).toContain('Source: https://docs.jmeter.ai/tools/thread-calculator/');
    expect(text).not.toContain('Last updated:');
  });
});

describe('buildMarkdownExport', () => {
  it('wraps body with metadata header and footer', () => {
    const out = buildMarkdownExport({
      title: 'Glossary',
      url: 'https://docs.jmeter.ai/user-manual/glossary/',
      markdown: '## Throughput\n\nRequests per unit of time.',
    });
    expect(out).toContain('title: Glossary');
    expect(out).toContain('url: https://docs.jmeter.ai/user-manual/glossary/');
    expect(out).toContain('## Throughput');
    expect(out).toContain('Copied from https://docs.jmeter.ai/user-manual/glossary/');
  });
});

describe('htmlToMarkdown', () => {
  it('converts headings, paragraphs, lists, links, and code', () => {
    const dom = new JSDOM(`<!DOCTYPE html><article class="sl-markdown-content">
      <h2>Sizing</h2>
      <p>Use <strong>CLI</strong> mode and the <a href="/user-manual/best-practices/">best practices</a>.</p>
      <ul><li>First</li><li>Second</li></ul>
      <pre><code class="language-bash">jmeter -n -t plan.jmx</code></pre>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('## Sizing');
    expect(md).toContain('**CLI**');
    expect(md).toContain('[best practices](/user-manual/best-practices/)');
    expect(md).toContain('- First');
    expect(md).toContain('```bash');
    expect(md).toContain('jmeter -n -t plan.jmx');
  });

  it('returns empty string for null root', () => {
    expect(htmlToMarkdown(null)).toBe('');
  });
});
