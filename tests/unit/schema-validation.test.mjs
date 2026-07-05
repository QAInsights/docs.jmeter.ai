import { describe, it, expect } from 'vitest';
import { faqSchema, buildFaqJsonLd } from '../../src/faq-schema.mjs';
import { howtoSchema, buildHowToJsonLd } from '../../src/howto-schema.mjs';

describe('faq-schema', () => {
  it('should have at least one entry', () => {
    expect(Object.keys(faqSchema).length).toBeGreaterThan(0);
  });

  for (const [pathname, entries] of Object.entries(faqSchema)) {
    describe(`faq entry: ${pathname}`, () => {
      it('pathname should start with /', () => {
        expect(pathname.startsWith('/')).toBe(true);
      });

      it('should have at least one Q&A pair', () => {
        expect(entries.length).toBeGreaterThan(0);
      });

      entries.forEach((entry, i) => {
        it(`Q&A #${i + 1} should have non-empty q and a`, () => {
          expect(entry.q).toBeTruthy();
          expect(entry.a).toBeTruthy();
          expect(entry.q.length).toBeGreaterThan(5);
          expect(entry.a.length).toBeGreaterThan(10);
        });

        it(`Q&A #${i + 1} q should end with ?`, () => {
          expect(entry.q.endsWith('?')).toBe(true);
        });

        it(`Q&A #${i + 1} should not contain markdown or HTML`, () => {
          expect(entry.a).not.toMatch(/\*\*|\[.*\]\(.*\)|<[^>]+>/);
        });
      });
    });
  }

  it('buildFaqJsonLd should return null for unknown pathname', () => {
    expect(buildFaqJsonLd('/nonexistent', 'https://docs.jmeter.ai/nonexistent')).toBeNull();
  });

  it('buildFaqJsonLd should return valid FAQPage JSON-LD for known pathname', () => {
    const result = buildFaqJsonLd('/user-manual/glossary', 'https://docs.jmeter.ai/user-manual/glossary');
    expect(result).not.toBeNull();
    expect(result['@type']).toBe('FAQPage');
    expect(result.mainEntity.length).toBeGreaterThan(0);
    expect(result.mainEntity[0]['@type']).toBe('Question');
    expect(result.mainEntity[0].acceptedAnswer['@type']).toBe('Answer');
  });

  it('buildFaqJsonLd should handle trailing slash', () => {
    const url = 'https://docs.jmeter.ai/user-manual/glossary';
    const withSlash = buildFaqJsonLd('/user-manual/glossary/', url);
    const withoutSlash = buildFaqJsonLd('/user-manual/glossary', url);
    expect(withSlash).toEqual(withoutSlash);
  });
});

describe('howto-schema', () => {
  it('should have at least one entry', () => {
    expect(Object.keys(howtoSchema).length).toBeGreaterThan(0);
  });

  for (const [pathname, entry] of Object.entries(howtoSchema)) {
    describe(`howto entry: ${pathname}`, () => {
      it('pathname should start with /', () => {
        expect(pathname.startsWith('/')).toBe(true);
      });

      it('should have a non-empty name', () => {
        expect(entry.name).toBeTruthy();
        expect(entry.name.length).toBeGreaterThan(5);
      });

      it('should have a non-empty description', () => {
        expect(entry.description).toBeTruthy();
        expect(entry.description.length).toBeGreaterThan(10);
      });

      it('should have at least 2 steps', () => {
        expect(entry.step.length).toBeGreaterThanOrEqual(2);
      });

      entry.step.forEach((step, i) => {
        it(`step #${i + 1} should have non-empty name and text`, () => {
          expect(step.name).toBeTruthy();
          expect(step.text).toBeTruthy();
          expect(step.name.length).toBeGreaterThan(3);
          expect(step.text.length).toBeGreaterThan(10);
        });

        it(`step #${i + 1} should not contain markdown or HTML`, () => {
          expect(step.text).not.toMatch(/\*\*|\[.*\]\(.*\)|<[^>]+>/);
        });
      });
    });
  }

  it('buildHowToJsonLd should return null for unknown pathname', () => {
    expect(buildHowToJsonLd('/nonexistent', 'https://docs.jmeter.ai/nonexistent')).toBeNull();
  });

  it('buildHowToJsonLd should return valid HowTo JSON-LD for known pathname', () => {
    const result = buildHowToJsonLd('/user-manual/build-web-test-plan', 'https://docs.jmeter.ai/user-manual/build-web-test-plan');
    expect(result).not.toBeNull();
    expect(result['@type']).toBe('HowTo');
    expect(result.step.length).toBeGreaterThan(0);
    expect(result.step[0]['@type']).toBe('HowToStep');
    expect(result.step[0].name).toBeTruthy();
    expect(result.step[0].text).toBeTruthy();
  });

  it('buildHowToJsonLd should handle trailing slash', () => {
    const url = 'https://docs.jmeter.ai/user-manual/build-web-test-plan';
    const withSlash = buildHowToJsonLd('/user-manual/build-web-test-plan/', url);
    const withoutSlash = buildHowToJsonLd('/user-manual/build-web-test-plan', url);
    expect(withSlash).toEqual(withoutSlash);
  });
});

describe('schema key uniqueness', () => {
  it('faq and howto schemas should not share the same pathname', () => {
    const faqKeys = new Set(Object.keys(faqSchema));
    const howtoKeys = Object.keys(howtoSchema);
    const shared = howtoKeys.filter((k) => faqKeys.has(k));
    expect(shared).toEqual([]);
  });
});
