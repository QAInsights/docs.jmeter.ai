import { describe, it, expect } from 'vitest';
import {
  hasTag,
  injectGtagScript,
  injectOpenGraphTags,
  injectTwitterTags,
  injectSeoMeta,
  injectJsonLd,
  buildTechArticleJsonLd,
  buildWebSiteJsonLd,
  buildWebApplicationJsonLd,
  buildItemListJsonLd,
  buildBreadcrumbJsonLd,
  applySeoOverrides,
} from '../../src/lib/head-tags.mjs';

describe('hasTag', () => {
  const head = [
    { tag: 'meta', attrs: { name: 'description', content: 'test' } },
    { tag: 'script', attrs: { src: 'https://example.com/a.js' } },
  ];

  it('returns true when matching tag exists', () => {
    expect(hasTag(head, 'meta', 'name', 'description')).toBe(true);
  });

  it('returns false when no match', () => {
    expect(hasTag(head, 'meta', 'name', 'robots')).toBe(false);
  });

  it('returns false for non-existent tag type', () => {
    expect(hasTag(head, 'link', 'rel', 'manifest')).toBe(false);
  });
});

describe('injectGtagScript', () => {
  it('adds gtag scripts to empty head', () => {
    const head = [];
    injectGtagScript(head, 'G-TEST123');
    expect(head.length).toBe(2);
    expect(head[0].attrs.src).toContain('G-TEST123');
    expect(head[1].content).toContain("gtag('config', 'G-TEST123')");
  });

  it('does not duplicate if already present', () => {
    const head = [];
    injectGtagScript(head, 'G-TEST123');
    injectGtagScript(head, 'G-TEST123');
    expect(head.length).toBe(2);
  });
});

describe('injectOpenGraphTags', () => {
  it('adds OG image tags', () => {
    const head = [];
    injectOpenGraphTags(head, { title: 'Test', imageUrl: 'https://x.com/img.png' });
    expect(head.length).toBe(5);
    expect(head[0].attrs.property).toBe('og:image');
    expect(head[4].attrs.property).toBe('og:image:alt');
  });

  it('skips if og:image already exists', () => {
    const head = [{ tag: 'meta', attrs: { property: 'og:image', content: 'existing' } }];
    injectOpenGraphTags(head, { title: 'Test', imageUrl: 'https://x.com/img.png' });
    expect(head.length).toBe(1);
  });
});

describe('injectTwitterTags', () => {
  it('adds Twitter image tags', () => {
    const head = [];
    injectTwitterTags(head, { title: 'Test', imageUrl: 'https://x.com/img.png' });
    expect(head.length).toBe(2);
    expect(head[0].attrs.name).toBe('twitter:image');
  });

  it('skips if twitter:image already exists', () => {
    const head = [{ tag: 'meta', attrs: { name: 'twitter:image', content: 'x' } }];
    injectTwitterTags(head, { title: 'Test', imageUrl: 'https://x.com/img.png' });
    expect(head.length).toBe(1);
  });
});

describe('injectSeoMeta', () => {
  it('injects robots meta', () => {
    const head = [];
    injectSeoMeta(head, {});
    expect(head.some((t) => t.attrs?.name === 'robots')).toBe(true);
  });

  it('injects keywords meta', () => {
    const head = [];
    injectSeoMeta(head, { keywords: ['jmeter', 'load-testing'] });
    const kw = head.find((t) => t.attrs?.name === 'keywords');
    expect(kw.attrs.content).toBe('jmeter, load-testing');
  });

  it('injects canonical-topic link', () => {
    const head = [];
    injectSeoMeta(head, { canonicalTopic: 'api-testing' });
    expect(head.some((t) => t.attrs?.rel === 'canonical-topic')).toBe(true);
  });

  it('injects Satoshi font link', () => {
    const head = [];
    injectSeoMeta(head, {});
    expect(head.some((t) => t.attrs?.['data-font'] === 'satoshi')).toBe(true);
  });

  it('injects manifest link', () => {
    const head = [];
    injectSeoMeta(head, {});
    expect(head.some((t) => t.attrs?.rel === 'manifest')).toBe(true);
  });

  it('skips keywords if empty array', () => {
    const head = [];
    injectSeoMeta(head, { keywords: [] });
    expect(head.some((t) => t.attrs?.name === 'keywords')).toBe(false);
  });
});

describe('injectJsonLd', () => {
  it('adds JSON-LD script', () => {
    const head = [];
    injectJsonLd(head, 'test-schema', { '@type': 'Thing' });
    expect(head.length).toBe(1);
    expect(head[0].attrs['data-schema']).toBe('test-schema');
    expect(JSON.parse(head[0].content)['@type']).toBe('Thing');
  });

  it('skips null data', () => {
    const head = [];
    injectJsonLd(head, 'test', null);
    expect(head.length).toBe(0);
  });

  it('does not duplicate', () => {
    const head = [];
    injectJsonLd(head, 'test', { a: 1 });
    injectJsonLd(head, 'test', { a: 2 });
    expect(head.length).toBe(1);
  });
});

describe('buildTechArticleJsonLd', () => {
  it('builds valid TechArticle', () => {
    const ld = buildTechArticleJsonLd({
      title: 'Test Plan',
      description: 'How to build',
      url: 'https://docs.jmeter.ai/test',
      dateModified: '2026-01-01T00:00:00Z',
      difficulty: 'beginner',
    });
    expect(ld['@type']).toBe('TechArticle');
    expect(ld.headline).toBe('Test Plan');
    expect(ld.proficiencyLevel).toBe('Beginner');
    expect(ld.about.name).toBe('Apache JMeter');
  });

  it('omits date when not provided', () => {
    const ld = buildTechArticleJsonLd({ title: 'X', description: 'Y', url: 'https://x' });
    expect(ld.dateModified).toBeUndefined();
  });

  it('omits proficiencyLevel for unknown difficulty', () => {
    const ld = buildTechArticleJsonLd({ title: 'X', description: 'Y', url: 'https://x', difficulty: 'unknown' });
    expect(ld.proficiencyLevel).toBeUndefined();
  });
});

describe('buildWebSiteJsonLd', () => {
  it('builds a WebSite entity with default URL', () => {
    const ld = buildWebSiteJsonLd();
    expect(ld['@type']).toBe('WebSite');
    expect(ld.name).toBe('JMeter Docs');
    expect(ld.url).toBe('https://docs.jmeter.ai');
    expect(ld.publisher.name).toBe('docs.jmeter.ai');
    expect(ld.inLanguage).toBe('en');
  });

  it('accepts a URL override', () => {
    const ld = buildWebSiteJsonLd({ url: 'https://docs.jmeter.ai/' });
    expect(ld.url).toBe('https://docs.jmeter.ai/');
  });
});

describe('buildWebApplicationJsonLd', () => {
  it('builds a free WebApplication entity', () => {
    const ld = buildWebApplicationJsonLd({
      name: 'Thread Calculator',
      description: 'Size threads for a target RPS',
      url: 'https://docs.jmeter.ai/tools/thread-calculator/',
    });
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.name).toBe('Thread Calculator');
    expect(ld.applicationCategory).toBe('DeveloperApplication');
    expect(ld.isAccessibleForFree).toBe(true);
    expect(ld.offers.price).toBe('0');
    expect(ld.about.name).toBe('Apache JMeter');
  });

  it('returns null without name or url', () => {
    expect(buildWebApplicationJsonLd({ name: '', url: 'https://x' })).toBeNull();
    expect(buildWebApplicationJsonLd({ name: 'Tool', url: '' })).toBeNull();
  });
});

describe('buildItemListJsonLd', () => {
  const items = [
    { title: 'Thread Calculator', url: 'https://docs.jmeter.ai/tools/thread-calculator/' },
    { title: 'Heap Estimator', url: 'https://docs.jmeter.ai/tools/heap-estimator/' },
  ];

  it('builds a positional ItemList', () => {
    const ld = buildItemListJsonLd({
      name: 'JMeter Interactive Tools',
      url: 'https://docs.jmeter.ai/tools/',
      items,
    });
    expect(ld['@type']).toBe('ItemList');
    expect(ld.numberOfItems).toBe(2);
    expect(ld.itemListElement[0].position).toBe(1);
    expect(ld.itemListElement[1].name).toBe('Heap Estimator');
  });

  it('returns null for empty items or missing name/url', () => {
    expect(buildItemListJsonLd({ name: 'X', url: 'https://x', items: [] })).toBeNull();
    expect(buildItemListJsonLd({ name: '', url: 'https://x', items })).toBeNull();
    expect(buildItemListJsonLd({ name: 'X', url: '', items })).toBeNull();
  });
});

describe('buildBreadcrumbJsonLd', () => {
  it('returns null for root path', () => {
    expect(buildBreadcrumbJsonLd('/', 'https://docs.jmeter.ai')).toBeNull();
  });

  it('builds valid BreadcrumbList', () => {
    const ld = buildBreadcrumbJsonLd('/user-manual/glossary', 'https://docs.jmeter.ai');
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement.length).toBe(3);
    expect(ld.itemListElement[0].name).toBe('Home');
    expect(ld.itemListElement[2].name).toBe('Glossary');
  });
});

describe('applySeoOverrides', () => {
  const head = [
    { tag: 'title', content: 'Old Title' },
    { tag: 'meta', attrs: { name: 'description', content: 'Old desc' } },
    { tag: 'meta', attrs: { property: 'og:title', content: 'Old OG' } },
    { tag: 'meta', attrs: { property: 'og:description', content: 'Old OG desc' } },
    { tag: 'meta', attrs: { name: 'twitter:title', content: 'Old TW' } },
    { tag: 'meta', attrs: { name: 'twitter:description', content: 'Old TW desc' } },
    { tag: 'meta', attrs: { name: 'twitter:card', content: 'summary' } },
  ];

  it('replaces all SEO tags', () => {
    const result = applySeoOverrides(head, {
      seoTitle: 'New Title',
      seoDescription: 'New desc',
    });
    expect(result.find((t) => t.tag === 'title').content).toBe('New Title');
    expect(result.find((t) => t.attrs?.name === 'description').attrs.content).toBe('New desc');
    expect(result.find((t) => t.attrs?.property === 'og:title').attrs.content).toBe('New Title');
    expect(result.find((t) => t.attrs?.name === 'twitter:card').attrs.content).toBe('summary_large_image');
  });

  it('preserves non-SEO tags', () => {
    const headWithExtra = [...head, { tag: 'link', attrs: { rel: 'icon' } }];
    const result = applySeoOverrides(headWithExtra, { seoTitle: 'X', seoDescription: 'Y' });
    expect(result.find((t) => t.attrs?.rel === 'icon')).toBeDefined();
  });
});
