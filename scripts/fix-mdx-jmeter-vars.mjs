/**
 * Escape JMeter ${var} references in topic MDX so MDX does not treat {var} as JSX.
 * - Frontmatter descriptions: YAML single-quoted, no backslash escapes
 * - Body (outside fenced code): wrap as `\${var}` inline code
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
const files = walk(path.resolve('src/content/docs/topics'));

const VAR_RE = /\\?\$\{([^}]+)\}/g;

function fixFrontmatter(fm) {
  return fm.replace(/^description:\s*(["'])([\s\S]*?)\1/m, (_m, _q, desc) => {
    let d = String(desc);
    // Undo prior backslash escapes before $
    d = d.replace(/\\\$\{/g, '${');
    d = d.replace(/\\\$/g, '$');
    // YAML single-quoted string: escape ' as ''
    d = d.replace(/'/g, "''");
    return `description: '${d}'`;
  });
}

function fixBody(body) {
  const lines = body.split('\n');
  let inFence = false;
  return lines
    .map((line) => {
      const trimmed = line.trimStart();
      if (trimmed.startsWith('```')) {
        inFence = !inFence;
        return line;
      }
      if (inFence) return line;

      return line.replace(VAR_RE, (match, inner, offset, str) => {
        const before = offset > 0 ? str[offset - 1] : '';
        const after = str[offset + match.length] || '';
        const code = '`\\${' + inner + '}`';
        // Already wrapped: `...`
        if (before === '`' && after === '`') {
          return '\\${' + inner + '}';
        }
        // Already starts with backtick from partial wrap
        if (before === '`' || after === '`') {
          return '\\${' + inner + '}';
        }
        return code;
      });
    })
    .join('\n');
}

for (const file of files) {
  const p = path.join(dir, file);
  const raw = fs.readFileSync(p, 'utf8');
  if (!raw.startsWith('---')) continue;
  const end = raw.indexOf('\n---', 3);
  if (end < 0) continue;

  let fm = raw.slice(0, end + 4); // include closing ---
  let body = raw.slice(end + 4);

  fm = fixFrontmatter(fm);
  body = fixBody(body);

  const out = fm + body;
  if (out !== raw) {
    fs.writeFileSync(p, out);
    console.log('fixed', file);
  } else {
    console.log('unchanged', file);
  }
}
