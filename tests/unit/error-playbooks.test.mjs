import { describe, it, expect } from 'vitest';
import { errorPlaybooks, lookupErrorPlaybook } from '../../src/lib/mcp/error-playbooks.mjs';

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
