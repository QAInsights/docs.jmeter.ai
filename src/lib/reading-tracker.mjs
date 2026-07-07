/**
 * Accountless reading tracker - localStorage-backed storage for recently
 * viewed pages, bookmarks (with pinning), and last-visited resume state.
 *
 * All reads/writes are wrapped in try/catch so the module is safe to
 * call during SSR or in environments where localStorage is unavailable.
 */

const KEYS = {
  recent: 'jmeter-docs:recent',
  bookmarks: 'jmeter-docs:bookmarks',
  lastVisited: 'jmeter-docs:last-visited',
  dismissed: 'jmeter-docs:dismissed-resume',
};

const MAX_RECENT = 20;
const MAX_BOOKMARKS = 50;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function safeRead(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function safeWrite(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // storage full or unavailable - silently fail
  }
}

function normalizeHref(href) {
  return href.replace(/\/+$/, '') || '/';
}

// ---------------------------------------------------------------------------
// Recently viewed pages
// ---------------------------------------------------------------------------

/**
 * Record a page view. Moves the page to the front of the recent list
 * if it already exists. Caps the list at MAX_RECENT.
 */
export function trackPageView(href, title) {
  const norm = normalizeHref(href);
  let list = safeRead(KEYS.recent) || [];
  list = list.filter((item) => normalizeHref(item.href) !== norm);
  list.unshift({ href: norm, title, ts: Date.now() });
  if (list.length > MAX_RECENT) list.length = MAX_RECENT;
  safeWrite(KEYS.recent, list);
  safeWrite(KEYS.lastVisited, { href: norm, title, ts: Date.now() });
}

/** Return the recently viewed pages array (most recent first). */
export function getRecent() {
  return safeRead(KEYS.recent) || [];
}

/** Remove a single entry from the recent list. */
export function removeRecent(href) {
  const norm = normalizeHref(href);
  let list = safeRead(KEYS.recent) || [];
  list = list.filter((item) => normalizeHref(item.href) !== norm);
  safeWrite(KEYS.recent, list);
}

/** Clear all recently viewed pages. */
export function clearRecent() {
  safeWrite(KEYS.recent, []);
}

// ---------------------------------------------------------------------------
// Bookmarks (with pin support)
// ---------------------------------------------------------------------------

/** Return the bookmarks array (pinned items first, then by date). */
export function getBookmarks() {
  const list = safeRead(KEYS.bookmarks) || [];
  return list.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return b.ts - a.ts;
  });
}

/** Check whether a page is bookmarked. */
export function isBookmarked(href) {
  const norm = normalizeHref(href);
  const list = safeRead(KEYS.bookmarks) || [];
  return list.some((item) => normalizeHref(item.href) === norm);
}

/** Toggle bookmark status for a page. Returns the new bookmarked state. */
export function toggleBookmark(href, title) {
  const norm = normalizeHref(href);
  let list = safeRead(KEYS.bookmarks) || [];
  const idx = list.findIndex((item) => normalizeHref(item.href) === norm);
  if (idx >= 0) {
    list.splice(idx, 1);
    safeWrite(KEYS.bookmarks, list);
    return false;
  }
  list.unshift({ href: norm, title, ts: Date.now(), pinned: false });
  if (list.length > MAX_BOOKMARKS) list.length = MAX_BOOKMARKS;
  safeWrite(KEYS.bookmarks, list);
  return true;
}

/** Toggle the pinned state of a bookmarked page. Returns new pinned state. */
export function togglePin(href) {
  const norm = normalizeHref(href);
  const list = safeRead(KEYS.bookmarks) || [];
  const item = list.find((b) => normalizeHref(b.href) === norm);
  if (!item) return false;
  item.pinned = !item.pinned;
  safeWrite(KEYS.bookmarks, list);
  return item.pinned;
}

/** Remove a bookmark by href. */
export function removeBookmark(href) {
  const norm = normalizeHref(href);
  let list = safeRead(KEYS.bookmarks) || [];
  list = list.filter((item) => normalizeHref(item.href) !== norm);
  safeWrite(KEYS.bookmarks, list);
}

/** Clear all bookmarks. */
export function clearBookmarks() {
  safeWrite(KEYS.bookmarks, []);
}

// ---------------------------------------------------------------------------
// Last visited / resume
// ---------------------------------------------------------------------------

/** Return the last-visited page reference, or null. */
export function getLastVisited() {
  return safeRead(KEYS.lastVisited);
}

/** Check if the resume banner was dismissed for a given page. */
export function isResumeDismissed(href) {
  const norm = normalizeHref(href);
  const set = safeRead(KEYS.dismissed) || [];
  return set.includes(norm);
}

/** Mark the resume banner as dismissed for a given page. */
export function dismissResume(href) {
  const norm = normalizeHref(href);
  let set = safeRead(KEYS.dismissed) || [];
  if (!set.includes(norm)) {
    set.push(norm);
    // Cap at 100 dismissed pages to avoid unbounded growth
    if (set.length > 100) set = set.slice(-100);
    safeWrite(KEYS.dismissed, set);
  }
}
