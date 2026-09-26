/**
 * Shared slug helper for the split component/function reference pages
 * (Phase 1 of the traffic-growth plan). Used by:
 *   - scripts/generate-reference-pages.mjs (emits /components/<slug>/ and
 *     /functions/<slug>/ pages from the upstream monoliths)
 *   - tools/convert.mjs (rewrites <complink>/<funclink> targets to point at
 *     the split pages instead of #anchor fragments in the monolith)
 *
 * Kept in one place so a page's URL always matches the link that was
 * generated for it, however many times the upstream doc syncs.
 */

/**
 * Turn a JMeter component or function name into a URL-safe, readable slug.
 * "FTP Request Defaults" -> "ftp-request-defaults"
 * "__time" -> "time" (the leading/trailing underscores that mark JMeter
 *   function names are stripped; the page still displays "__time" in its
 *   title, only the URL segment is cleaned up)
 *
 * @param {string} name
 * @returns {string}
 */
export function referenceSlug(name) {
  return String(name || '')
    .replace(/^_+|_+$/g, '')
    .replace(/\(\)$/, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

/** Build the canonical site-relative path for a component reference page. */
export function componentPath(name) {
  return `/components/${referenceSlug(name)}/`;
}

/** Build the canonical site-relative path for a function reference page. */
export function functionPath(name) {
  return `/functions/${referenceSlug(name)}/`;
}
