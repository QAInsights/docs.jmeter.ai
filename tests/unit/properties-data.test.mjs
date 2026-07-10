import { describe, it, expect } from 'vitest';
import {
  propertiesCheatsheet,
  filterProperties,
  listPropertyCategories,
} from '../../src/lib/properties-data.mjs';

describe('propertiesCheatsheet', () => {
  it('has curated entries with required fields', () => {
    expect(propertiesCheatsheet.length).toBeGreaterThan(10);
    for (const p of propertiesCheatsheet) {
      expect(p.name).toBeTruthy();
      expect(p.category).toBeTruthy();
      expect(p.summary.length).toBeGreaterThan(10);
    }
  });

  it('filters by query', () => {
    const ssl = filterProperties(propertiesCheatsheet, 'ssl');
    expect(ssl.length).toBeGreaterThan(0);
    expect(ssl.every((p) => JSON.stringify(p).toLowerCase().includes('ssl') || p.name.includes('https'))).toBe(true);
  });

  it('lists categories', () => {
    const cats = listPropertyCategories(propertiesCheatsheet);
    expect(cats).toContain('HTTP');
    expect(cats).toContain('Distributed');
  });
});
