/**
 * Helpers for "Copy as Markdown" and "Cite for AI" page exports.
 * Pure functions so unit tests can cover citation formatting and
 * lightweight HTML → Markdown conversion without a browser.
 */

/**
 * Build a short citation block for pasting into AI chats or notes.
 * @param {{ title?: string, url: string, description?: string, lastUpdated?: string | null }} opts
 * @returns {string}
 */
export function buildCitation({ title, url, description, lastUpdated }) {
  const lines = [];
  const heading = (title && String(title).trim()) || 'docs.jmeter.ai';
  lines.push(`# ${heading}`);
  if (description && String(description).trim()) {
    lines.push('');
    lines.push(String(description).trim());
  }
  lines.push('');
  lines.push(`Source: ${url}`);
  if (lastUpdated) {
    lines.push(`Last updated: ${lastUpdated}`);
  }
  lines.push('Site: https://docs.jmeter.ai (community Apache JMeter documentation)');
  return lines.join('\n');
}

/**
 * Escape text that will sit inside Markdown link labels/URLs when needed.
 * @param {string} text
 * @returns {string}
 */
function collapseWhitespace(text) {
  return String(text || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Convert a limited subset of HTML (Starlight article body) to Markdown.
 * Designed for client-side use on already-rendered docs pages.
 * @param {ParentNode | null | undefined} root
 * @returns {string}
 */
export function htmlToMarkdown(root) {
  if (!root) return '';

  /** @param {Node} node */
  function walk(node) {
    if (node.nodeType === 3) {
      // Text
      return node.textContent || '';
    }
    if (node.nodeType !== 1) return '';

    const el = /** @type {HTMLElement} */ (node);
    const tag = el.tagName.toLowerCase();

    // Skip UI chrome / non-content
    if (
      tag === 'script' ||
      tag === 'style' ||
      tag === 'noscript' ||
      el.hasAttribute('data-doc-actions') ||
      el.classList?.contains('faq-section')
    ) {
      return '';
    }

    const children = () => Array.from(el.childNodes).map(walk).join('');

    switch (tag) {
      case 'h1':
        return `\n\n# ${children().trim()}\n\n`;
      case 'h2':
        return `\n\n## ${children().trim()}\n\n`;
      case 'h3':
        return `\n\n### ${children().trim()}\n\n`;
      case 'h4':
        return `\n\n#### ${children().trim()}\n\n`;
      case 'p':
        return `\n\n${children().trim()}\n\n`;
      case 'br':
        return '\n';
      case 'hr':
        return '\n\n---\n\n';
      case 'strong':
      case 'b':
        return `**${children().trim()}**`;
      case 'em':
      case 'i':
        return `*${children().trim()}*`;
      case 'code': {
        // Inline code unless inside pre
        if (el.parentElement?.tagName?.toLowerCase() === 'pre') {
          return children();
        }
        return `\`${children().replace(/`/g, '\\`')}\``;
      }
      case 'pre': {
        const code = el.querySelector('code');
        const lang =
          Array.from(code?.classList || [])
            .find((c) => c.startsWith('language-'))
            ?.replace('language-', '') || '';
        const body = (code?.textContent || el.textContent || '').replace(/\n$/, '');
        return `\n\n\`\`\`${lang}\n${body}\n\`\`\`\n\n`;
      }
      case 'a': {
        const href = el.getAttribute('href') || '';
        const label = children().trim() || href;
        if (!href || href.startsWith('#')) return label;
        return `[${label}](${href})`;
      }
      case 'ul':
        return (
          '\n\n' +
          Array.from(el.children)
            .filter((c) => c.tagName?.toLowerCase() === 'li')
            .map((li) => `- ${walk(li).trim().replace(/^\n+|\n+$/g, '')}`)
            .join('\n') +
          '\n\n'
        );
      case 'ol':
        return (
          '\n\n' +
          Array.from(el.children)
            .filter((c) => c.tagName?.toLowerCase() === 'li')
            .map((li, i) => `${i + 1}. ${walk(li).trim().replace(/^\n+|\n+$/g, '')}`)
            .join('\n') +
          '\n\n'
        );
      case 'li':
        return children();
      case 'blockquote':
        return (
          '\n\n' +
          children()
            .trim()
            .split('\n')
            .map((line) => `> ${line}`)
            .join('\n') +
          '\n\n'
        );
      case 'table': {
        // Flatten tables to readable lines
        const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
          Array.from(tr.querySelectorAll('th,td'))
            .map((cell) => (cell.textContent || '').trim())
            .join(' | '),
        );
        return rows.length ? `\n\n${rows.join('\n')}\n\n` : '';
      }
      case 'img': {
        const alt = el.getAttribute('alt') || 'image';
        const src = el.getAttribute('src') || '';
        return src ? `\n\n![${alt}](${src})\n\n` : '';
      }
      default:
        return children();
    }
  }

  return collapseWhitespace(walk(root));
}

/**
 * Wrap page Markdown with a YAML-ish header for AI paste workflows.
 * @param {{ title?: string, url: string, markdown: string }} opts
 * @returns {string}
 */
export function buildMarkdownExport({ title, url, markdown }) {
  const heading = (title && String(title).trim()) || 'docs.jmeter.ai';
  const body = String(markdown || '').trim();
  return [
    `---`,
    `title: ${heading}`,
    `url: ${url}`,
    `source: docs.jmeter.ai`,
    `---`,
    ``,
    body,
    ``,
    `---`,
    `Copied from ${url}`,
  ].join('\n');
}
