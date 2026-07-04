import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../..', import.meta.url));
const contentConfig = readFileSync(`${root}/src/content.config.ts`, 'utf8');
const pageTitle = readFileSync(`${root}/src/components/PageTitle.astro`, 'utf8');

describe('guide metadata', () => {
  it('allows guide type and estimated read time in docs frontmatter', () => {
    expect(contentConfig).toContain('guideType');
    expect(contentConfig).toContain('estimatedReadTime');
    expect(contentConfig).toContain('lastVerified');
    expect(contentConfig).toContain('difficulty');
  });

  it('renders metadata chips from frontmatter and computed read time', () => {
    expect(pageTitle).toContain('guide-meta-chip');
    expect(pageTitle).toContain('computedReadTime');
    expect(pageTitle).toContain('Last verified version');
  });
});
