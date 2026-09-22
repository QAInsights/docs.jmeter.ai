import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { JSDOM } from 'jsdom';
import {
  buildPageMarkdown,
  collectIndexHtml,
  convertPageHtml,
  extractPageMetadata,
  pagePathFor,
  resolveAssetsDir,
} from '../../scripts/generate-page-markdown.mjs';

const PAGE_HTML = `<!DOCTYPE html><html><head>
<title>Best Practices | docs.jmeter.ai</title>
<meta name="description" content="Guidelines for reliable load tests.">
</head><body>
<main>
  <div class="sl-markdown-content">
    <h2 id="sizing"><a class="sl-anchor-link" href="#sizing">#</a>Sizing</h2>
    <p>Use <strong>CLI</strong> mode.</p>
  </div>
  <p>Last updated: <time datetime="2026-07-01T12:34:56.000Z">July 1, 2026</time></p>
</main>
</body></html>`;

describe('extractPageMetadata', () => {
  it('pulls title, description, url, and lastUpdated from the document', () => {
    const document = new JSDOM(`<main><h1 id="_top">Best Practices</h1><div class="sl-markdown-content"><p>x</p></div><time datetime="2026-07-01T12:34:56.000Z"></time></main><meta name="description" content="Desc here.">`).window.document;
    const meta = extractPageMetadata(document, '/user-manual/best-practices/');
    expect(meta.title).toBe('Best Practices');
    expect(meta.description).toBe('Desc here.');
    expect(meta.url).toBe('https://docs.jmeter.ai/user-manual/best-practices/');
    expect(meta.lastUpdated).toBe('2026-07-01');
  });

  it('falls back to <title> with the site suffix stripped', () => {
    const document = new JSDOM(`<html><head><title>Glossary | docs.jmeter.ai</title></head><body><main><div class="sl-markdown-content"><p>x</p></div></main></body></html>`).window.document;
    const meta = extractPageMetadata(document, '/user-manual/glossary/');
    expect(meta.title).toBe('Glossary');
    expect(meta.lastUpdated).toBeNull();
  });
});

describe('buildPageMarkdown', () => {
  it('emits quoted frontmatter, H1, body, and one trailing newline', () => {
    const md = buildPageMarkdown({
      title: 'Best "Practices"',
      description: 'Use CLI mode.',
      url: 'https://docs.jmeter.ai/user-manual/best-practices/',
      lastUpdated: '2026-07-01',
      body: '## Sizing\n\nBody text.',
    });
    expect(md).toBe(
      '---\n' +
        'title: "Best \\"Practices\\""\n' +
        'description: "Use CLI mode."\n' +
        'url: https://docs.jmeter.ai/user-manual/best-practices/\n' +
        'lastUpdated: 2026-07-01\n' +
        'source: docs.jmeter.ai\n' +
        '---\n\n' +
        '# Best "Practices"\n\n' +
        '## Sizing\n\nBody text.\n',
    );
  });

  it('omits the lastUpdated line when absent', () => {
    const md = buildPageMarkdown({
      title: 'T',
      description: '',
      url: 'https://docs.jmeter.ai/tools/x/',
      lastUpdated: null,
      body: 'Body.',
    });
    expect(md).not.toContain('lastUpdated');
    expect(md).toContain('description: ""');
  });
});

describe('convertPageHtml', () => {
  it('converts a built page to markdown with frontmatter', () => {
    const md = convertPageHtml(PAGE_HTML, '/user-manual/best-practices/');
    expect(md).toContain('title: "Best Practices"');
    expect(md).toContain('description: "Guidelines for reliable load tests."');
    expect(md).toContain('url: https://docs.jmeter.ai/user-manual/best-practices/');
    expect(md).toContain('lastUpdated: 2026-07-01');
    expect(md).toContain('# Best Practices');
    expect(md).toContain('## Sizing');
    expect(md).toContain('**CLI**');
    // heading anchor chrome excluded
    expect(md).not.toContain('[#](#sizing)');
  });

  it('returns null when there is no .sl-markdown-content', () => {
    const md = convertPageHtml(
      '<!DOCTYPE html><html><body><main><h1>Landing</h1><p>Hero</p></main></body></html>',
      '/',
    );
    expect(md).toBeNull();
  });

  it('returns null when the article body converts to nothing', () => {
    const md = convertPageHtml(
      `<!DOCTYPE html><html><body><main><div class="sl-markdown-content"><button>Only chrome</button><svg><path d="M0 0"/></svg></div></main></body></html>`,
      '/x/',
    );
    expect(md).toBeNull();
  });

  it('strips a leading H1 repeated inside the article body', () => {
    const md = convertPageHtml(
      `<!DOCTYPE html><html><head><title>Best Practices | docs.jmeter.ai</title></head><body>
        <main><h1 id="_top">Best Practices</h1><div class="sl-markdown-content"><h1>Best Practices</h1><p>Body text.</p></div></main>
      </body></html>`,
      '/user-manual/best-practices/',
    );
    expect((md.match(/^# /gm) ?? []).length).toBe(1);
    expect(md).toContain('\n# Best Practices\n');
    expect(md).toContain('Body text.');
  });
});

describe('pagePathFor', () => {
  it('maps index.html to / and nested paths to trailing-slash dirs', () => {
    expect(pagePathFor('index.html')).toBe('/');
    expect(pagePathFor(path.join('a', 'b', 'index.html'))).toBe('/a/b/');
  });
});

describe('resolveAssetsDir / collectIndexHtml', () => {
  it('resolves the assets directory from wrangler.json and finds index.html files', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'page-markdown-'));
    fs.mkdirSync(path.join(tmp, 'server'), { recursive: true });
    fs.writeFileSync(
      path.join(tmp, 'server', 'wrangler.json'),
      JSON.stringify({ assets: { directory: '../client' } }),
    );
    const assetsDir = resolveAssetsDir(tmp);
    expect(assetsDir).toBe(path.join(tmp, 'client'));
    fs.mkdirSync(path.join(assetsDir, 'a', 'b'), { recursive: true });
    fs.writeFileSync(path.join(assetsDir, 'index.html'), '');
    fs.writeFileSync(path.join(assetsDir, 'a', 'b', 'index.html'), '');
    fs.writeFileSync(path.join(assetsDir, 'a', 'other.html'), '');
    const found = collectIndexHtml(assetsDir).map((f) => path.relative(assetsDir, f));
    expect(found.sort()).toEqual([
      path.join('a', 'b', 'index.html'),
      'index.html',
    ]);
    fs.rmSync(tmp, { recursive: true, force: true });
  });
});
