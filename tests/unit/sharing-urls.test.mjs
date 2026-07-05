import { describe, it, expect } from 'vitest';
import { buildShareUrls } from '../../src/lib/sharing-urls.mjs';

describe('buildShareUrls', () => {
  const url = 'https://docs.jmeter.ai/user-manual/build-test-plan/';
  const title = 'Building a Test Plan';
  const urls = buildShareUrls(url, title);

  it('returns all six provider URLs', () => {
    expect(Object.keys(urls)).toEqual([
      'twitter', 'linkedin', 'reddit', 'chatgpt', 'claude', 'perplexity',
    ]);
  });

  it('encodes title and url in Twitter URL', () => {
    expect(urls.twitter).toContain('text=Building%20a%20Test%20Plan');
    expect(urls.twitter).toContain(encodeURIComponent(url));
  });

  it('encodes url in LinkedIn URL', () => {
    expect(urls.linkedin).toContain(encodeURIComponent(url));
  });

  it('encodes url and title in Reddit URL', () => {
    expect(urls.reddit).toContain(encodeURIComponent(url));
    expect(urls.reddit).toContain(encodeURIComponent(title));
  });

  it('builds ChatGPT URL with page context', () => {
    expect(urls.chatgpt).toContain('chatgpt.com');
    expect(urls.chatgpt).toContain(encodeURIComponent(url));
  });

  it('builds Claude URL with page context', () => {
    expect(urls.claude).toContain('claude.ai');
    expect(urls.claude).toContain(encodeURIComponent(url));
  });

  it('builds Perplexity URL with encoded url', () => {
    expect(urls.perplexity).toContain('perplexity.ai');
    expect(urls.perplexity).toContain(encodeURIComponent(url));
  });

  it('handles empty title gracefully', () => {
    const result = buildShareUrls(url, '');
    expect(result.twitter).toContain('text=');
    expect(result.reddit).toContain('title=');
  });

  it('handles special characters in title', () => {
    const result = buildShareUrls(url, 'HTTP & HTTPS Recorder');
    expect(result.twitter).toContain(encodeURIComponent('HTTP & HTTPS Recorder'));
  });
});
