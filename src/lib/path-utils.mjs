/**
 * Path utilities for normalizing URLs and resolving content paths.
 * Shared by SEO validation, homepage navigation tests, and head-tag injection.
 */

/**
 * Strip trailing slash from a pathname. Returns "/" for root.
 */
export function normalizePathname(pathname) {
  const normalized = pathname.replace(/\/+$/, '');
  return normalized || '/';
}

/**
 * Resolve a sidebar link to a docs content file path.
 * Returns null for root "/" or if the link is empty.
 */
export function contentPathForLink(link, docsDir) {
  const normalized = link.replace(/^\/|\/$/g, '');
  if (!normalized) return null;
  return `${docsDir}/${normalized}.mdx`;
}

/**
 * Append UTM tracking params to a docs.jmeter.ai URL so outbound traffic
 * from agents/tools/posts can be attributed in analytics.
 * Accepts absolute or root-relative URLs. Existing utm_source wins.
 */
export function withUtm(url, source, { medium = 'referral', campaign } = {}) {
  const u = new URL(url, 'https://docs.jmeter.ai');
  if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', source);
  if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', medium);
  if (campaign && !u.searchParams.has('utm_campaign')) u.searchParams.set('utm_campaign', campaign);
  return u.toString();
}

/**
 * Build breadcrumb items from a pathname.
 * Returns [{ name, url }] with at least the Home entry.
 */
export function buildBreadcrumbItems(pathname, siteUrl) {
  const segments = pathname.split('/').filter(Boolean);
  const items = [{ name: 'Home', url: `${siteUrl}/` }];
  let currentPath = '';
  for (const segment of segments) {
    currentPath += `/${segment}`;
    const name = segment.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
    items.push({ name, url: `${siteUrl}${currentPath}` });
  }
  return items;
}
