/**
 * Build sharing and AI assistant URLs for a given page.
 * Extracted from DocActions.astro for testability.
 */

/**
 * Build all share/AI URLs for a page.
 * @param {string} url - Full canonical URL
 * @param {string} title - Page title
 * @returns {Object} URLs for each provider
 */
export function buildShareUrls(url, title) {
  const encodedUrl = encodeURIComponent(url);
  const encodedTitle = encodeURIComponent(title);

  return {
    twitter: `https://twitter.com/intent/tweet?text=${encodedTitle}&url=${encodedUrl}`,
    linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
    reddit: `https://www.reddit.com/submit?url=${encodedUrl}&title=${encodedTitle}`,
    chatgpt: `https://chatgpt.com/?q=${encodeURIComponent(`Summarize and explain this page: ${url}`)}`,
    claude: `https://claude.ai/new?q=${encodeURIComponent(`Read and discuss this page: ${url}`)}`,
    perplexity: `https://www.perplexity.ai/search?q=${encodedUrl}`,
  };
}

/**
 * Build formatted social snippet for copy/paste to X, Slack, LinkedIn, or Discord.
 * @param {Object} opts
 * @param {string} opts.title
 * @param {string} opts.url
 * @param {string} [opts.description]
 * @param {string} [opts.category]
 * @returns {string} Formatted snippet
 */
export function buildShareSnippet({ title, url, description, category }) {
  const badge = category ? `[${category}] ` : '';
  const desc = description ? `\n${description}` : '';
  return `⚡ ${badge}${title}${desc}\n\n🔗 ${url}`;
}
