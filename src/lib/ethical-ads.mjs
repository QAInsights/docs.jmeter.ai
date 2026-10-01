/**
 * EthicalAds configuration for the site's single floating placement.
 * See src/components/EthicalAd.astro for the client side.
 */

export const ETHICAL_ADS_CLIENT_SRC = 'https://media.ethicalads.io/media/client/ethicalads.min.js';
export const DEFAULT_ETHICAL_ADS_PUBLISHER = 'qainsightscom';
export const ETHICAL_ADS_CAMPAIGN_TYPES = 'paid|publisher-house';
export const ETHICAL_ADS_DARK_SELECTOR = "html[data-theme='dark']";
export const MAX_AD_KEYWORDS = 8;
export const SITE_AD_KEYWORDS = ['jmeter', 'apache-jmeter', 'performance-testing', 'load-testing'];

/** Viewports matching this query get the corner image ad; narrower ones get the text footer. */
export const FLOATING_AD_WIDE_QUERY = '(min-width: 1301px)';
export const FLOATING_AD_PLACEMENTS = {
  wide: { id: 'float-stickybox', type: 'image', style: 'stickybox' },
  narrow: { id: 'float-footer', type: 'text', style: 'fixedfooter' },
};

const PUBLISHER_ID = /^[a-z0-9][a-z0-9_-]*$/i;

/**
 * Returns the trimmed publisher id when it is a valid EthicalAds id, else null.
 * @param {string | undefined | null} value
 */
export function ethicalAdsPublisher(value) {
  const id = value?.trim() ?? '';
  return PUBLISHER_ID.test(id) ? id : null;
}

/**
 * Resolves the publisher from PUBLIC_ETHICALADS_PUBLISHER: unset uses the
 * default, "off" or an empty/invalid value disables ads (null).
 * @param {string | undefined} override
 */
export function resolveEthicalAdsPublisher(override) {
  if (override === undefined) return DEFAULT_ETHICAL_ADS_PUBLISHER;
  if (override.trim().toLowerCase() === 'off') return null;
  return ethicalAdsPublisher(override);
}

/**
 * Slugifies, dedupes and caps keywords, joined with "|" for data-ea-keywords.
 * @param {ReadonlyArray<string | undefined | null>} values
 */
export function adKeywords(values) {
  const keywords = new Set();
  for (const value of values) {
    const keyword = (value ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (keyword) keywords.add(keyword);
    if (keywords.size === MAX_AD_KEYWORDS) break;
  }
  return [...keywords].join('|');
}

/**
 * Page-level targeting: the site section (first path segment) plus the
 * page's frontmatter keywords.
 * @param {string} pathname
 * @param {ReadonlyArray<string> | undefined} pageKeywords
 */
export function pageAdKeywords(pathname, pageKeywords = []) {
  const section = pathname.split('/').filter(Boolean)[0];
  return adKeywords([...SITE_AD_KEYWORDS, section, ...pageKeywords]);
}
