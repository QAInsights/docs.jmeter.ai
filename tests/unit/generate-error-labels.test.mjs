import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  generateErrorLabels,
  firstContentItem,
  firstFixStep,
  sectionBody,
} from '../../scripts/generate-error-labels.mjs';
import errorLabelsIndex from '../../src/lib/mcp/error-labels.json' with { type: 'json' };

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ERRORS_DIR = path.resolve(__dirname, '../../src/content/docs/topics/errors');

describe('generate-error-labels', () => {
  it('produces one entry per non-index errors mdx', () => {
    const files = fs.readdirSync(ERRORS_DIR).filter((f) => f.endsWith('.mdx') && f !== 'index.mdx');
    const index = generateErrorLabels();
    expect(index.playbooks).toHaveLength(files.length);
    for (const file of files) {
      const slug = file.replace(/\.mdx$/, '');
      expect(index.playbooks.some((p) => p.id === slug)).toBe(true);
    }
  });

  it('every entry has non-empty label, rootCause, firstFix, and url', () => {
    for (const p of generateErrorLabels().playbooks) {
      expect(p.label, p.id).toBeTruthy();
      expect(p.rootCause, p.id).toBeTruthy();
      expect(p.firstFix, p.id).toBeTruthy();
      expect(p.url).toBe(`https://docs.jmeter.ai/topics/errors/${p.id}/`);
    }
  });

  it('labels are unique and labelSetVersion is 12 hex chars', () => {
    const index = generateErrorLabels();
    const labels = index.playbooks.map((p) => p.label);
    expect(new Set(labels).size).toBe(labels.length);
    expect(index.labelSetVersion).toMatch(/^[0-9a-f]{12}$/);
  });

  it('committed error-labels.json is in sync with the generator', () => {
    const regenerated = generateErrorLabels();
    expect(regenerated.labelSetVersion).toBe(errorLabelsIndex.labelSetVersion);
    expect(regenerated.playbooks).toEqual(errorLabelsIndex.playbooks);
  });
});

describe('section extraction', () => {
  const body = [
    '# Title',
    '',
    '## Common causes',
    '',
    '| Cause | Detail |',
    '|-------|--------|',
    '| [Port exhaustion](/x/) | too many **TIME_WAIT** sockets |',
    '| Other | stuff |',
    '',
    '## Fix (ordered)',
    '',
    '1. Check `ulimit -n` on the injector.',
    '2. Enable keep-alive.',
    '',
    '## Related',
  ].join('\n');

  it('extracts the first table row of Common causes as "Cause: Detail"', () => {
    expect(firstContentItem(sectionBody(body, 'Common causes'))).toBe(
      'Port exhaustion: too many TIME_WAIT sockets',
    );
  });

  it('extracts the first numbered fix step with markdown stripped', () => {
    expect(firstFixStep(sectionBody(body, 'Fix (ordered)'))).toBe('Check ulimit -n on the injector.');
  });

  it('handles bullet/paragraph sections and missing sections', () => {
    const bullets = '## Symptom\n\n- First bullet item\n- Second\n';
    expect(firstContentItem(sectionBody(bullets, 'Symptom'))).toBe('First bullet item');
    expect(sectionBody(bullets, 'Nope')).toBe('');
  });
});
