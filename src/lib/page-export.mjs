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
      tag === 'svg' ||
      tag === 'button' ||
      tag === 'form' ||
      tag === 'select' ||
      tag === 'option' ||
      tag === 'input' ||
      tag === 'textarea' ||
      tag === 'label' ||
      el.hasAttribute('data-doc-actions') ||
      el.classList?.contains('faq-section') ||
      el.classList?.contains('heading-copy-link') ||
      el.classList?.contains('sl-anchor-link') ||
      el.classList?.contains('tool')
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
          el.getAttribute('data-language') ||
          Array.from(code?.classList || [])
            .find((c) => c.startsWith('language-'))
            ?.replace('language-', '') ||
          '';
        // Expressive Code renders each source line as a <div class="ec-line">;
        // plain textContent would lose the line breaks.
        const ecLines = Array.from(code?.children || []).filter((c) =>
          c.classList?.contains('ec-line'),
        );
        const body = (
          ecLines.length
            ? ecLines.map((line) => line.textContent || '').join('\n')
            : code?.textContent || el.textContent || ''
        ).replace(/\n$/, '');
        if (!body.trim()) return '';
        // Terminal frames carry only an sr-only "Terminal window" label in
        // the figcaption — the real filename lives in span.title.
        const caption =
          el.closest('figure')
            ?.querySelector('figcaption .title')
            ?.textContent?.trim() || '';
        const title = caption ? `**${caption}**\n` : '';
        return `\n\n${title}\`\`\`${lang}\n${body}\n\`\`\`\n\n`;
      }
      case 'figcaption':
        // Expressive Code frame headers are re-emitted as **title** by the
        // pre case; skip the stray text here.
        return '';
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
        // GFM pipe table: thead row (or first row) becomes the header.
        // :scope keeps nested tables' rows/cells out of the outer table.
        const cellText = (cell) => {
          const raw = cell.querySelector('pre,table,ul,ol,figure,blockquote')
            ? (cell.textContent || '').replace(/\s+/g, ' ')
            : walk(cell).replace(/\s*\n\s*/g, ' ');
          return raw.replace(/\|/g, '\\|').trim();
        };
        const thead = el.querySelector(':scope > thead');
        const rows = Array.from(
          el.querySelectorAll(
            ':scope > thead > tr, :scope > tbody > tr, :scope > tfoot > tr, :scope > tr',
          ),
        );
        const headerRow = thead ? thead.querySelector(':scope > tr') : rows[0];
        const headerCells = headerRow
          ? Array.from(headerRow.querySelectorAll(':scope > th, :scope > td'))
          : [];
        if (!headerCells.length) return '';
        const bodyRows = rows.filter(
          (tr) => tr !== headerRow && !(thead && thead.contains(tr)),
        );
        const lines = [
          `| ${headerCells.map(cellText).join(' | ')} |`,
          `| ${headerCells.map(() => '---').join(' | ')} |`,
          ...bodyRows.map(
            (tr) =>
              `| ${Array.from(tr.querySelectorAll(':scope > th, :scope > td'))
                .map(cellText)
                .join(' | ')} |`,
          ),
        ];
        return `\n\n${lines.join('\n')}\n\n`;
      }
      case 'aside': {
        if (!el.classList?.contains('starlight-aside')) return children();
        const titleEl = el.querySelector('.starlight-aside__title');
        const title = titleEl
          ? Array.from(titleEl.childNodes)
              .filter(
                (n) => !(n.nodeType === 1 && n.tagName?.toLowerCase() === 'svg'),
              )
              .map((n) => n.textContent || '')
              .join('')
              .trim()
          : el.getAttribute('aria-label') || '';
        const body = collapseWhitespace(
          Array.from(el.childNodes)
            .filter(
              (n) =>
                !(
                  n.nodeType === 1 &&
                  n.classList?.contains('starlight-aside__title')
                ),
            )
            .map(walk)
            .join(''),
        );
        const lines = title ? [`> **${title}**`] : [];
        for (const line of body.split('\n')) {
          lines.push(line.trim() ? `> ${line}` : '>');
        }
        return lines.length ? `\n\n${lines.join('\n')}\n\n` : '';
      }
      case 'starlight-tabs': {
        const tablist = el.querySelector('[role="tablist"]') || el;
        const tabs = Array.from(tablist.querySelectorAll('[role="tab"]'));
        const panels = Array.from(el.querySelectorAll('[role="tabpanel"]'));
        const parts = panels.map((panel, i) => {
          const label = tabs[i]?.textContent?.trim();
          const content = collapseWhitespace(walk(panel));
          return [label ? `**${label}**` : '', content]
            .filter(Boolean)
            .join('\n\n');
        });
        return parts.length ? `\n\n${parts.join('\n\n')}\n\n` : '';
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
