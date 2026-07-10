import { describe, it, expect } from 'vitest';
import {
  MAX_BODY_CHARS,
  MAX_BODY_LABEL,
  SAMPLE_HTTP_BODY,
  analyzeResponseBody,
  buildExtractorFields,
  escapeRegExp,
  previewMatch,
  toVariableName,
  validateBody,
  utf8ByteLength,
} from '../../src/lib/regex-extractor-builder.mjs';

describe('limits', () => {
  it('documents 1 MB max', () => {
    expect(MAX_BODY_CHARS).toBe(1 * 1024 * 1024);
    expect(MAX_BODY_LABEL).toBe('1 MB');
  });

  it('rejects empty and oversized bodies', () => {
    expect(validateBody('').ok).toBe(false);
    const big = 'x'.repeat(MAX_BODY_CHARS + 10);
    const result = validateBody(big);
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/too large/i);
  });

  it('accepts sample body', () => {
    const result = validateBody(SAMPLE_HTTP_BODY);
    expect(result.ok).toBe(true);
    expect(result.bytes).toBe(utf8ByteLength(SAMPLE_HTTP_BODY));
  });
});

describe('toVariableName / escapeRegExp', () => {
  it('sanitizes variable names', () => {
    expect(toVariableName('access-token')).toBe('access_token');
    expect(toVariableName('123abc')).toBe('var_123abc');
  });

  it('escapes regex metacharacters', () => {
    expect(escapeRegExp('a.b*c')).toBe('a\\.b\\*c');
  });
});

describe('buildExtractorFields', () => {
  it('builds JSON key pattern with $1$ template', () => {
    const fields = buildExtractorFields({
      key: 'csrf',
      value: 'abc123',
      kind: 'json-key',
    });
    expect(fields.template).toBe('$1$');
    expect(fields.matchNo).toBe('1');
    expect(fields.defaultValue).toBe('NOT_FOUND');
    expect(fields.regex).toContain('csrf');
    expect(fields.variableName).toBe('csrf');
  });
});

describe('analyzeResponseBody', () => {
  it('finds token, csrf, and uuid in sample JSON', () => {
    const result = analyzeResponseBody(SAMPLE_HTTP_BODY);
    expect(result.ok).toBe(true);
    expect(result.bodyKind).toBe('json');
    expect(result.candidates.length).toBeGreaterThan(0);
    const labels = result.candidates.map((c) => c.label.toLowerCase()).join(' ');
    expect(labels).toMatch(/token|csrf|user\.id|uuid|jwt/i);
    const first = result.candidates[0];
    expect(first.extractor.template).toBe('$1$');
    expect(first.preview.ok).toBe(true);
    expect(first.preview.matchCount).toBeGreaterThan(0);
  });

  it('finds HTML csrf input', () => {
    const html = `<html><body><input type="hidden" name="csrf_token" value="deadbeefcafebabe" /></body></html>`;
    const result = analyzeResponseBody(html);
    expect(result.ok).toBe(true);
    expect(result.bodyKind).toBe('html');
    expect(result.candidates.some((c) => /csrf/i.test(c.label) || /csrf/i.test(c.key || ''))).toBe(
      true,
    );
  });
});

describe('previewMatch', () => {
  it('returns first capture group', () => {
    const preview = previewMatch('"csrf"\\s*:\\s*"([^"]+)"', SAMPLE_HTTP_BODY, 1);
    expect(preview.ok).toBe(true);
    expect(preview.selected?.group1).toBe('a1b2c3d4e5f6a7b8c9d0e1f2');
  });
});
