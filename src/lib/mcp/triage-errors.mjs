/**
 * triage_errors tool logic: batch-map distinct JMeter failure signatures
 * (sampler | rc | rm rows, error_types output, raw log lines) to the
 * docs.jmeter.ai error playbooks via classifier.dev zero-shot labels.
 *
 * Keyword- and cache-first ordering keep the shared anonymous classifier
 * budget low; on any classifier failure the tool degrades to the curated
 * keyword matcher instead of failing.
 */

import { z } from 'zod';
import { classify, normalizeErrorText } from '../classifier.mjs';
import {
  CLASSIFY_INSTRUCTIONS,
  LABEL_SET_VERSION,
  LABEL_TO_SLUG,
  NONE_LABEL,
  PLAYBOOK_LABELS,
  getPlaybookEntry,
  lookupErrorPlaybook,
} from './error-playbooks.mjs';

export const TRIAGE_INSTRUCTIONS =
  `${CLASSIFY_INSTRUCTIONS} Each line is one distinct failure signature.`;

/** Input schema, exported for tests and server registration. */
export const triageErrorsSchema = {
  errors: z
    .array(
      z.object({
        text: z.string().min(1).max(2000).describe('One distinct failure signature, ideally "sampler | response code | response message".'),
        count: z.number().int().nonnegative().optional().describe('How many samples showed this signature (default: 1).'),
      }),
    )
    .min(1)
    .max(1000, 'Send at most 1,000 error signatures; pre-aggregate by signature first (jmeter-mcp-server analyze_jmeter_results already does).')
    .describe('Distinct error signatures to triage.'),
  minConfidence: z.number().min(0).max(1).optional().describe('Confidence threshold for auto-bucketing a signature to a playbook (default: 0.7).'),
  tier: z.enum(['fast', 'smart']).optional().describe('Classifier tier (default: "fast"). "smart" re-asks only signatures below minConfidence (slower).'),
  classifierApiKey: z.string().optional().describe('Your own classifier.dev API key (anonymous quota is shared); never logged.'),
};

/** Top-2 non-None [slug, score] guesses from a scores map. */
function topGuesses(scores) {
  if (!scores || typeof scores !== 'object') return [];
  return Object.entries(scores)
    .filter(([label]) => label !== NONE_LABEL && LABEL_TO_SLUG.has(label))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([label, score]) => [LABEL_TO_SLUG.get(label), score]);
}

/** Bucket one signature by its classify result. */
function bucket(item, result, minConfidence, buckets) {
  if (!result || !result.label || result.label === NONE_LABEL) {
    buckets.unmatched.push({ text: item.text, count: item.count });
    return;
  }
  const slug = LABEL_TO_SLUG.get(result.label);
  if (!slug || result.confidence === null || result.confidence < minConfidence) {
    buckets.uncertain.push({ text: item.text, count: item.count, top: topGuesses(result.scores) });
    return;
  }
  let bucketEntry = buckets.playbooks.get(slug);
  if (!bucketEntry) {
    bucketEntry = { signatures: 0, samples: 0, confidences: [], members: [] };
    buckets.playbooks.set(slug, bucketEntry);
  }
  bucketEntry.signatures += 1;
  bucketEntry.samples += item.count;
  bucketEntry.confidences.push(result.confidence);
  bucketEntry.members.push(item);
}

/**
 * @param {{ errors: Array<{text: string, count?: number}>, minConfidence?: number,
 *   tier?: 'fast'|'smart', classifierApiKey?: string }} params
 * @param {{ classifyImpl?: Function }} [opts]
 */
export async function triageErrors(
  { errors, minConfidence = 0.7, tier = 'fast', classifierApiKey },
  { classifyImpl = classify } = {},
) {
  // 1. Dedupe by normalized text, summing counts, keeping first-seen text.
  const seen = new Map();
  for (const e of errors) {
    const key = normalizeErrorText(e.text);
    const count = e.count ?? 1;
    const existing = seen.get(key);
    if (existing) existing.count += count;
    else seen.set(key, { text: e.text, count });
  }
  const signatures = [...seen.values()];
  const totalSamples = signatures.reduce((n, s) => n + s.count, 0);

  const labels = [...PLAYBOOK_LABELS, NONE_LABEL];
  const classifyOpts = {
    instructions: TRIAGE_INSTRUCTIONS,
    apiKey: classifierApiKey,
    cacheKeySuffix: LABEL_SET_VERSION,
    tier: 'fast',
  };

  let model = null;
  let cached = 0;
  let sent = 0;
  let degraded = false;
  let results = null;

  const outcome = await classifyImpl(signatures.map((s) => s.text), labels, classifyOpts);
  if (outcome === null) {
    degraded = true;
  } else {
    results = outcome.results;
    model = outcome.model;
    cached += outcome.cached;
    sent += outcome.sent;
  }

  // 2. Optional smart re-ask for the uncertain signatures.
  if (!degraded && tier === 'smart') {
    const uncertainIdx = [];
    for (let i = 0; i < signatures.length; i++) {
      const r = results[i];
      if (r && r.label && r.label !== NONE_LABEL && (r.confidence === null || r.confidence < minConfidence)) {
        uncertainIdx.push(i);
      }
    }
    if (uncertainIdx.length > 0) {
      const smartOutcome = await classifyImpl(
        uncertainIdx.map((i) => signatures[i].text),
        labels,
        { ...classifyOpts, tier: 'smart', cacheKeySuffix: `${LABEL_SET_VERSION}:smart` },
      );
      if (smartOutcome !== null) {
        model = smartOutcome.model || model;
        cached += smartOutcome.cached;
        sent += smartOutcome.sent;
        for (let j = 0; j < uncertainIdx.length; j++) {
          results[uncertainIdx[j]] = smartOutcome.results[j];
        }
      }
    }
  }

  const buckets = { playbooks: new Map(), uncertain: [], unmatched: [] };

  if (degraded) {
    // Classifier unavailable: keyword matcher only.
    for (const sig of signatures) {
      const hits = lookupErrorPlaybook(sig.text);
      if (hits.length > 0) {
        let bucketEntry = buckets.playbooks.get(hits[0].id);
        if (!bucketEntry) {
          bucketEntry = { signatures: 0, samples: 0, confidences: [], members: [] };
          buckets.playbooks.set(hits[0].id, bucketEntry);
        }
        bucketEntry.signatures += 1;
        bucketEntry.samples += sig.count;
        bucketEntry.members.push(sig);
      } else {
        buckets.uncertain.push({ text: sig.text, count: sig.count, top: [] });
      }
    }
  } else {
    for (let i = 0; i < signatures.length; i++) {
      bucket(signatures[i], results[i], minConfidence, buckets);
    }
  }

  const playbooks = [...buckets.playbooks.entries()]
    .map(([slug, b]) => {
      const entry = getPlaybookEntry(slug) || {};
      return {
        id: slug,
        title: entry.title || slug,
        url: entry.url,
        signatures: b.signatures,
        samples: b.samples,
        share: Math.round((b.samples / totalSamples) * 1000) / 1000,
        minConfidence: degraded
          ? null
          : Math.min(...b.confidences),
        examples: [...b.members].sort((a, c) => c.count - a.count).slice(0, 3).map((m) => m.text),
        rootCause: entry.rootCause,
        firstFix: entry.firstFix,
      };
    })
    .sort((a, b) => b.samples - a.samples);

  return {
    total: { signatures: signatures.length, samples: totalSamples },
    playbooks,
    uncertain: buckets.uncertain,
    unmatched: buckets.unmatched,
    classifier: { model, tier, cached, sent, degraded },
  };
}

/**
 * Compact text rendering for non-JSON clients; the agent fetches full
 * remediation via get_jmeter_page on the playbook URL.
 */
export function renderTriageText(result) {
  const lines = [];
  const { total, playbooks, uncertain, unmatched, classifier } = result;
  lines.push(
    `Triaged ${total.signatures} signature(s), ${total.samples} sample(s)` +
      (classifier.degraded
        ? ' — classifier unavailable, keyword matching only.'
        : ` (classifier: ${classifier.model || 'unknown'}, tier ${classifier.tier}, ${classifier.cached} cached, ${classifier.sent} sent).`),
  );
  if (playbooks.length > 0) {
    lines.push('');
    lines.push('| playbook | samples | share | url |');
    lines.push('|----------|---------|-------|-----|');
    for (const p of playbooks) {
      lines.push(`| ${p.title} | ${p.samples} | ${p.share} | ${p.url} |`);
    }
  }
  if (uncertain.length > 0) {
    lines.push('');
    lines.push(`Uncertain (${uncertain.length}):`);
    for (const u of uncertain.slice(0, 10)) {
      const guesses = u.top.map(([slug, score]) => `${slug} (${score})`).join(', ');
      lines.push(`- ${u.count}× ${u.text}${guesses ? ` → ${guesses}` : ''}`);
    }
    if (uncertain.length > 10) lines.push(`- ...and ${uncertain.length - 10} more`);
  }
  if (unmatched.length > 0) {
    lines.push('');
    lines.push(`Unmatched (${unmatched.length}):`);
    for (const u of unmatched.slice(0, 5)) {
      lines.push(`- ${u.count}× ${u.text}`);
    }
    if (unmatched.length > 5) lines.push(`- ...and ${unmatched.length - 5} more`);
  }
  return lines.slice(0, 60).join('\n');
}
