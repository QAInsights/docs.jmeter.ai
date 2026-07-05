/**
 * Head tag manipulation utilities for SeoHead.astro.
 * Handles tag deduplication, meta tag injection, OG/Twitter tags, gtag, and JSON-LD.
 */

import { buildBreadcrumbItems } from './path-utils.mjs';

/**
 * Check if a head array already contains a tag with matching attributes.
 * @param {Array} head - Starlight route.head array
 * @param {string} tagType - e.g. 'meta', 'script', 'link'
 * @param {string} attrKey - attribute name to match
 * @param {string} attrVal - attribute value to match
 */
export function hasTag(head, tagType, attrKey, attrVal) {
  return head.some((t) => t.tag === tagType && t.attrs?.[attrKey] === attrVal);
}

/**
 * Inject Google Analytics gtag.js scripts at the front of the head array.
 * Only injects if not already present.
 */
export function injectGtagScript(head, trackingId) {
  const src = `https://www.googletagmanager.com/gtag/js?id=${trackingId}`;
  if (hasTag(head, 'script', 'src', src)) return;
  head.unshift(
    { tag: 'script', attrs: { async: true, src } },
    {
      tag: 'script',
      content: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${trackingId}');`,
    }
  );
}

/**
 * Inject Open Graph image meta tags if not already present.
 */
export function injectOpenGraphTags(head, { title, imageUrl, imageWidth = 1200, imageHeight = 628 }) {
  if (!hasTag(head, 'meta', 'property', 'og:image')) {
    head.push(
      { tag: 'meta', attrs: { property: 'og:image', content: imageUrl } },
      { tag: 'meta', attrs: { property: 'og:image:width', content: String(imageWidth) } },
      { tag: 'meta', attrs: { property: 'og:image:height', content: String(imageHeight) } },
      { tag: 'meta', attrs: { property: 'og:image:type', content: 'image/png' } },
      { tag: 'meta', attrs: { property: 'og:image:alt', content: title } }
    );
  }
}

/**
 * Inject Twitter card image meta tags if not already present.
 */
export function injectTwitterTags(head, { title, imageUrl }) {
  if (!hasTag(head, 'meta', 'name', 'twitter:image')) {
    head.push(
      { tag: 'meta', attrs: { name: 'twitter:image', content: imageUrl } },
      { tag: 'meta', attrs: { name: 'twitter:image:alt', content: title } }
    );
  }
}

/**
 * Inject SEO meta tags: robots, keywords, canonical-topic link, manifest, Satoshi font.
 */
export function injectSeoMeta(head, { keywords, canonicalTopic, seoTitle }) {
  if (!hasTag(head, 'meta', 'name', 'robots')) {
    head.push({ tag: 'meta', attrs: { name: 'robots', content: 'index, follow' } });
  }
  if (keywords && keywords.length > 0 && !hasTag(head, 'meta', 'name', 'keywords')) {
    head.push({ tag: 'meta', attrs: { name: 'keywords', content: keywords.join(', ') } });
  }
  if (canonicalTopic && !hasTag(head, 'link', 'rel', 'canonical-topic')) {
    head.push({
      tag: 'link',
      attrs: { rel: 'canonical-topic', href: `/topics/${canonicalTopic}/` },
    });
  }
  if (!hasTag(head, 'link', 'data-font', 'satoshi')) {
    head.unshift({
      tag: 'link',
      attrs: {
        rel: 'stylesheet',
        href: 'https://api.fontshare.com/v2/css?f[]=satoshi@300,400,500,700,900&display=swap',
        'data-font': 'satoshi',
      },
    });
  }
  if (!hasTag(head, 'link', 'rel', 'manifest')) {
    head.push({ tag: 'link', attrs: { rel: 'manifest', href: '/manifest.json' } });
  }
}

/**
 * Inject a JSON-LD script tag if not already present (by data-schema attr).
 */
export function injectJsonLd(head, schemaId, data) {
  if (!data) return;
  if (!hasTag(head, 'script', 'data-schema', schemaId)) {
    head.push({
      tag: 'script',
      attrs: { type: 'application/ld+json', 'data-schema': schemaId },
      content: JSON.stringify(data),
    });
  }
}

/**
 * Build TechArticle JSON-LD for a doc page.
 * Returns null for non-doc pages (landing, 404).
 */
export function buildTechArticleJsonLd({ title, description, url, dateModified, difficulty }) {
  const proficiencyMap = { beginner: 'Beginner', intermediate: 'Intermediate', advanced: 'Advanced' };
  return {
    '@context': 'https://schema.org',
    '@type': 'TechArticle',
    headline: title || 'docs.jmeter.ai',
    description: description,
    url: url,
    ...(dateModified ? { dateModified, datePublished: dateModified } : {}),
    publisher: {
      '@type': 'Organization',
      name: 'docs.jmeter.ai',
      url: 'https://docs.jmeter.ai',
    },
    author: {
      '@type': 'Organization',
      name: 'Apache JMeter Community',
    },
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    ...(difficulty && proficiencyMap[difficulty]
      ? { proficiencyLevel: proficiencyMap[difficulty] }
      : {}),
    about: {
      '@type': 'SoftwareApplication',
      name: 'Apache JMeter',
      applicationCategory: 'DeveloperApplication',
    },
  };
}

/**
 * Build BreadcrumbList JSON-LD from a pathname.
 * Returns null if only Home (no path segments).
 */
export function buildBreadcrumbJsonLd(pathname, siteUrl) {
  const items = buildBreadcrumbItems(pathname, siteUrl);
  if (items.length <= 1) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

/**
 * Update Starlight's auto-generated head tags with SEO overrides.
 * Replaces title, description, og:title, og:description, twitter:title,
 * twitter:description, and twitter:card.
 */
export function applySeoOverrides(head, { seoTitle, seoDescription }) {
  return head.map((tag) => {
    if (tag.tag === 'title') {
      return { ...tag, content: seoTitle };
    }
    if (tag.tag === 'meta' && tag.attrs?.name === 'description') {
      return { ...tag, attrs: { ...tag.attrs, content: seoDescription } };
    }
    if (tag.tag === 'meta' && tag.attrs?.property === 'og:title') {
      return { ...tag, attrs: { ...tag.attrs, content: seoTitle } };
    }
    if (tag.tag === 'meta' && tag.attrs?.property === 'og:description') {
      return { ...tag, attrs: { ...tag.attrs, content: seoDescription } };
    }
    if (tag.tag === 'meta' && tag.attrs?.name === 'twitter:title') {
      return { ...tag, attrs: { ...tag.attrs, content: seoTitle } };
    }
    if (tag.tag === 'meta' && tag.attrs?.name === 'twitter:description') {
      return { ...tag, attrs: { ...tag.attrs, content: seoDescription } };
    }
    if (tag.tag === 'meta' && tag.attrs?.name === 'twitter:card') {
      return { ...tag, attrs: { ...tag.attrs, content: 'summary_large_image' } };
    }
    return tag;
  });
}
