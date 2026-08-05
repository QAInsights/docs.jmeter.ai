import { describe, it, expect } from 'vitest';
import {
  parseVersions,
  splitSections,
  countItems,
  compareVersions,
  collectStats,
  orderSections,
  buildReleaseDescription,
  buildVersionPage,
  buildHubPage,
  estimateReadTime,
  versionSlug,
} from '../../scripts/generate-release-pages.mjs';

const FIXTURE = `## History of Previous Changes

Intro text that should be dropped.

## Version 5.6.2

Summary

- [Bug fixes](#Bug fixes)

## Bug fixes

#### General

- Fix one thing
- Fix another thing

## Thanks

We thank all contributors.

## Known problems and workarounds

- Some boilerplate problem

## Version 5.6.1

Summary

- [Improvements](#Improvements)

## New and Noteworthy

Notable thing happened.

## Improvements

#### HTTP Samplers and Test Script Recorder

- UTF-8 default encoding
- Recorder uses UTF-8

## Bug fixes

- Thread group regression fix
`;

describe('parseVersions', () => {
  it('extracts version blocks and drops the page intro', () => {
    const versions = parseVersions(FIXTURE);
    expect(versions.map((v) => v.version)).toEqual(['5.6.2', '5.6.1']);
    expect(versions[0].bodyText).not.toContain('Intro text');
  });

  it('returns empty array when no version headings exist', () => {
    expect(parseVersions('## Changes\n\nNothing versioned here.')).toEqual([]);
  });
});

describe('splitSections', () => {
  it('splits h2 sections and drops the leading Summary block', () => {
    const [block] = parseVersions(FIXTURE);
    const sections = splitSections(block.bodyText);
    expect(sections.map((s) => s.title)).toEqual([
      'Bug fixes',
      'Thanks',
      'Known problems and workarounds',
    ]);
    expect(sections.every((s) => !s.content.includes('Summary'))).toBe(true);
  });

  it('counts bullet items per section', () => {
    const [block] = parseVersions(FIXTURE);
    const sections = splitSections(block.bodyText);
    const bugFixes = sections.find((s) => s.title === 'Bug fixes');
    expect(bugFixes.itemCount).toBe(2);
  });
});

describe('countItems', () => {
  it('counts only markdown bullets', () => {
    expect(countItems('- a\n- b\nnot a bullet\n  - c')).toBe(3);
    expect(countItems('plain text')).toBe(0);
  });
});

describe('compareVersions', () => {
  it('orders numerically, not lexicographically', () => {
    const versions = ['5.6.10', '5.6.2', '5.6', '6.0.0', '2.13'];
    expect(versions.sort(compareVersions)).toEqual([
      '2.13',
      '5.6',
      '5.6.2',
      '5.6.10',
      '6.0.0',
    ]);
  });
});

describe('versionSlug', () => {
  it('replaces dots with hyphens for Astro-safe URLs', () => {
    expect(versionSlug('6.0.0')).toBe('6-0-0');
    expect(versionSlug('5.6')).toBe('5-6');
    expect(versionSlug('2.3.3')).toBe('2-3-3');
  });
});

describe('collectStats', () => {
  it('aggregates improvements, bug fixes, and incompatible changes', () => {
    const sections = [
      { title: 'Improvements', content: '', itemCount: 3 },
      { title: 'Bug fixes', content: '', itemCount: 2 },
      { title: 'Incompatible changes', content: '', itemCount: 1 },
      { title: 'Thanks', content: '', itemCount: 9 },
    ];
    const stats = collectStats(sections);
    expect(stats.improvements).toBe(3);
    expect(stats.bugFixes).toBe(2);
    expect(stats.incompatible).toBe(1);
    expect(stats.total).toBe(6);
  });
});

describe('orderSections', () => {
  it('uses the canonical order and drops Known problems', () => {
    const sections = [
      { title: 'Thanks', content: '', itemCount: 0 },
      { title: 'Known problems and workarounds', content: '', itemCount: 4 },
      { title: 'Bug fixes', content: '', itemCount: 2 },
      { title: 'New and Noteworthy', content: '', itemCount: 1 },
    ];
    const ordered = orderSections(sections);
    expect(ordered.map((s) => s.title)).toEqual([
      'New and Noteworthy',
      'Bug fixes',
      'Thanks',
    ]);
  });
});

describe('buildReleaseDescription', () => {
  it('stays within the 80-160 char SEO window', () => {
    const cases = [
      { improvements: 15, bugFixes: 6, incompatible: 2, total: 23 },
      { improvements: 0, bugFixes: 1, incompatible: 0, total: 1 },
      { improvements: 0, bugFixes: 0, incompatible: 0, total: 0 },
      { improvements: 999, bugFixes: 999, incompatible: 99, total: 2097 },
    ];
    for (const stats of cases) {
      const desc = buildReleaseDescription('6.0.0', stats);
      expect(desc.length).toBeGreaterThanOrEqual(80);
      expect(desc.length).toBeLessThanOrEqual(160);
      expect(desc).toContain('6.0.0');
    }
  });
});

describe('estimateReadTime', () => {
  it('returns at least 1 min read', () => {
    expect(estimateReadTime('short body')).toBe('1 min read');
    expect(estimateReadTime('word '.repeat(1000))).toBe('4 min read');
  });
});

describe('buildVersionPage', () => {
  const sections = splitSections(parseVersions(FIXTURE)[1].bodyText);

  it('emits frontmatter, summary table, sections, and useful links', () => {
    const page = buildVersionPage('5.6.1', sections, null);
    expect(page).toContain('title: "JMeter 5.6.1 Release Notes"');
    expect(page).toContain('## Change summary');
    expect(page).toContain('## New and Noteworthy');
    expect(page).toContain('## Improvements');
    expect(page).toContain('- [Download JMeter](/reference/download-jmeter/)');
    expect(page).not.toContain('Known problems');
  });

  it('includes the highlights block when provided', () => {
    const page = buildVersionPage('5.6.1', sections, '- UTF-8 everywhere');
    expect(page).toContain(':::tip[Highlights]');
    expect(page).toContain('- UTF-8 everywhere');
  });
});

describe('buildHubPage', () => {
  it('lists versions newest-first with hyphenated URL slugs', () => {
    const hub = buildHubPage([
      { version: '6.0.0', stats: { improvements: 15, bugFixes: 6, incompatible: 0, total: 21 }, hasHighlights: true },
      { version: '5.6.2', stats: { improvements: 0, bugFixes: 1, incompatible: 0, total: 1 }, hasHighlights: false },
    ]);
    expect(hub).toContain('title: "JMeter Release Notes"');
    const idx600 = hub.indexOf('### [JMeter 6.0.0](/releases/6-0-0/)');
    const idx562 = hub.indexOf('### [JMeter 5.6.2](/releases/5-6-2/)');
    expect(idx600).toBeGreaterThan(-1);
    expect(idx562).toBeGreaterThan(idx600);
    expect(hub).toContain('15 improvements · 6 bug fixes');
    expect(hub).toContain('highlights included');
    // Dotted URLs collide with Astro static-file routing.
    expect(hub).not.toContain('/releases/6.0.0/');
  });

  it('keeps the hub description inside the SEO window', () => {
    const hub = buildHubPage([
      { version: '6.0.0', stats: { improvements: 1, bugFixes: 1, incompatible: 0, total: 2 }, hasHighlights: false },
    ]);
    const m = hub.match(/description: "(.+)"/);
    expect(m).not.toBeNull();
    expect(m[1].length).toBeGreaterThanOrEqual(80);
    expect(m[1].length).toBeLessThanOrEqual(160);
  });
});
