import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  triageErrors,
  renderTriageText,
  triageErrorsSchema,
} from '../../src/lib/mcp/triage-errors.mjs';
import { PLAYBOOK_LABELS, LABEL_TO_SLUG, NONE_LABEL } from '../../src/lib/mcp/error-playbooks.mjs';

const label = (slug) => [...LABEL_TO_SLUG.entries()].find(([, s]) => s === slug)[0];
const TIMEOUT_LABEL = label('socket-timeout-exception');
const AUTH_LABEL = label('401-403-after-recording');

function makeClassify(responses) {
  // responses: array of per-input results or a function(text) -> result
  return async (inputs, _labels, _opts) => ({
    results: inputs.map((t) => (typeof responses === 'function' ? responses(t) : responses)),
    model: 'jev-1.13.0',
    cached: 0,
    sent: inputs.length,
  });
}

describe('triageErrors', () => {
  it('dedupes by normalized text and sums counts', async () => {
    const result = await triageErrors(
      {
        errors: [
          { text: 'Read timed out after 30000ms', count: 5 },
          { text: 'Read timed out after 60000ms', count: 3 },
        ],
      },
      { classifyImpl: makeClassify({ label: TIMEOUT_LABEL, confidence: 0.95, scores: {} }) },
    );
    expect(result.total.signatures).toBe(1);
    expect(result.total.samples).toBe(8);
    expect(result.playbooks).toHaveLength(1);
    expect(result.playbooks[0].id).toBe('socket-timeout-exception');
    expect(result.playbooks[0].samples).toBe(8);
    expect(result.playbooks[0].share).toBe(1);
    expect(result.playbooks[0].minConfidence).toBe(0.95);
    expect(result.playbooks[0].url).toBe('https://docs.jmeter.ai/topics/errors/socket-timeout-exception/');
  });

  it('buckets into playbooks / uncertain / unmatched', async () => {
    const result = await triageErrors(
      {
        errors: [
          { text: 'Read timed out', count: 10 },
          { text: 'weird auth thing', count: 4 },
          { text: 'totally alien error', count: 2 },
        ],
      },
      {
        classifyImpl: makeClassify((t) => {
          if (t === 'Read timed out') return { label: TIMEOUT_LABEL, confidence: 0.9, scores: {} };
          if (t === 'weird auth thing')
            return { label: AUTH_LABEL, confidence: 0.5, scores: { [AUTH_LABEL]: 0.5, [TIMEOUT_LABEL]: 0.2, [NONE_LABEL]: 0.3 } };
          return { label: NONE_LABEL, confidence: 0.9, scores: {} };
        }),
      },
    );
    expect(result.playbooks.map((p) => p.id)).toEqual(['socket-timeout-exception']);
    expect(result.uncertain).toHaveLength(1);
    expect(result.uncertain[0].top[0][0]).toBe('401-403-after-recording');
    expect(result.unmatched).toEqual([{ text: 'totally alien error', count: 2 }]);
  });

  it('sorts playbooks by samples desc and computes share', async () => {
    const result = await triageErrors(
      {
        errors: [
          { text: 'err-a', count: 1 },
          { text: 'err-b', count: 3 },
        ],
      },
      {
        classifyImpl: makeClassify((t) =>
          t === 'err-a'
            ? { label: TIMEOUT_LABEL, confidence: 0.9, scores: {} }
            : { label: AUTH_LABEL, confidence: 0.9, scores: {} },
        ),
      },
    );
    expect(result.playbooks.map((p) => p.id)).toEqual(['401-403-after-recording', 'socket-timeout-exception']);
    expect(result.playbooks[0].share).toBe(0.75);
  });

  it('treats null confidence as uncertain', async () => {
    const result = await triageErrors(
      { errors: [{ text: 'x', count: 1 }] },
      { classifyImpl: makeClassify({ label: TIMEOUT_LABEL, confidence: null, scores: null }) },
    );
    expect(result.uncertain).toHaveLength(1);
    expect(result.uncertain[0].top).toEqual([]);
  });

  it('degrades to keyword matching when the classifier is unavailable', async () => {
    const result = await triageErrors(
      {
        errors: [
          { text: 'java.net.BindException: Address already in use', count: 7 },
          { text: 'something unrecognizable', count: 1 },
        ],
      },
      { classifyImpl: async () => null },
    );
    expect(result.classifier.degraded).toBe(true);
    expect(result.classifier.model).toBeNull();
    expect(result.playbooks[0].id).toBe('bind-exception-address-in-use');
    expect(result.playbooks[0].minConfidence).toBeNull();
    expect(result.uncertain).toEqual([{ text: 'something unrecognizable', count: 1, top: [] }]);
  });

  it('smart tier re-asks only uncertain signatures', async () => {
    const calls = [];
    const classifyImpl = async (inputs, _labels, opts) => {
      calls.push(opts.tier);
      return {
        results: inputs.map(() =>
          opts.tier === 'smart'
            ? { label: AUTH_LABEL, confidence: 0.9, scores: {} }
            : { label: AUTH_LABEL, confidence: 0.5, scores: {} },
        ),
        model: 'jev-1.13.0',
        cached: 0,
        sent: inputs.length,
      };
    };
    const result = await triageErrors(
      { errors: [{ text: 'auth?', count: 2 }], tier: 'smart' },
      { classifyImpl },
    );
    expect(calls).toEqual(['fast', 'smart']);
    expect(result.playbooks[0].id).toBe('401-403-after-recording');
    expect(result.playbooks[0].minConfidence).toBe(0.9);
  });

  it('schema rejects more than 1000 signatures', () => {
    const schema = z.object(triageErrorsSchema);
    const errors = Array.from({ length: 1001 }, (_, i) => ({ text: `e${i}` }));
    const parsed = schema.safeParse({ errors });
    expect(parsed.success).toBe(false);
    expect(JSON.stringify(parsed.error)).toMatch(/1,?000|pre-aggregate/i);
  });
});

describe('renderTriageText', () => {
  it('renders the table header and stays within the line cap with 100 uncertain items', async () => {
    const letter = (i) => `${'abcdefghij'[Math.floor(i / 10)]}${'zyxwvutsrq'[i % 10]}`;
    const errors = Array.from({ length: 100 }, (_, i) => ({ text: `puzzling failure ${letter(i)}`, count: 1 }));
    errors.push({ text: 'Read timed out somewhere', count: 50 });
    const result = await triageErrors(
      { errors },
      {
        classifyImpl: makeClassify((t) =>
          t.startsWith('Read timed out')
            ? { label: TIMEOUT_LABEL, confidence: 0.9, scores: {} }
            : { label: TIMEOUT_LABEL, confidence: 0.5, scores: {} },
        ),
      },
    );
    expect(result.uncertain).toHaveLength(100);
    const text = renderTriageText(result);
    expect(text).toContain('| playbook | samples | share | url |');
    expect(text.split('\n').length).toBeLessThanOrEqual(60);
  });

  it('notes degraded mode in the header', async () => {
    const result = await triageErrors(
      { errors: [{ text: 'x', count: 1 }] },
      { classifyImpl: async () => null },
    );
    expect(renderTriageText(result)).toContain('classifier unavailable');
  });
});
