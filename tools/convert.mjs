import { XMLParser } from 'fast-xml-parser';
import fs from 'fs';
import path from 'path';

const JMETER_XDOCS = process.env.JMETER_XDOCS || path.resolve('../jmeter/xdocs');
const OUTPUT_DIR = path.resolve('src/content/docs');
const IMAGES_DIR = path.resolve('public/images');

const FILE_MAP = {
  'usermanual/get-started.xml': 'getting-started/get-started.mdx',
  'usermanual/build-test-plan.xml': 'user-manual/build-test-plan.mdx',
  'usermanual/test_plan.xml': 'user-manual/test-plan.mdx',
  'usermanual/build-web-test-plan.xml': 'user-manual/build-web-test-plan.mdx',
  'usermanual/build-adv-web-test-plan.xml': 'user-manual/build-adv-web-test-plan.mdx',
  'usermanual/build-db-test-plan.xml': 'user-manual/build-db-test-plan.mdx',
  'usermanual/build-ftp-test-plan.xml': 'user-manual/build-ftp-test-plan.mdx',
  'usermanual/build-ldap-test-plan.xml': 'user-manual/build-ldap-test-plan.mdx',
  'usermanual/build-ldapext-test-plan.xml': 'user-manual/build-ldapext-test-plan.mdx',
  'usermanual/build-ws-test-plan.xml': 'user-manual/build-ws-test-plan.mdx',
  'usermanual/build-jms-point-to-point-test-plan.xml': 'user-manual/build-jms-point-to-point-test-plan.mdx',
  'usermanual/build-jms-topic-test-plan.xml': 'user-manual/build-jms-topic-test-plan.mdx',
  'usermanual/build-programmatic-test-plan.xml': 'user-manual/build-programmatic-test-plan.mdx',
  'usermanual/build-monitor-test-plan.xml': 'user-manual/build-monitor-test-plan.mdx',
  'usermanual/listeners.xml': 'user-manual/listeners.mdx',
  'usermanual/remote-test.xml': 'user-manual/remote-test.mdx',
  'usermanual/generating-dashboard.xml': 'user-manual/generating-dashboard.mdx',
  'usermanual/realtime-results.xml': 'user-manual/realtime-results.mdx',
  'usermanual/best-practices.xml': 'user-manual/best-practices.mdx',
  'usermanual/boss.xml': 'user-manual/boss.mdx',
  'usermanual/curl.xml': 'user-manual/curl.mdx',
  'usermanual/hints_and_tips.xml': 'user-manual/hints-and-tips.mdx',
  'usermanual/glossary.xml': 'user-manual/glossary.mdx',
  'usermanual/regular_expressions.xml': 'user-manual/regular-expressions.mdx',
  'usermanual/functions.xml': 'user-manual/functions.mdx',
  'usermanual/properties_reference.xml': 'user-manual/properties-reference.mdx',
  'usermanual/component_reference.xml': 'user-manual/component-reference.mdx',
  'usermanual/jmeter_tutorial.xml': 'user-manual/jmeter-tutorial.mdx',
  'usermanual/jmeter_proxy_step_by_step.xml': 'user-manual/jmeter-proxy-step-by-step.mdx',
  'usermanual/jmeter_distributed_testing_step_by_step.xml': 'user-manual/jmeter-distributed-testing-step-by-step.mdx',
  'usermanual/jmeter_accesslog_sampler_step_by_step.xml': 'user-manual/jmeter-accesslog-sampler-step-by-step.mdx',
  'usermanual/junitsampler_tutorial.xml': 'user-manual/junitsampler-tutorial.mdx',
  'usermanual/include_controller_tutorial.xml': 'user-manual/include-controller-tutorial.mdx',
  'usermanual/ldapops_tutor.xml': 'user-manual/ldapops-tutor.mdx',
  'usermanual/ldapanswer_xml.xml': 'user-manual/ldapanswer-xml.mdx',
  'usermanual/history_future.xml': 'user-manual/history-future.mdx',
  'changes.xml': 'user-manual/changes.mdx',
  'changes_history.xml': 'user-manual/changes-history.mdx',
  'extending/index.xml': 'extending/extending-jmeter.mdx',
  'devguide-dashboard.xml': 'extending/devguide-dashboard.mdx',
  'building.xml': 'reference/building.mdx',
  'creating-templates.xml': 'reference/creating-templates.mdx',
  'security.xml': 'reference/security.mdx',
  'download_jmeter.xml': 'reference/download-jmeter.mdx',
  'issues.xml': 'reference/issues.mdx',
  'mail.xml': 'reference/mail.mdx',
};

const ROUTE_MAP = {
  'component_reference': '/user-manual/component-reference/',
  'functions': '/user-manual/functions/',
  'properties_reference': '/user-manual/properties-reference/',
  'best-practices': '/user-manual/best-practices/',
  'get-started': '/getting-started/get-started/',
  'build-test-plan': '/user-manual/build-test-plan/',
  'test_plan': '/user-manual/test-plan/',
  'build-web-test-plan': '/user-manual/build-web-test-plan/',
  'build-adv-web-test-plan': '/user-manual/build-adv-web-test-plan/',
  'build-db-test-plan': '/user-manual/build-db-test-plan/',
  'build-ftp-test-plan': '/user-manual/build-ftp-test-plan/',
  'build-ldap-test-plan': '/user-manual/build-ldap-test-plan/',
  'build-ldapext-test-plan': '/user-manual/build-ldapext-test-plan/',
  'build-ws-test-plan': '/user-manual/build-ws-test-plan/',
  'build-jms-point-to-point-test-plan': '/user-manual/build-jms-point-to-point-test-plan/',
  'build-jms-topic-test-plan': '/user-manual/build-jms-topic-test-plan/',
  'build-programmatic-test-plan': '/user-manual/build-programmatic-test-plan/',
  'listeners': '/user-manual/listeners/',
  'remote-test': '/user-manual/remote-test/',
  'generating-dashboard': '/user-manual/generating-dashboard/',
  'realtime-results': '/user-manual/realtime-results/',
  'regular_expressions': '/user-manual/regular-expressions/',
  'glossary': '/user-manual/glossary/',
  'hints_and_tips': '/user-manual/hints-and-tips/',
  'changes': '/user-manual/changes/',
  'changes_history': '/user-manual/changes-history/',
  'history_future': '/user-manual/history-future/',
  'boss': '/user-manual/boss/',
  'curl': '/user-manual/curl/',
  'download_jmeter': '/reference/download-jmeter/',
  'building': '/reference/building/',
  'security': '/reference/security/',
  'issues': '/reference/issues/',
  'mail': '/reference/mail/',
};

const ENTITIES = {
  '&trade;': '™', '&hellip;': '…', '&le;': '≤', '&ge;': '≥',
  '&nnbsp;': '\u202F', '&mdash;': ' - ', '&ndash;': '-', '&nbsp;': '\u00A0',
  '&ccedil;': 'ç', '&eacute;': 'é', '&yen;': '¥', '&oacute;': 'ó',
  '&rarr;': '→', '&rArr;': '⇒', '&THORN;': 'Þ', '&vellip;': '⋮',
};

function resolveEntities(xml, sectNum) {
  let r = xml;
  if (sectNum) r = r.replaceAll('&sect-num;', sectNum);
  for (const [e, v] of Object.entries(ENTITIES)) {
    if (e !== '&sect-num;') r = r.replaceAll(e, v);
  }
  // Do NOT resolve standard XML entities here — the parser handles &lt; &gt; &amp; &quot; &apos;
  r = r.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)));
  r = r.replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
  return r;
}

// Post-process: resolve remaining XML entities in output text
// NOTE: Do NOT resolve &lt;/&gt; — MDX handles them natively and literal < > can break JSX parsing
function resolveOutputEntities(text) {
  return text
    .replaceAll('&amp;', '&')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'");
}

// Escape standalone { and } in plain text to prevent MDX expression parsing.
// Splits text by code blocks and inline code, escapes braces only in plain text segments.
function escapeCurlyBraces(text) {
  // Split by fenced code blocks (```...```)
  const codeBlockRegex = /(```[\s\S]*?```)/g;
  const segments = text.split(codeBlockRegex);

  return segments.map(segment => {
    // If it's a code block, return as-is
    if (segment.startsWith('```')) return segment;

    // Split by inline code (`...`)
    const inlineCodeRegex = /(`[^`]*`)/g;
    const parts = segment.split(inlineCodeRegex);

    return parts.map(part => {
      // If it's inline code, return as-is
      if (part.startsWith('`') && part.endsWith('`')) return part;

      // Plain text: escape { and } that aren't already escaped
      return part
        .replace(/(?<!\\)\{/g, '\\{')
        .replace(/(?<!\\)\}/g, '\\}');
    }).join('');
  }).join('');
}

function extractSectNum(xml) {
  const m = xml.match(/<!ENTITY\s+sect-num\s+'([^']+)'>/);
  return m ? m[1] : null;
}

function stripDoctype(xml) {
  return xml
    .replace(/<\?xml[^?]*\?>\s*/g, '')
    .replace(/<!DOCTYPE[\s\S]*?>\s*/g, '')
    .replace(/^\s*\]>\s*/gm, '');
}

function extractTitle(xml) {
  const m = xml.match(/<title>([^<]+)<\/title>/);
  return m ? resolveEntities(m[1], extractSectNum(xml)) : '';
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
  cdataPropName: '#cdata',
  preserveOrder: true,
  trimValues: false,
  parseTagValue: false,
  allowBooleanAttributes: true,
  processEntities: false,
  htmlEntities: true,
});

// --- Ordered-node converter ---
// With preserveOrder:true, each node is: { "tagName": [ ...children ], ":@": { "@_attr": "val" } }
// Text nodes are: { "#text": "..." }
// CDATA nodes are: { "#cdata": "..." }

function getAttrs(node) {
  if (!node || !node[':@']) return {};
  const attrs = {};
  for (const [k, v] of Object.entries(node[':@'])) {
    if (k.startsWith('@_')) attrs[k.slice(2)] = v;
  }
  return attrs;
}

function getTag(node) {
  if (!node) return null;
  for (const key of Object.keys(node)) {
    if (key !== ':@') return key;
  }
  return null;
}

function getChildren(node) {
  const tag = getTag(node);
  if (!tag) return [];
  return Array.isArray(node[tag]) ? node[tag] : [];
}

function walkOrdered(nodes, ctx = {}) {
  if (!Array.isArray(nodes)) return '';
  let out = '';
  for (const node of nodes) {
    out += convertOrderedNode(node, ctx);
  }
  return out;
}

function convertOrderedNode(node, ctx = {}) {
  if (!node || typeof node !== 'object') return '';
  const tag = getTag(node);
  if (!tag) return '';

  // Text / CDATA
  if (tag === '#text') return String(node['#text'] ?? '');
  if (tag === '#cdata') return String(node['#cdata'] ?? '');

  const attrs = getAttrs(node);
  const children = getChildren(node);
  const sectNum = ctx.sectNum || '';

  switch (tag) {
    case 'document':
      return walkOrdered(children, ctx);

    case 'properties': {
      // Document-level: skip (title in frontmatter)
      // Component-level: render property table
      const hasProperty = children.some(c => getTag(c) === 'property');
      if (hasProperty) return renderPropertyTable(children, ctx);
      return ''; // skip doc-level properties
    }

    case 'body':
      return walkOrdered(children, ctx);

    case 'section': {
      const name = (attrs.name || '').replaceAll('&sect-num;', sectNum);
      const level = ctx.sectionLevel || 2;
      const hashes = '#'.repeat(level);
      let out = `\n${hashes} ${name}\n\n`;
      out += walkOrdered(children, { ...ctx, sectionLevel: level + 1 });
      return out;
    }

    case 'subsection': {
      const name = (attrs.name || '').replaceAll('&sect-num;', sectNum);
      const level = Math.min(ctx.sectionLevel || 3, 6);
      const hashes = '#'.repeat(level);
      let out = `\n${hashes} ${name}\n\n`;
      out += walkOrdered(children, { ...ctx, sectionLevel: level + 1 });
      return out;
    }

    case 'description':
      return walkOrdered(children, ctx) + '\n';

    case 'component': {
      const name = attrs.name || '';
      const was = attrs.was ? ` _(formerly ${attrs.was})_` : '';
      const screenshot = attrs.screenshot;
      const anchor = name.replace(/[^a-zA-Z0-9]/g, '_');
      let out = `\n## ${name}${was}\n\n`;
      if (screenshot) out += `![${name}](/images/screenshots/${screenshot})\n\n`;
      out += walkOrdered(children, { ...ctx, componentName: name, componentAnchor: anchor });
      return out;
    }

    case 'property': {
      const propName = attrs.name || '';
      const required = attrs.required || 'No';
      const desc = walkOrdered(children, ctx).replace(/\n+/g, ' ').trim();
      return `| ${propName} | ${required} | ${desc} |\n`;
    }

    case 'links': {
      let out = '\n<div class="component-links">\n\n#### See Also\n\n';
      out += walkOrdered(children, { ...ctx, inLinks: true });
      out += '\n</div>\n\n';
      return out;
    }

    case 'link': {
      const href = attrs.href || '';
      const text = walkOrdered(children, ctx).trim();
      if (ctx.inLinks) {
        return `- [${text || href}](${resolveHref(href)})\n`;
      }
      return `[${text || href}](${resolveHref(href)})`;
    }

    case 'complink': {
      const name = attrs.name || '';
      const anchor = name.replace(/[^a-zA-Z0-9]/g, '_');
      return `[${name}](/user-manual/component-reference/#${anchor})`;
    }

    case 'funclink': {
      const name = attrs.name || '';
      const anchor = name.replace(/[()]/g, '_').replace(/__/, '__');
      return `[${name}](/user-manual/functions/#${anchor})`;
    }

    case 'apilink': {
      const href = attrs.href || '';
      const text = walkOrdered(children, ctx).trim() || href;
      return `[${text}](https://jmeter.apache.org/api/${href})`;
    }

    case 'bugzilla':
    case 'bug': {
      const num = walkOrdered(children, ctx).trim();
      return `[Bug ${num}](https://bz.apache.org/bugzilla/show_bug.cgi?id=${num})`;
    }

    case 'pr': {
      const num = walkOrdered(children, ctx).trim();
      return `[PR#${num}](https://github.com/apache/jmeter/pull/${num})`;
    }

    case 'issue': {
      const num = walkOrdered(children, ctx).trim();
      return `[Issue#${num}](https://github.com/apache/jmeter/issues/${num})`;
    }

    case 'rfc': {
      const rfcNum = attrs.link || walkOrdered(children, ctx).trim();
      const text = walkOrdered(children, ctx).trim() || `RFC ${rfcNum}`;
      return `[${text}](https://tools.ietf.org/html/${rfcNum})`;
    }

    case 'source': {
      const code = walkOrdered(children, ctx).trim();
      const lang = detectLanguage(code);
      return `\n\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case 'note': {
      const content = walkOrdered(children, ctx).trim();
      return `\n:::note\n${content}\n:::\n\n`;
    }

    case 'figure': {
      const image = attrs.image || '';
      const caption = walkOrdered(children, ctx).trim();
      if (!image) return '';
      let out = `![${caption || image}](/images/screenshots/${image})\n`;
      if (caption) out += `_${caption}_\n`;
      return out + '\n';
    }

    case 'example': {
      const title = attrs.title || 'Example';
      return `\n#### ${title}\n\n` + walkOrdered(children, ctx);
    }

    case 'menuchoice': {
      const items = [];
      for (const child of children) {
        const ct = getTag(child);
        if (ct === 'guimenuitem') {
          items.push(walkOrdered(getChildren(child), ctx).trim());
        } else if (ct === 'shortcut') {
          const keys = extractKeysFromOrdered(child);
          if (keys.length) items.push(`(${keys.join('+')})`);
        }
      }
      return `**${items.join(' → ')}**`;
    }

    case 'guimenuitem':
    case 'keysym':
    case 'shortcut':
      return ''; // handled by parent

    case 'keycombo': {
      const keys = [];
      for (const child of children) {
        if (getTag(child) === 'keysym') {
          keys.push(walkOrdered(getChildren(child), ctx).trim());
        }
      }
      return `\`${keys.join(' + ')}\``;
    }

    case 'ch_section': {
      const content = walkOrdered(children, ctx).trim();
      return `\n## ${content}\n\n`;
    }
    case 'ch_title': {
      const content = walkOrdered(children, ctx).trim();
      return `\n### ${content}\n\n`;
    }
    case 'ch_category': {
      const content = walkOrdered(children, ctx).trim();
      return `\n## ${content}\n\n`;
    }

    // --- Passthrough HTML elements ---
    case 'p':
      return walkOrdered(children, ctx) + '\n\n';

    case 'br':
      return '\n';

    case 'b':
    case 'strong': {
      const content = walkOrdered(children, ctx).trim();
      // Skip bold around code blocks — code blocks can't be bold
      if (content.startsWith('```') || content.endsWith('```')) {
        return content;
      }
      // For multi-line bold, use HTML <strong> to avoid Markdown parsing issues
      if (content.includes('\n')) {
        return `<strong>${content}</strong>`;
      }
      return `**${content}**`;
    }

    case 'i':
    case 'em':
      return `_${walkOrdered(children, ctx)}_`;

    case 'code':
    case 'tt':
      return `\`${walkOrdered(children, ctx)}\``;

    case 'pre':
      return `\n\`\`\`\n${walkOrdered(children, ctx).trim()}\n\`\`\`\n\n`;

    case 'a': {
      const href = attrs.href || '';
      const name = attrs.name;
      const text = walkOrdered(children, ctx).trim();
      if (name && !href) return `<a id="${name}"></a>`;
      if (href) return `[${text || href}](${resolveHref(href)})`;
      return text;
    }

    case 'ul': {
      let out = '\n';
      for (const child of children) {
        if (getTag(child) === 'li') {
          const content = walkOrdered(getChildren(child), ctx).replace(/\n+/g, ' ').trim();
          out += `- ${content}\n`;
        }
      }
      return out + '\n';
    }

    case 'ol': {
      let out = '\n';
      let i = 1;
      for (const child of children) {
        if (getTag(child) === 'li') {
          const content = walkOrdered(getChildren(child), ctx).replace(/\n+/g, ' ').trim();
          out += `${i++}. ${content}\n`;
        }
      }
      return out + '\n';
    }

    case 'li':
      return walkOrdered(children, ctx).trim();

    case 'dl': {
      let out = '\n';
      for (const child of children) {
        const ct = getTag(child);
        if (ct === 'dt') {
          out += `\n**${walkOrdered(getChildren(child), ctx).trim()}**\n`;
        } else if (ct === 'dd') {
          out += `: ${walkOrdered(getChildren(child), ctx).trim()}\n`;
        }
      }
      return out + '\n';
    }

    case 'dt':
      return `\n**${walkOrdered(children, ctx).trim()}**\n`;

    case 'dd':
      return `: ${walkOrdered(children, ctx).trim()}\n`;

    case 'table':
      return '\n' + convertOrderedTable(children, ctx) + '\n\n';

    case 'h1': case 'h2': case 'h3': case 'h4': case 'h5': {
      const level = parseInt(tag[1]) + 1;
      const hashes = '#'.repeat(Math.min(level, 6));
      return `\n${hashes} ${walkOrdered(children, ctx).trim()}\n\n`;
    }

    case 'div':
    case 'span':
    case 'sup':
    case 'sub':
    case 'u':
    case 'font':
    case 'center':
      return walkOrdered(children, ctx);

    case 'abbr':
      return walkOrdered(children, ctx);

    case 'hr':
      return '\n---\n\n';

    case 'img': {
      const src = attrs.src || '';
      const alt = attrs.alt || '';
      return `![${alt}](${src})`;
    }

    case 'style':
      return ''; // skip inline styles

    case 'title':
    case 'author':
      return ''; // handled in frontmatter

    default:
      return walkOrdered(children, ctx);
  }
}

function extractKeysFromOrdered(node) {
  const keys = [];
  const children = getChildren(node);
  for (const child of children) {
    const ct = getTag(child);
    if (ct === 'keycombo') {
      for (const kc of getChildren(child)) {
        if (getTag(kc) === 'keysym') {
          keys.push(walkOrdered(getChildren(kc), {}).trim());
        }
      }
    } else if (ct === 'keysym') {
      keys.push(walkOrdered(getChildren(child), {}).trim());
    }
  }
  return keys;
}

function renderPropertyTable(children, ctx) {
  let table = '\n| Name | Required | Description |\n';
  table += '|------|----------|-------------|\n';
  for (const child of children) {
    if (getTag(child) === 'property') {
      const attrs = getAttrs(child);
      const name = attrs.name || '';
      const required = attrs.required || 'No';
      const desc = walkOrdered(getChildren(child), ctx).replace(/\n+/g, ' ').trim();
      table += `| ${name} | ${required} | ${desc} |\n`;
    }
  }
  return table + '\n';
}

function convertOrderedTable(children, ctx) {
  const rows = [];
  const headerRows = [];

  // Find tbody or direct tr elements
  let trNodes = [];
  let theadTrNodes = [];

  for (const child of children) {
    const ct = getTag(child);
    if (ct === 'thead') {
      for (const tc of getChildren(child)) {
        if (getTag(tc) === 'tr') theadTrNodes.push(tc);
      }
    } else if (ct === 'tbody') {
      for (const tc of getChildren(child)) {
        if (getTag(tc) === 'tr') trNodes.push(tc);
      }
    } else if (ct === 'tr') {
      trNodes.push(child);
    }
  }

  for (const tr of theadTrNodes) {
    headerRows.push(convertOrderedRow(getChildren(tr), true, ctx));
  }
  for (const tr of trNodes) {
    rows.push(convertOrderedRow(getChildren(tr), false, ctx));
  }

  if (headerRows.length === 0 && rows.length > 0) {
    const firstRow = rows.shift();
    const cols = firstRow.split('|').filter(c => c.trim());
    headerRows.push('| ' + cols.map(() => '').join(' | ') + ' |');
    headerRows.push('| ' + cols.map(() => '---').join(' | ') + ' |');
  }

  let md = '';
  for (const h of headerRows) md += h + '\n';
  if (headerRows.length > 0 && !headerRows[headerRows.length - 1].includes('---')) {
    const cols = headerRows[0].split('|').filter(c => c.trim());
    md += '| ' + cols.map(() => '---').join(' | ') + ' |\n';
  }
  for (const r of rows) md += r + '\n';
  return md;
}

function convertOrderedRow(children, isHeader, ctx) {
  const cells = [];
  for (const child of children) {
    const ct = getTag(child);
    if (ct === 'th' || ct === 'td') {
      cells.push(walkOrdered(getChildren(child), ctx).replace(/\n+/g, ' ').trim());
    }
  }
  return '| ' + cells.join(' | ') + ' |';
}

function resolveHref(href) {
  if (!href) return '#';
  if (href.startsWith('http') || href.startsWith('mailto:')) return href;
  if (href.startsWith('#')) return href;

  if (href.endsWith('.html') || href.includes('.html#')) {
    const [baseAndHash, hash] = href.includes('#')
      ? [href.split('#')[0], href.split('#').slice(1).join('#')]
      : [href, ''];
    const base = baseAndHash.replace('.html', '');
    const route = ROUTE_MAP[base];
    if (route) {
      return hash ? `${route}#${hash}` : route;
    }
    const slug = base.replace(/_/g, '-');
    return hash ? `/${slug}/#${hash}` : `/${slug}/`;
  }

  return href;
}

function detectLanguage(code) {
  if (!code) return '';
  if (/^\s*\$/.test(code) || /\bsudo\b|\bapt-get\b|\byum\b|\bbrew\b/.test(code)) return 'bash';
  if (/^\s*(public|private|class|import|package)\s/.test(code)) return 'java';
  if (/^\s*<\?xml|<project\b|<dependency>/.test(code)) return 'xml';
  if (/^\s*[{[]/.test(code) && /[:,]/.test(code)) return 'json';
  if (/^\s*#\s*\w/.test(code)) return 'properties';
  return '';
}

function generateFrontmatter(title, description) {
  const desc = (description || title || '').slice(0, 157).replace(/"/g, "'");
  return `---
title: "${title.replace(/"/g, "'")}"
description: "${desc}"
---

`;
}

function convertFile(srcPath, destPath) {
  const xml = fs.readFileSync(srcPath, 'utf-8');
  const sectNum = extractSectNum(xml);
  const title = extractTitle(xml);
  const cleaned = resolveEntities(stripDoctype(xml), sectNum);

  let parsed;
  try {
    parsed = parser.parse(cleaned);
  } catch (e) {
    console.error(`  PARSE ERROR: ${srcPath}: ${e.message}`);
    return false;
  }

  const body = walkOrdered(parsed, { sectNum, sectionLevel: 2 });
  // Post-process: remove DOCTYPE artifacts and resolve remaining entities
  let cleanBody = resolveOutputEntities(body
    .replace(/^\s*\]>\s*\n?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim());
  // Escape ${...} inside inline code spans to prevent MDX template expression parsing
  cleanBody = cleanBody.replace(/`([^`]*\$\{[^`]*?)`/g, (_, content) => {
    return '`' + content.replace(/\$\{/g, '\\${') + '`';
  });
  // Remove CGI template directives like [if-any ...], [end], [param ...]
  cleanBody = cleanBody.replace(/\[if-any\s+[^\]]*\][\s\S]*?\[end\]/g, '');
  cleanBody = cleanBody.replace(/\[(?:if-any|end|param|value)\s*[^\]]*\]/g, '');
  // Clean up bold markers around code blocks: **```...```** → ```...```
  cleanBody = cleanBody.replace(/\*\*(```[\s\S]*?```)\*\*/g, '$1');
  // Escape standalone { and } in plain text (outside code blocks, backticks, and frontmatter)
  // Split by code blocks and inline code to avoid escaping inside them
  cleanBody = escapeCurlyBraces(cleanBody);
  const firstPara = cleanBody.match(/^(?!#|[!:\-|<`*\n\s])\s*[^\n]{10,}/);
  const description = firstPara ? firstPara[0].trim().slice(0, 157) : title;

  const mdx = generateFrontmatter(title, description) + cleanBody;
  const destDir = path.dirname(path.resolve(destPath));
  fs.mkdirSync(destDir, { recursive: true });
  fs.writeFileSync(path.resolve(destPath), mdx, 'utf-8');
  return true;
}

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    entry.isDirectory() ? copyDirRecursive(s, d) : fs.copyFileSync(s, d);
  }
}

// Main
console.log('Converting JMeter xdocs → MDX...');
console.log(`  Source: ${JMETER_XDOCS}`);
console.log(`  Output: ${OUTPUT_DIR}`);

let converted = 0, failed = 0;

for (const [srcRel, destRel] of Object.entries(FILE_MAP)) {
  const srcPath = path.join(JMETER_XDOCS, srcRel);
  if (!fs.existsSync(srcPath)) {
    console.log(`  SKIP: ${srcRel}`);
    continue;
  }
  const destPath = path.join(OUTPUT_DIR, destRel);
  if (convertFile(srcPath, destPath)) {
    console.log(`  OK: ${srcRel} → ${destRel}`);
    converted++;
  } else {
    failed++;
  }
}

console.log(`\n  Converted: ${converted}, Failed: ${failed}`);

console.log('\nCopying assets...');
const imgSrc = path.join(JMETER_XDOCS, 'images');
if (fs.existsSync(imgSrc)) {
  copyDirRecursive(imgSrc, path.join(IMAGES_DIR));
  console.log('  Images copied');
}

const noticeSrc = path.join(path.dirname(JMETER_XDOCS), 'NOTICE');
if (fs.existsSync(noticeSrc)) {
  fs.copyFileSync(noticeSrc, path.resolve('public/NOTICE'));
  console.log('  NOTICE copied');
}

console.log('\nDone!');
