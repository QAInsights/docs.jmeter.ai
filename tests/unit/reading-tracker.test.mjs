import { describe, it, expect, beforeEach } from 'vitest';
import {
  trackPageView,
  getRecent,
  removeRecent,
  clearRecent,
  getBookmarks,
  isBookmarked,
  toggleBookmark,
  togglePin,
  removeBookmark,
  clearBookmarks,
  getLastVisited,
  isResumeDismissed,
  dismissResume,
} from '../../src/lib/reading-tracker.mjs';

// Minimal localStorage mock for Node test environment
function createMockStorage() {
  const store = {};
  return {
    getItem: (key) => (key in store ? store[key] : null),
    setItem: (key, value) => { store[key] = String(value); },
    removeItem: (key) => { delete store[key]; },
    clear: () => { Object.keys(store).forEach((k) => delete store[k]); },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] ?? null,
  };
}

beforeEach(() => {
  globalThis.localStorage = createMockStorage();
});

// ---------------------------------------------------------------------------
// Recently viewed
// ---------------------------------------------------------------------------

describe('trackPageView / getRecent', () => {
  it('adds a page to the recent list', () => {
    trackPageView('/user-manual/build-test-plan', 'Building a Test Plan');
    const recent = getRecent();
    expect(recent).toHaveLength(1);
    expect(recent[0]).toMatchObject({ href: '/user-manual/build-test-plan', title: 'Building a Test Plan' });
    expect(recent[0].ts).toBeTypeOf('number');
  });

  it('moves duplicates to the front', () => {
    trackPageView('/page-a', 'Page A');
    trackPageView('/page-b', 'Page B');
    trackPageView('/page-a', 'Page A');
    const recent = getRecent();
    expect(recent).toHaveLength(2);
    expect(recent[0].href).toBe('/page-a');
    expect(recent[1].href).toBe('/page-b');
  });

  it('caps at 20 entries', () => {
    for (let i = 0; i < 25; i++) {
      trackPageView(`/page-${i}`, `Page ${i}`);
    }
    expect(getRecent()).toHaveLength(20);
    // Most recent should be the last one added
    expect(getRecent()[0].href).toBe('/page-24');
  });

  it('normalizes trailing slashes', () => {
    trackPageView('/foo/', 'Foo');
    trackPageView('/foo', 'Foo');
    expect(getRecent()).toHaveLength(1);
  });
});

describe('removeRecent', () => {
  it('removes a specific page from recent', () => {
    trackPageView('/a', 'A');
    trackPageView('/b', 'B');
    removeRecent('/a');
    expect(getRecent()).toHaveLength(1);
    expect(getRecent()[0].href).toBe('/b');
  });
});

describe('clearRecent', () => {
  it('empties the recent list', () => {
    trackPageView('/a', 'A');
    clearRecent();
    expect(getRecent()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Bookmarks
// ---------------------------------------------------------------------------

describe('toggleBookmark / isBookmarked', () => {
  it('adds a bookmark and returns true', () => {
    const result = toggleBookmark('/glossary', 'Glossary');
    expect(result).toBe(true);
    expect(isBookmarked('/glossary')).toBe(true);
  });

  it('removes a bookmark and returns false', () => {
    toggleBookmark('/glossary', 'Glossary');
    const result = toggleBookmark('/glossary', 'Glossary');
    expect(result).toBe(false);
    expect(isBookmarked('/glossary')).toBe(false);
  });

  it('caps at 50 bookmarks', () => {
    for (let i = 0; i < 55; i++) {
      toggleBookmark(`/page-${i}`, `Page ${i}`);
    }
    expect(getBookmarks()).toHaveLength(50);
  });

  it('normalizes trailing slashes for matching', () => {
    toggleBookmark('/glossary/', 'Glossary');
    expect(isBookmarked('/glossary')).toBe(true);
  });
});

describe('getBookmarks', () => {
  it('returns pinned items first', () => {
    toggleBookmark('/a', 'A');
    toggleBookmark('/b', 'B');
    togglePin('/b');
    const bookmarks = getBookmarks();
    expect(bookmarks[0].href).toBe('/b');
    expect(bookmarks[0].pinned).toBe(true);
  });
});

describe('togglePin', () => {
  it('pins an existing bookmark', () => {
    toggleBookmark('/a', 'A');
    const result = togglePin('/a');
    expect(result).toBe(true);
    expect(getBookmarks()[0].pinned).toBe(true);
  });

  it('unpins a pinned bookmark', () => {
    toggleBookmark('/a', 'A');
    togglePin('/a');
    const result = togglePin('/a');
    expect(result).toBe(false);
    expect(getBookmarks()[0].pinned).toBe(false);
  });

  it('returns false for non-existent bookmark', () => {
    expect(togglePin('/nope')).toBe(false);
  });
});

describe('removeBookmark', () => {
  it('removes a bookmark by href', () => {
    toggleBookmark('/a', 'A');
    toggleBookmark('/b', 'B');
    removeBookmark('/a');
    expect(getBookmarks()).toHaveLength(1);
    expect(isBookmarked('/a')).toBe(false);
  });
});

describe('clearBookmarks', () => {
  it('empties all bookmarks', () => {
    toggleBookmark('/a', 'A');
    toggleBookmark('/b', 'B');
    clearBookmarks();
    expect(getBookmarks()).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Last visited / resume
// ---------------------------------------------------------------------------

describe('getLastVisited', () => {
  it('returns null when no page has been visited', () => {
    expect(getLastVisited()).toBeNull();
  });

  it('returns the last visited page after trackPageView', () => {
    trackPageView('/functions', 'Functions');
    const last = getLastVisited();
    expect(last).toMatchObject({ href: '/functions', title: 'Functions' });
  });
});

describe('dismissResume / isResumeDismissed', () => {
  it('marks a page as dismissed', () => {
    dismissResume('/glossary');
    expect(isResumeDismissed('/glossary')).toBe(true);
  });

  it('does not duplicate dismissals', () => {
    dismissResume('/glossary');
    dismissResume('/glossary');
    expect(isResumeDismissed('/glossary')).toBe(true);
  });

  it('returns false for non-dismissed pages', () => {
    expect(isResumeDismissed('/other')).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// SSR safety (localStorage unavailable)
// ---------------------------------------------------------------------------

describe('SSR safety', () => {
  it('returns empty array when localStorage is unavailable', () => {
    globalThis.localStorage = undefined;
    expect(getRecent()).toEqual([]);
    expect(getBookmarks()).toEqual([]);
    expect(getLastVisited()).toBeNull();
  });

  it('does not throw when writing without localStorage', () => {
    globalThis.localStorage = undefined;
    expect(() => trackPageView('/a', 'A')).not.toThrow();
    expect(() => toggleBookmark('/a', 'A')).not.toThrow();
    expect(() => clearRecent()).not.toThrow();
    expect(() => clearBookmarks()).not.toThrow();
  });
});
