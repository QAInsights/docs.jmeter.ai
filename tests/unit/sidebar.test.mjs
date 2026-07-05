import { describe, it, expect } from 'vitest';
import { flattenSidebar, sidebar } from '../../src/sidebar.mjs';

describe('sidebar', () => {
  it('has at least one top-level entry', () => {
    expect(sidebar.length).toBeGreaterThan(0);
  });

  it('has an Overview entry with link "/"', () => {
    const overview = sidebar.find((e) => e.link === '/');
    expect(overview).toBeDefined();
    expect(overview.label).toBe('Overview');
  });
});

describe('flattenSidebar', () => {
  const flat = flattenSidebar();

  it('returns only leaf entries (all have link and label)', () => {
    for (const entry of flat) {
      expect(entry.label).toBeTruthy();
      expect(entry.link).toBeTruthy();
    }
  });

  it('includes the root Overview link', () => {
    expect(flat.some((e) => e.link === '/')).toBe(true);
  });

  it('preserves sidebar order (first leaf is Overview)', () => {
    expect(flat[0].link).toBe('/');
  });

  it('flattens nested items', () => {
    const groupWithItems = sidebar.find((e) => e.items && e.items.length > 0);
    expect(groupWithItems).toBeDefined();
    const firstLeaf = groupWithItems.items[0];
    const flatLeaf = flat.find((e) => e.link === firstLeaf.link);
    expect(flatLeaf).toBeDefined();
    expect(flatLeaf.label).toBe(firstLeaf.label);
  });

  it('does not include group entries (only leaves)', () => {
    for (const entry of flat) {
      expect(entry.items).toBeUndefined();
    }
  });

  it('returns same result when called with explicit sidebar arg', () => {
    const explicit = flattenSidebar(sidebar);
    expect(explicit).toEqual(flat);
  });
});
