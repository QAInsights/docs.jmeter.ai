/**
 * Quote YAML keyword list items that would parse as non-strings
 * (colons, leading special chars, etc.).
 */
import fs from 'fs';
import path from 'path';

function walk(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith('.mdx')) acc.push(p);
  }
  return acc;
}

function needsQuotes(s) {
  if (s.startsWith('"') || s.startsWith("'")) return false;
  return (
    s.includes(':') ||
    s.includes('#') ||
    s.includes('{') ||
    s.includes('}') ||
    s.includes('[') ||
    s.includes(']') ||
    s.includes(',') ||
    s.includes('&') ||
    s.includes('*') ||
    s.includes('!') ||
    s.includes('|') ||
    s.includes('>') ||
    s.includes('@') ||
    s.includes('`') ||
    s.startsWith('-') ||
    s.startsWith('?') ||
    /^true$/i.test(s) ||
    /^false$/i.test(s) ||
    /^null$/i.test(s) ||
    s.includes("'") ||
    s.includes('"')
  );
}

function quoteItem(s) {
  // Prefer double quotes; escape inner doubles
  return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

let fixedFiles = 0;
let fixedItems = 0;

for (const file of walk('src/content/docs')) {
  let raw = fs.readFileSync(file, 'utf8');
  if (!raw.startsWith('---')) continue;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) continue;
  const fm = raw.slice(0, end + 4);
  const body = raw.slice(end + 4);
  const lines = fm.split('\n');
  let inKw = false;
  let changed = false;
  for (let i = 0; i < lines.length; i++) {
    if (/^keywords:\s*$/.test(lines[i])) {
      inKw = true;
      continue;
    }
    if (inKw) {
      const m = lines[i].match(/^(\s+-\s+)(.+)$/);
      if (m) {
        const item = m[2].trim();
        if (needsQuotes(item)) {
          lines[i] = `${m[1]}${quoteItem(item)}`;
          fixedItems++;
          changed = true;
        }
      } else if (lines[i].trim() !== '' && !/^\s/.test(lines[i])) {
        inKw = false;
      }
    }
  }
  if (changed) {
    fs.writeFileSync(file, lines.join('\n') + body);
    fixedFiles++;
    console.log('fixed', path.relative('src/content/docs', file));
  }
}

console.log(`\nFixed ${fixedItems} keyword items in ${fixedFiles} files`);
