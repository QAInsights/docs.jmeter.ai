import { describe, it, expect } from 'vitest';
import { buildShareUrls, buildShareSnippet } from '../../src/lib/sharing-urls.mjs';

describe('sharing-urls', () => {
  it('builds valid social share URLs', () => {
    const urls = buildShareUrls('https://docs.jmeter.ai/tools/thread-calculator', 'Thread Calculator');
    expect(urls.twitter).toContain('twitter.com/intent/tweet');
    expect(urls.linkedin).toContain('linkedin.com/sharing');
    expect(urls.reddit).toContain('reddit.com/submit');
  });

  it('builds formatted share snippet with category and description', () => {
    const snippet = buildShareSnippet({
      title: 'Thread Calculator',
      url: 'https://docs.jmeter.ai/tools/thread-calculator',
      description: 'Calculate target load for JMeter',
      category: 'TOOLS',
    });
    expect(snippet).toContain('⚡ [TOOLS] Thread Calculator');
    expect(snippet).toContain('Calculate target load for JMeter');
    expect(snippet).toContain('🔗 https://docs.jmeter.ai/tools/thread-calculator');
  });

  it('builds formatted share snippet without category or description', () => {
    const snippet = buildShareSnippet({
      title: 'JMeter Documentation',
      url: 'https://docs.jmeter.ai/',
    });
    expect(snippet).toBe('⚡ JMeter Documentation\n\n🔗 https://docs.jmeter.ai/');
  });
});
