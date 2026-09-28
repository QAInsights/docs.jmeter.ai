import { describe, it, expect, vi } from 'vitest';
import {
  errorPlaybooks,
  lookupErrorPlaybook,
  lookupErrorPlaybookSemantic,
  LABEL_TO_SLUG,
  NONE_LABEL,
} from '../../src/lib/mcp/error-playbooks.mjs';

const timeoutLabel = [...LABEL_TO_SLUG.entries()].find(([, s]) => s === 'socket-timeout-exception')[0];
const otherLabel = [...LABEL_TO_SLUG.entries()].find(([, s]) => s === '401-403-after-recording')[0];

function classifyReturning(result) {
  return vi.fn(async () => ({ results: [result], model: 'jev-1.13.0', cached: 0, sent: 1 }));
}

describe('error-playbooks', () => {
  it('contains curated playbooks with docs URLs', () => {
    expect(errorPlaybooks.length).toBeGreaterThanOrEqual(5);
    for (const pb of errorPlaybooks) {
      expect(pb.id).toBeTruthy();
      expect(pb.title).toBeTruthy();
      expect(pb.rootCause).toBeTruthy();
      expect(pb.remediation.length).toBeGreaterThan(0);
      expect(pb.docUrl.startsWith('https://docs.jmeter.ai/topics/errors/')).toBe(true);
    }
  });

  it('matches errors by exception name or keyword', () => {
    const bindResults = lookupErrorPlaybook('BindException');
    expect(bindResults.length).toBeGreaterThan(0);
    expect(bindResults[0].id).toBe('bind-exception-address-in-use');

    const oomResults = lookupErrorPlaybook('heap');
    expect(oomResults.length).toBeGreaterThan(0);
    expect(oomResults[0].id).toBe('out-of-memory-heap');
  });

  it('returns all playbooks when query is empty', () => {
    expect(lookupErrorPlaybook().length).toBe(errorPlaybooks.length);
  });
});

describe('lookupErrorPlaybookSemantic', () => {
  it('returns keyword hits without ever calling the classifier', async () => {
    const classifyImpl = vi.fn();
    const outcome = await lookupErrorPlaybookSemantic('BindException', { classifyImpl });
    expect(classifyImpl).not.toHaveBeenCalled();
    expect(outcome.matchedBy).toBe('keyword');
    expect(outcome.playbooks[0].id).toBe('bind-exception-address-in-use');
    expect(outcome.playbooks[0].matchedBy).toBe('keyword');
  });

  it('returns a semantic match at confidence >= 0.70', async () => {
    const outcome = await lookupErrorPlaybookSemantic('the remote machine hung up on us', {
      classifyImpl: classifyReturning({ label: timeoutLabel, confidence: 0.93, scores: {} }),
    });
    expect(outcome.matchedBy).toBe('semantic');
    expect(outcome.confidence).toBe(0.93);
    expect(outcome.playbooks[0].id).toBe('socket-timeout-exception');
    expect(outcome.playbooks[0].matchedBy).toBe('semantic');
    expect(outcome.playbooks[0].docUrl).toContain('/topics/errors/socket-timeout-exception/');
  });

  it('returns possible playbooks for 0.40 <= confidence < 0.70', async () => {
    const outcome = await lookupErrorPlaybookSemantic('mysterious access denials during replay', {
      classifyImpl: classifyReturning({
        label: otherLabel,
        confidence: 0.52,
        scores: { [otherLabel]: 0.52, [timeoutLabel]: 0.44, [NONE_LABEL]: 0.04 },
      }),
    });
    expect(outcome.matchedBy).toBe('uncertain');
    expect(outcome.possible).toHaveLength(2);
    expect(outcome.possible[0].id).toBe('401-403-after-recording');
    expect(outcome.possible[0].docUrl).toContain('/topics/errors/401-403-after-recording/');
  });

  it('returns none for low confidence, None label, or classifier unavailable', async () => {
    expect(
      (await lookupErrorPlaybookSemantic('zzz', {
        classifyImpl: classifyReturning({ label: timeoutLabel, confidence: 0.2, scores: {} }),
      })).matchedBy,
    ).toBe('none');
    expect(
      (await lookupErrorPlaybookSemantic('zzz', {
        classifyImpl: classifyReturning({ label: NONE_LABEL, confidence: 0.99, scores: {} }),
      })).matchedBy,
    ).toBe('none');
    expect(
      (await lookupErrorPlaybookSemantic('zzz', { classifyImpl: async () => null })).matchedBy,
    ).toBe('none');
  });
});
