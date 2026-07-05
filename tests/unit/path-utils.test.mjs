import { describe, it, expect } from 'vitest';
import { normalizePathname, contentPathForLink, buildBreadcrumbItems } from '../../src/lib/path-utils.mjs';

describe('normalizePathname', () => {
  it('strips trailing slash', () => {
    expect(normalizePathname('/user-manual/build-test-plan/')).toBe('/user-manual/build-test-plan');
  });

  it('returns "/" for root', () => {
    expect(normalizePathname('/')).toBe('/');
  });

  it('strips multiple trailing slashes', () => {
    expect(normalizePathname('/foo/bar///')).toBe('/foo/bar');
  });

  it('leaves paths without trailing slash unchanged', () => {
    expect(normalizePathname('/user-manual/glossary')).toBe('/user-manual/glossary');
  });
});

describe('contentPathForLink', () => {
  const docsDir = '/project/src/content/docs';

  it('resolves a sidebar link to an .mdx path', () => {
    expect(contentPathForLink('/user-manual/build-test-plan', docsDir))
      .toBe('/project/src/content/docs/user-manual/build-test-plan.mdx');
  });

  it('handles links with trailing slash', () => {
    expect(contentPathForLink('/getting-started/get-started/', docsDir))
      .toBe('/project/src/content/docs/getting-started/get-started.mdx');
  });

  it('returns null for root "/"', () => {
    expect(contentPathForLink('/', docsDir)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(contentPathForLink('', docsDir)).toBeNull();
  });
});

describe('buildBreadcrumbItems', () => {
  const siteUrl = 'https://docs.jmeter.ai';

  it('returns Home for root path', () => {
    const items = buildBreadcrumbItems('/', siteUrl);
    expect(items).toEqual([{ name: 'Home', url: 'https://docs.jmeter.ai/' }]);
  });

  it('builds items for a single segment', () => {
    const items = buildBreadcrumbItems('/getting-started', siteUrl);
    expect(items).toEqual([
      { name: 'Home', url: 'https://docs.jmeter.ai/' },
      { name: 'Getting Started', url: 'https://docs.jmeter.ai/getting-started' },
    ]);
  });

  it('builds items for nested paths', () => {
    const items = buildBreadcrumbItems('/user-manual/build-test-plan', siteUrl);
    expect(items).toEqual([
      { name: 'Home', url: 'https://docs.jmeter.ai/' },
      { name: 'User Manual', url: 'https://docs.jmeter.ai/user-manual' },
      { name: 'Build Test Plan', url: 'https://docs.jmeter.ai/user-manual/build-test-plan' },
    ]);
  });

  it('capitalizes each word in segment names', () => {
    const items = buildBreadcrumbItems('/api-load-testing', siteUrl);
    expect(items[1].name).toBe('Api Load Testing');
  });

  it('replaces hyphens with spaces', () => {
    const items = buildBreadcrumbItems('/user-manual/best-practices', siteUrl);
    expect(items[2].name).toBe('Best Practices');
  });
});
