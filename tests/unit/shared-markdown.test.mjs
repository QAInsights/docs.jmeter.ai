import { describe, it, expect } from 'vitest';
import {
  renderSharedMarkdown,
  sanitizeGeneratedHtml,
  isSafeUrl,
} from '../../src/lib/shared-markdown.mjs';

describe('renderSharedMarkdown XSS vectors', () => {
  it('escapes raw HTML instead of rendering it', () => {
    const out = renderSharedMarkdown('<svg/onload=alert(1)>');
    expect(out).not.toContain('<svg');
    expect(out).toContain('&lt;svg/onload=alert(1)&gt;');
  });

  it('neutralizes img-based event handler payloads', () => {
    const out = renderSharedMarkdown('<img src=x onerror=alert(1)>');
    // No real <img> tag: the whole payload renders as escaped text, where
    // the "onerror=" substring is inert.
    expect(out).not.toContain('<img');
    expect(out).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes script tags', () => {
    const out = renderSharedMarkdown('<script>alert(1)</script>');
    expect(out).not.toContain('<script');
    expect(out).toContain('&lt;script&gt;');
  });

  it('blocks javascript: links from markdown syntax', () => {
    const out = renderSharedMarkdown('[click me](javascript:alert(1))');
    expect(out).not.toMatch(/javascript:/i);
    expect(out).toContain('href="#"');
  });

  it('blocks entity-encoded javascript: links', () => {
    const out = renderSharedMarkdown('[click me](javascript&#58;alert(1))');
    expect(out).not.toMatch(/javascript/i);
    expect(out).toContain('href="#"');
  });

  it('blocks data: and vbscript: links', () => {
    expect(renderSharedMarkdown('[x](data:text/html;base64,PHNjcmlwdD4=)')).toContain('href="#"');
    expect(renderSharedMarkdown('[x](vbscript:msgbox(1))')).toContain('href="#"');
  });

  it('blocks javascript: with embedded control characters', () => {
    // marked may refuse to parse such a destination entirely (safe: plain
    // text) or emit it for us to rewrite (safe: href="#"). Either way no
    // clickable javascript: link may survive.
    const out = renderSharedMarkdown('[x](java\tscript:alert(1))');
    expect(out).not.toMatch(/href="[^"]*javascript/i);
  });

  it('keeps safe links and marks them external', () => {
    const out = renderSharedMarkdown('[docs](https://docs.jmeter.ai/topics/errors/)');
    expect(out).toContain('href="https://docs.jmeter.ai/topics/errors/"');
    expect(out).toContain('target="_blank"');
    expect(out).toContain('rel="noopener noreferrer"');
  });

  it('keeps relative and fragment links', () => {
    expect(renderSharedMarkdown('[x](/topics/errors/)')).toContain('href="/topics/errors/"');
    expect(renderSharedMarkdown('[x](#section)')).toContain('href="#section"');
  });

  it('still renders normal markdown', () => {
    const out = renderSharedMarkdown('**bold** and `code`\n\n# Heading\n\n- one\n- two');
    expect(out).toContain('<strong>bold</strong>');
    expect(out).toContain('<code>code</code>');
    expect(out).toContain('<h1>Heading</h1>');
    expect(out).toContain('<li>one</li>');
  });

  it('renders fenced code blocks without executing anything', () => {
    const out = renderSharedMarkdown('```\n<script>alert(1)</script>\n```');
    expect(out).toContain('<pre>');
    expect(out).not.toContain('<script>');
  });
});

describe('sanitizeGeneratedHtml allowlist', () => {
  it('unwraps unknown tags but keeps their text', () => {
    const out = sanitizeGeneratedHtml('<custom>text</custom>');
    expect(out).toBe('text');
  });

  it('drops all attributes except validated href/src/alt/title', () => {
    const out = sanitizeGeneratedHtml('<a href="https://example.com" onclick="evil()" style="color:red">x</a>');
    expect(out).toContain('href="https://example.com"');
    expect(out).not.toContain('onclick');
    expect(out).not.toContain('style');
  });
});

describe('isSafeUrl', () => {
  it('accepts http, https, mailto, relative, and fragment URLs', () => {
    expect(isSafeUrl('https://docs.jmeter.ai/')).toBe(true);
    expect(isSafeUrl('http://example.com')).toBe(true);
    expect(isSafeUrl('mailto: someone@example.com')).toBe(true);
    expect(isSafeUrl('/topics/errors/')).toBe(true);
    expect(isSafeUrl('#top')).toBe(true);
  });

  it('rejects dangerous schemes, encoded or padded', () => {
    expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeUrl('JAVASCRIPT:alert(1)')).toBe(false);
    expect(isSafeUrl('javascript&#58;alert(1)')).toBe(false);
    expect(isSafeUrl('javascript&#x3a;alert(1)')).toBe(false);
    expect(isSafeUrl('java\tscript:alert(1)')).toBe(false);
    expect(isSafeUrl('data:text/html,x')).toBe(false);
    expect(isSafeUrl('vbscript:x')).toBe(false);
    expect(isSafeUrl('')).toBe(false);
  });
});
