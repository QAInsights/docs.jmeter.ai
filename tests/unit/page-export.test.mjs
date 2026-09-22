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

  it('converts tables to GFM pipe tables', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <table>
        <thead><tr><th>Property</th><th>Default</th></tr></thead>
        <tbody>
          <tr><td><code>jmeter.save.saveservice.output_format</code></td><td>csv</td></tr>
          <tr><td>pipe | char</td><td>multi<br>line</td></tr>
        </tbody>
      </table>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('| Property | Default |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| `jmeter.save.saveservice.output_format` | csv |');
    expect(md).toContain('| pipe \\| char | multi line |');
  });

  it('uses the first row as header when there is no thead', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <table>
        <tr><th>Name</th><th>Value</th></tr>
        <tr><td>a</td><td>1</td></tr>
      </table>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('| Name | Value |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| a | 1 |');
  });

  it('returns empty string for an empty table', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <table></table>
    </article>`);
    expect(htmlToMarkdown(dom.window.document.querySelector('article'))).toBe('');
  });

  it('does not leak nested table rows into the outer table', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <table>
        <thead><tr><th>Outer A</th><th>Outer B</th></tr></thead>
        <tbody>
          <tr><td>plain</td><td><table><tr><td>inner</td> <td>cell</td></tr></table></td></tr>
        </tbody>
      </table>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('| Outer A | Outer B |');
    expect(md).toContain('| --- | --- |');
    expect(md).toContain('| plain | inner cell |');
    expect(md.match(/^\| /gm).length).toBe(3);
    expect(md).not.toContain('\\|');
  });

  it('falls back to plain text for cells containing code blocks', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <table>
        <thead><tr><th>Field</th><th>Example</th></tr></thead>
        <tbody><tr><td>cmd</td><td><pre data-language="bash"><code>jmeter -n</code></pre></td></tr></tbody>
      </table>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('| cmd | jmeter -n |');
    expect(md).not.toContain('```');
  });

  it('keeps Expressive Code line breaks, language, and frame title', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <div class="expressive-code">
        <figure class="frame not-content">
          <figcaption class="header"><span class="title">user.properties</span></figcaption>
          <pre data-language="bash"><code><div class="ec-line"><div class="code"><span>jmeter.save.saveservice.output_format=xml</span></div></div><div class="ec-line"><div class="code"><span>jmeter.save.saveservice.assertion_results=none</span></div></div></code></pre>
          <div class="copy"><button title="Copy to clipboard">Copy</button></div>
        </figure>
      </div>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('**user.properties**\n```bash');
    expect(md).toContain(
      'jmeter.save.saveservice.output_format=xml\njmeter.save.saveservice.assertion_results=none',
    );
    expect(md).not.toContain('Copy to clipboard');
    // frame title should not leak in as stray text
    expect(md.match(/user\.properties/g).length).toBe(1);
  });

  it('ignores the sr-only label on terminal frames (empty span.title)', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <div class="expressive-code">
        <figure class="frame is-terminal not-content">
          <figcaption class="header"><span class="title"></span><span class="sr-only">Terminal window</span></figcaption>
          <pre data-language="bash"><code><div class="ec-line"><div class="code"><span>jmeter -n -t plan.jmx</span></div></div></code></pre>
        </figure>
      </div>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).not.toContain('Terminal window');
    expect(md).toContain('```bash\njmeter -n -t plan.jmx');
  });

  it('drops empty code blocks (client-populated tool pres)', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <p>Before</p>
      <pre class="tool-code" data-sysctl-output></pre>
      <p>After</p>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).not.toContain('```');
    expect(md).toContain('Before');
    expect(md).toContain('After');
  });

  it('converts starlight asides to titled blockquotes', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <aside aria-label="Note" class="starlight-aside starlight-aside--note">
        <p class="starlight-aside__title" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M12 2"/></svg>Note</p>
        <div class="starlight-aside__content"><p>GUI mode is for debugging only.</p><p>Use CLI for real runs.</p></div>
      </aside>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('> **Note**');
    expect(md).toContain(
      '> GUI mode is for debugging only.\n>\n> Use CLI for real runs.',
    );
  });

  it('converts starlight tabs to labelled sections', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <starlight-tabs>
        <div class="tablist-wrapper"><ul role="tablist"><li role="presentation"><a role="tab" href="#tab-a">macOS</a></li><li role="presentation"><a role="tab" href="#tab-b">Linux</a></li></ul></div>
        <div id="tab-a" role="tabpanel"><p>brew install jmeter</p></div>
        <div id="tab-b" role="tabpanel"><p>apt install jmeter</p></div>
      </starlight-tabs>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('**macOS**\n\nbrew install jmeter');
    expect(md).toContain('**Linux**\n\napt install jmeter');
  });

  it('strips UI chrome from the converted body', () => {
    const dom = new JSDOM(`<article class="sl-markdown-content">
      <div class="sl-heading-wrapper level-h2"><h2 id="x">Section</h2><a class="sl-anchor-link" href="#x"><span class="sl-anchor-icon">#</span></a><button class="heading-copy-link">Copy link</button></div>
      <p>Text with an inline <svg><path d="M0 0"/></svg> icon and a <button>Click me</button>.</p>
      <div data-doc-actions><a href="/x">Action</a></div>
      <select><option>4 GB</option></select>
      <div class="tool"><span>Recommended threads</span><pre><code>x</code></pre></div>
    </article>`);
    const md = htmlToMarkdown(dom.window.document.querySelector('article'));
    expect(md).toContain('## Section');
    expect(md).not.toContain('Copy link');
    expect(md).not.toContain('Click me');
    expect(md).not.toContain('Action');
    expect(md).not.toContain('4 GB');
    expect(md).not.toContain('Recommended threads');
    expect(md).not.toContain('```');
    expect(md).toContain('Text with an inline  icon and a .');
  });
});
