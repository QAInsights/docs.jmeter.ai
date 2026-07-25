import fs from 'fs';
import path from 'path';

const dir = 'src/content/docs/topics';
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.mdx')).sort();

function parseFm(raw) {
  if (!raw.startsWith('---')) return {};
  const end = raw.indexOf('\n---', 3);
  const fm = raw.slice(4, end);
  const out = {};
  const t = fm.match(/^title:\s*(?:"([^"]*)"|'([^']*)'|(.+))$/m);
  const d = fm.match(/^description:\s*(?:'((?:''|[^'])*)'|"([^"]*)")/m);
  if (t) out.title = (t[1] ?? t[2] ?? t[3] ?? '').trim();
  if (d) out.description = (d[1] ?? d[2] ?? '').replace(/''/g, "'");
  const keywords = [];
  const km = fm.match(/^keywords:\n((?:  - .+\n?)+)/m);
  if (km) {
    for (const line of km[1].split('\n')) {
      const m = line.match(/^\s*-\s+(.+)/);
      if (m) keywords.push(m[1].replace(/^["']|["']$/g, ''));
    }
  }
  out.keywords = keywords;
  out.seoTitle = (fm.match(/^seoTitle:\s*(?:"([^"]*)"|'([^']*)')/m) || [])[1];
  out.difficulty = (fm.match(/^difficulty:\s*(.+)$/m) || [])[1]?.trim();
  out.estimatedReadTime = (fm.match(/^estimatedReadTime:\s*(.+)$/m) || [])[1]?.trim();
  return out;
}

const rows = [];
for (const f of files) {
  const raw = fs.readFileSync(path.join(dir, f), 'utf8');
  const meta = parseFm(raw);
  const desc = meta.description || '';
  const len = desc.length;
  let status = 'OK';
  if (!desc) status = 'MISSING';
  else if (len < 80) status = 'SHORT';
  else if (len > 160) status = 'LONG';
  if (desc && meta.title && desc.trim() === meta.title.trim()) status += '+DUP_TITLE';
  rows.push({ f, ...meta, len, status });
}

console.log('file | status | len | description\n');
for (const r of rows) {
  console.log(`${r.f}`);
  console.log(`  title: ${r.title}`);
  console.log(`  status: ${r.status} (${r.len} chars)`);
  console.log(`  desc: ${r.description}`);
  console.log(`  keywords: ${(r.keywords || []).join('; ') || '(none)'}`);
  console.log(`  readTime: ${r.estimatedReadTime || '(none)'} | difficulty: ${r.difficulty || '(none)'}`);
  console.log('');
}

const bad = rows.filter((r) => r.status !== 'OK');
console.log('--- summary ---');
console.log(`total: ${rows.length}, ok: ${rows.filter((r) => r.status === 'OK').length}, issues: ${bad.length}`);
if (bad.length) {
  for (const r of bad) console.log(`  ISSUE ${r.f}: ${r.status}`);
}
