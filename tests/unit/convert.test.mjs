import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import {
  resolveEntities,
  resolveOutputEntities,
  escapeCurlyBraces,
  extractSectNum,
  stripDoctype,
  extractTitle,
  getAttrs,
  getTag,
  getChildren,
  walkOrdered,
  convertOrderedNode,
  renderPropertyTable,
  convertOrderedTable,
  convertOrderedRow,
  resolveHref,
  detectLanguage,
  generateFrontmatter,
  convertFile,
  copyDirRecursive,
  parser,
  FILE_MAP,
  ROUTE_MAP,
  ENTITIES,
  splitFrontmatter,
  parseFrontmatterFields,
  serializeFrontmatter,
  extractImportLines,
  extractLeadingAdmonitions,
  extractCustomSections,
  computeAutoDescription,
  mergeFrontmatter,
  PRESERVED_FM_FIELDS,
} from '../../tools/convert.mjs';

// Helper: parse XML string into ordered node array
function parse(xml) {
  return parser.parse(xml);
}

// Helper: make a text node
function textNode(content) {
  return { '#text': content };
}

// Helper: make an element node
function el(tag, children = [], attrs = {}) {
  const node = { [tag]: children };
  if (Object.keys(attrs).length > 0) {
    node[':@'] = {};
    for (const [k, v] of Object.entries(attrs)) {
      node[':@'][`@_${k}`] = v;
    }
  }
  return node;
}

describe('ENTITIES', () => {
  it('contains expected entity mappings', () => {
    expect(ENTITIES['&trade;']).toBe('™');
    expect(ENTITIES['&hellip;']).toBe('…');
    expect(ENTITIES['&le;']).toBe('≤');
    expect(ENTITIES['&ge;']).toBe('≥');
    expect(ENTITIES['&rarr;']).toBe('→');
    expect(ENTITIES['&nbsp;']).toBe('\u00A0');
  });
});

describe('resolveEntities', () => {
  it('resolves &sect-num; with provided sectNum', () => {
    expect(resolveEntities('Section &sect-num; here', '5.1')).toBe('Section 5.1 here');
  });

  it('resolves named entities', () => {
    expect(resolveEntities('Cost &yen;500', '')).toBe('Cost ¥500');
    expect(resolveEntities('A &rarr; B', '')).toBe('A → B');
  });

  it('resolves hex numeric entities', () => {
    expect(resolveEntities('&#x2014;', '')).toBe('—');
    expect(resolveEntities('&#x2713;', '')).toBe('✓');
  });

  it('resolves decimal numeric entities', () => {
    expect(resolveEntities('&#8212;', '')).toBe('—');
    expect(resolveEntities('&#65;', '')).toBe('A');
  });

  it('does not resolve standard XML entities (&lt; &gt; &amp;)', () => {
    expect(resolveEntities('&lt;tag&gt;', '')).toBe('&lt;tag&gt;');
    expect(resolveEntities('&amp;', '')).toBe('&amp;');
  });

  it('handles empty input', () => {
    expect(resolveEntities('', '')).toBe('');
  });
});

describe('resolveOutputEntities', () => {
  it('resolves &amp; to &', () => {
    expect(resolveOutputEntities('A &amp; B')).toBe('A & B');
  });

  it('resolves &quot; to "', () => {
    expect(resolveOutputEntities('Say &quot;hi&quot;')).toBe('Say "hi"');
  });

  it('resolves &apos; to single quote', () => {
    expect(resolveOutputEntities("don&apos;t")).toBe("don't");
  });
});

describe('escapeCurlyBraces', () => {
  it('escapes { and } in plain text', () => {
    expect(escapeCurlyBraces('Hello {world}')).toBe('Hello \\{world\\}');
  });

  it('does not escape inside code blocks', () => {
    const input = '```\nconst x = { foo: 1 };\n```';
    expect(escapeCurlyBraces(input)).toBe(input);
  });

  it('does not escape inside inline code', () => {
    const input = 'Use `{ foo }` syntax';
    expect(escapeCurlyBraces(input)).toBe(input);
  });

  it('does not double-escape already escaped braces', () => {
    expect(escapeCurlyBraces('Already \\{escaped\\}')).toBe('Already \\{escaped\\}');
  });

  it('handles mixed content', () => {
    const input = 'Text {x} and `code {y}` and ```\nblock {z}\n```';
    const result = escapeCurlyBraces(input);
    expect(result).toContain('Text \\{x\\}');
    expect(result).toContain('`code {y}`');
    expect(result).toContain('block {z}');
  });
});

describe('extractSectNum', () => {
  it('extracts sect-num from DOCTYPE ENTITY', () => {
    const xml = `<!ENTITY sect-num '3.2'>`;
    expect(extractSectNum(xml)).toBe('3.2');
  });

  it('returns null when no sect-num found', () => {
    expect(extractSectNum('<document></document>')).toBeNull();
  });
});

describe('stripDoctype', () => {
  it('removes XML declaration', () => {
    expect(stripDoctype('<?xml version="1.0"?>content')).toBe('content');
  });

  it('removes DOCTYPE declarations', () => {
    expect(stripDoctype('<!DOCTYPE test [<!ENTITY foo "bar">]>content')).toBe('content');
  });

  it('removes trailing ]> artifacts', () => {
    expect(stripDoctype(']>\ncontent')).toBe('content');
  });

  it('handles multiple declarations', () => {
    const input = '<?xml version="1.0"?>\n<!DOCTYPE test>\ncontent';
    expect(stripDoctype(input)).toBe('content');
  });
});

describe('extractTitle', () => {
  it('extracts title from <title> tag', () => {
    expect(extractTitle('<title>My Page</title>')).toBe('My Page');
  });

  it('resolves entities in title', () => {
    // extractTitle calls resolveEntities which doesn't touch &amp;
    // &amp; is a standard XML entity handled by the parser, not resolveEntities
    expect(extractTitle('<title>Test &amp; Demo</title>')).toBe('Test &amp; Demo');
    // But custom entities are resolved:
    expect(extractTitle('<title>Cost &yen;500</title>')).toBe('Cost ¥500');
  });

  it('returns empty string when no title', () => {
    expect(extractTitle('<document></document>')).toBe('');
  });
});

describe('getAttrs', () => {
  it('extracts attributes from a node', () => {
    const node = el('a', [], { href: '/test', name: 'foo' });
    expect(getAttrs(node)).toEqual({ href: '/test', name: 'foo' });
  });

  it('returns empty object for null node', () => {
    expect(getAttrs(null)).toEqual({});
  });

  it('returns empty object for node without :@', () => {
    expect(getAttrs({ a: [] })).toEqual({});
  });
});

describe('getTag', () => {
  it('returns the tag name', () => {
    expect(getTag({ section: [] })).toBe('section');
  });

  it('skips :@ key', () => {
    expect(getTag({ ':@': {}, section: [] })).toBe('section');
  });

  it('returns null for empty node', () => {
    expect(getTag(null)).toBeNull();
    expect(getTag({})).toBeNull();
  });
});

describe('getChildren', () => {
  it('returns children array', () => {
    const children = [textNode('hi'), el('b', [textNode('bold')])];
    const node = el('p', children);
    expect(getChildren(node)).toEqual(children);
  });

  it('returns empty array for node without children', () => {
    expect(getChildren({})).toEqual([]);
  });

  it('handles non-array children by wrapping in array', () => {
    // The parser with preserveOrder:true always returns arrays,
    // but getChildren has a fallback for non-array values
    const node = { p: textNode('single') };
    // Non-array children returns empty array (fallback)
    expect(getChildren(node)).toEqual([]);
  });
});

describe('walkOrdered', () => {
  it('walks a simple document', () => {
    const nodes = [el('document', [el('body', [el('p', [textNode('Hello')])])])];
    expect(walkOrdered(nodes).trim()).toBe('Hello');
  });

  it('returns empty string for non-array input', () => {
    expect(walkOrdered(null)).toBe('');
    expect(walkOrdered('string')).toBe('');
  });

  it('handles text nodes', () => {
    expect(walkOrdered([textNode('plain text')])).toBe('plain text');
  });

  it('handles CDATA nodes', () => {
    expect(walkOrdered([{ '#cdata': 'raw content' }])).toBe('raw content');
  });
});

describe('convertOrderedNode', () => {
  it('converts <p> tags', () => {
    const node = el('p', [textNode('Paragraph text')]);
    expect(convertOrderedNode(node).trim()).toBe('Paragraph text');
  });

  it('converts <b> tags to bold', () => {
    const node = el('b', [textNode('bold')]);
    expect(convertOrderedNode(node)).toBe('**bold**');
  });

  it('converts <strong> tags to bold', () => {
    const node = el('strong', [textNode('strong')]);
    expect(convertOrderedNode(node)).toBe('**strong**');
  });

  it('converts <i> tags to italic', () => {
    const node = el('i', [textNode('italic')]);
    expect(convertOrderedNode(node)).toBe('_italic_');
  });

  it('converts <em> tags to italic', () => {
    const node = el('em', [textNode('em')]);
    expect(convertOrderedNode(node)).toBe('_em_');
  });

  it('converts <code> tags to inline code', () => {
    const node = el('code', [textNode('code')]);
    expect(convertOrderedNode(node)).toBe('`code`');
  });

  it('converts <tt> tags to inline code', () => {
    const node = el('tt', [textNode('teletype')]);
    expect(convertOrderedNode(node)).toBe('`teletype`');
  });

  it('converts <br> to newline', () => {
    expect(convertOrderedNode(el('br'))).toBe('\n');
  });

  it('converts <hr> to markdown hr', () => {
    expect(convertOrderedNode(el('hr'))).toBe('\n---\n\n');
  });

  it('converts <note> to admonition', () => {
    const node = el('note', [textNode('Important note')]);
    expect(convertOrderedNode(node).trim()).toBe(':::note\nImportant note\n:::');
  });

  it('converts <source> to code block', () => {
    const node = el('source', [textNode('$ jmeter -n -t test.jmx')]);
    const result = convertOrderedNode(node);
    expect(result).toContain('```bash');
    expect(result).toContain('jmeter -n -t test.jmx');
  });

  it('converts <pre> to code block', () => {
    const node = el('pre', [textNode('  preformatted  ')]);
    expect(convertOrderedNode(node)).toContain('```');
    expect(convertOrderedNode(node)).toContain('preformatted');
  });

  it('converts <figure> with image', () => {
    const node = el('figure', [textNode('Caption')], { image: 'test.png' });
    const result = convertOrderedNode(node);
    expect(result).toContain('![Caption](/images/screenshots/test.png)');
    expect(result).toContain('_Caption_');
  });

  it('converts <figure> without image returns empty', () => {
    const node = el('figure', [textNode('Caption')]);
    expect(convertOrderedNode(node)).toBe('');
  });

  it('converts <example> with title', () => {
    const node = el('example', [textNode('content')], { title: 'My Example' });
    expect(convertOrderedNode(node)).toContain('#### My Example');
    expect(convertOrderedNode(node)).toContain('content');
  });

  it('converts <example> without title uses default', () => {
    const node = el('example', [textNode('content')]);
    expect(convertOrderedNode(node)).toContain('#### Example');
  });

  it('converts <complink> to component reference link', () => {
    const node = el('complink', [], { name: 'HTTP Request' });
    expect(convertOrderedNode(node)).toBe('[HTTP Request](/user-manual/component-reference/#HTTP_Request)');
  });

  it('converts <funclink> to function reference link', () => {
    const node = el('funclink', [], { name: '__time()' });
    const result = convertOrderedNode(node);
    expect(result).toContain('[__time()]');
    expect(result).toContain('/user-manual/functions/#');
  });

  it('converts <apilink> to external API link', () => {
    const node = el('apilink', [textNode('JMeter API')], { href: 'org/apache/jmeter/JMeter.html' });
    expect(convertOrderedNode(node)).toBe('[JMeter API](https://jmeter.apache.org/api/org/apache/jmeter/JMeter.html)');
  });

  it('converts <bugzilla> to bugzilla link', () => {
    const node = el('bugzilla', [textNode('12345')]);
    expect(convertOrderedNode(node)).toBe('[Bug 12345](https://bz.apache.org/bugzilla/show_bug.cgi?id=12345)');
  });

  it('converts <bug> to bugzilla link', () => {
    const node = el('bug', [textNode('67890')]);
    expect(convertOrderedNode(node)).toBe('[Bug 67890](https://bz.apache.org/bugzilla/show_bug.cgi?id=67890)');
  });

  it('converts <pr> to GitHub PR link', () => {
    const node = el('pr', [textNode('42')]);
    expect(convertOrderedNode(node)).toBe('[PR#42](https://github.com/apache/jmeter/pull/42)');
  });

  it('converts <issue> to GitHub issue link', () => {
    const node = el('issue', [textNode('99')]);
    expect(convertOrderedNode(node)).toBe('[Issue#99](https://github.com/apache/jmeter/issues/99)');
  });

  it('converts <section> with name', () => {
    const node = el('section', [el('p', [textNode('content')])], { name: 'My Section' });
    const result = convertOrderedNode(node);
    expect(result).toContain('## My Section');
    expect(result).toContain('content');
  });

  it('converts <subsection> with name', () => {
    const node = el('subsection', [el('p', [textNode('content')])], { name: 'Sub' });
    const result = convertOrderedNode(node);
    expect(result).toContain('### Sub');
  });

  it('converts <component> with name and screenshot', () => {
    const node = el('component', [textNode('desc')], { name: 'HTTP Request', screenshot: 'http.png' });
    const result = convertOrderedNode(node);
    expect(result).toContain('## HTTP Request');
    expect(result).toContain('![HTTP Request](/images/screenshots/http.png)');
  });

  it('converts <component> with was attribute', () => {
    const node = el('component', [textNode('desc')], { name: 'New Name', was: 'Old Name' });
    const result = convertOrderedNode(node);
    expect(result).toContain('_(formerly Old Name)_');
  });

  it('converts <links> block', () => {
    const node = el('links', [el('link', [textNode('Related')], { href: 'test.html' })]);
    const result = convertOrderedNode(node);
    expect(result).toContain('class="component-links"');
    expect(result).toContain('#### See Also');
    expect(result).toContain('- [Related]');
  });

  it('converts <link> outside links block', () => {
    const node = el('link', [textNode('Click')], { href: 'page.html' });
    expect(convertOrderedNode(node)).toBe('[Click](/page/)');
  });

  it('converts <a> with href', () => {
    const node = el('a', [textNode('text')], { href: 'https://example.com' });
    expect(convertOrderedNode(node)).toBe('[text](https://example.com)');
  });

  it('converts <a> with name only (anchor)', () => {
    const node = el('a', [], { name: 'anchor1' });
    expect(convertOrderedNode(node)).toBe('<a id="anchor1"></a>');
  });

  it('converts <ul> list', () => {
    const node = el('ul', [el('li', [textNode('item 1')]), el('li', [textNode('item 2')])]);
    const result = convertOrderedNode(node);
    expect(result).toContain('- item 1');
    expect(result).toContain('- item 2');
  });

  it('converts <ol> list', () => {
    const node = el('ol', [el('li', [textNode('first')]), el('li', [textNode('second')])]);
    const result = convertOrderedNode(node);
    expect(result).toContain('1. first');
    expect(result).toContain('2. second');
  });

  it('converts <dl> definition list', () => {
    const node = el('dl', [el('dt', [textNode('Term')]), el('dd', [textNode('Definition')])]);
    const result = convertOrderedNode(node);
    expect(result).toContain('**Term**');
    expect(result).toContain(': Definition');
  });

  it('converts <img> tags', () => {
    const node = el('img', [], { src: '/img/test.png', alt: 'Test' });
    expect(convertOrderedNode(node)).toBe('![Test](/img/test.png)');
  });

  it('skips <style> tags', () => {
    const node = el('style', [textNode('.foo { color: red; }')]);
    expect(convertOrderedNode(node)).toBe('');
  });

  it('skips <title> and <author> tags', () => {
    expect(convertOrderedNode(el('title', [textNode('Title')]))).toBe('');
    expect(convertOrderedNode(el('author', [textNode('Author')]))).toBe('');
  });

  it('converts <menuchoice> with guimenuitem', () => {
    const node = el('menuchoice', [
      el('guimenuitem', [textNode('File')]),
      el('shortcut', [el('keycombo', [el('keysym', [textNode('Ctrl+S')])])]),
    ]);
    const result = convertOrderedNode(node);
    expect(result).toContain('**File');
    expect(result).toContain('Ctrl+S');
  });

  it('converts <keycombo> to keyboard shortcut', () => {
    const node = el('keycombo', [el('keysym', [textNode('Ctrl')]), el('keysym', [textNode('K')])]);
    expect(convertOrderedNode(node)).toBe('`Ctrl + K`');
  });

  it('converts <ch_section>', () => {
    const node = el('ch_section', [textNode('Section Title')]);
    expect(convertOrderedNode(node).trim()).toBe('## Section Title');
  });

  it('converts <ch_title>', () => {
    const node = el('ch_title', [textNode('Subtitle')]);
    expect(convertOrderedNode(node).trim()).toBe('### Subtitle');
  });

  it('converts <ch_category>', () => {
    const node = el('ch_category', [textNode('Category')]);
    expect(convertOrderedNode(node).trim()).toBe('## Category');
  });

  it('converts heading tags h1-h5', () => {
    expect(convertOrderedNode(el('h1', [textNode('H1')])).trim()).toBe('## H1');
    expect(convertOrderedNode(el('h2', [textNode('H2')])).trim()).toBe('### H2');
    expect(convertOrderedNode(el('h3', [textNode('H3')])).trim()).toBe('#### H3');
  });

  it('converts passthrough elements (div, span, sup, sub)', () => {
    expect(convertOrderedNode(el('div', [textNode('content')]))).toBe('content');
    expect(convertOrderedNode(el('span', [textNode('content')]))).toBe('content');
    expect(convertOrderedNode(el('sup', [textNode('2')]))).toBe('2');
    expect(convertOrderedNode(el('sub', [textNode('n')]))).toBe('n');
  });

  it('converts <abbr> as passthrough', () => {
    expect(convertOrderedNode(el('abbr', [textNode('JMX')]))).toBe('JMX');
  });

  it('returns empty for null/invalid node', () => {
    expect(convertOrderedNode(null)).toBe('');
    expect(convertOrderedNode('string')).toBe('');
  });

  it('handles unknown tags by walking children', () => {
    const node = el('unknown', [textNode('content')]);
    expect(convertOrderedNode(node)).toBe('content');
  });

  it('converts <property> to table row', () => {
    const node = el('property', [textNode('desc')], { name: 'prop1', required: 'Yes' });
    expect(convertOrderedNode(node)).toBe('| prop1 | Yes | desc |\n');
  });

  it('converts <properties> with property children to table', () => {
    const node = el('properties', [
      el('property', [textNode('desc1')], { name: 'p1', required: 'No' }),
      el('property', [textNode('desc2')], { name: 'p2', required: 'Yes' }),
    ]);
    const result = convertOrderedNode(node);
    expect(result).toContain('| Name | Required | Description |');
    expect(result).toContain('| p1 | No | desc1 |');
    expect(result).toContain('| p2 | Yes | desc2 |');
  });

  it('skips document-level <properties> without property children', () => {
    const node = el('properties', [textNode('some text')]);
    expect(convertOrderedNode(node)).toBe('');
  });

  it('converts <description> tag', () => {
    const node = el('description', [textNode('Some description')]);
    expect(convertOrderedNode(node).trim()).toBe('Some description');
  });

  it('converts <body> tag', () => {
    const node = el('body', [textNode('Body content')]);
    expect(convertOrderedNode(node).trim()).toBe('Body content');
  });

  it('converts <document> tag', () => {
    const node = el('document', [textNode('Doc content')]);
    expect(convertOrderedNode(node)).toBe('Doc content');
  });

  it('handles <b> around code blocks (skips bold)', () => {
    const node = el('b', [textNode('```\ncode\n```')]);
    expect(convertOrderedNode(node)).not.toContain('**');
  });

  it('handles multiline <b> with HTML strong', () => {
    const node = el('b', [textNode('line1\nline2')]);
    expect(convertOrderedNode(node)).toContain('<strong>');
  });
});

describe('renderPropertyTable', () => {
  it('renders a property table from children', () => {
    const children = [
      el('property', [textNode('First prop')], { name: 'foo', required: 'No' }),
      el('property', [textNode('Second prop')], { name: 'bar', required: 'Yes' }),
    ];
    const result = renderPropertyTable(children);
    expect(result).toContain('| Name | Required | Description |');
    expect(result).toContain('|------|----------|-------------|');
    expect(result).toContain('| foo | No | First prop |');
    expect(result).toContain('| bar | Yes | Second prop |');
  });

  it('skips non-property children', () => {
    const children = [
      el('property', [textNode('desc')], { name: 'p1', required: 'No' }),
      textNode('ignored'),
    ];
    const result = renderPropertyTable(children);
    expect(result).toContain('| p1 |');
    expect(result).not.toContain('ignored');
  });
});

describe('convertOrderedTable', () => {
  it('converts a table with thead and tbody', () => {
    const children = [
      el('thead', [el('tr', [el('th', [textNode('Name')]), el('th', [textNode('Value')])])]),
      el('tbody', [el('tr', [el('td', [textNode('A')]), el('td', [textNode('1')])])]),
    ];
    const result = convertOrderedTable(children);
    expect(result).toContain('| Name | Value |');
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| A | 1 |');
  });

  it('converts a table with direct tr elements (no thead/tbody)', () => {
    const children = [
      el('tr', [el('td', [textNode('A')]), el('td', [textNode('1')])]),
      el('tr', [el('td', [textNode('B')]), el('td', [textNode('2')])]),
    ];
    const result = convertOrderedTable(children);
    // First row becomes header when no thead
    expect(result).toContain('| --- | --- |');
    expect(result).toContain('| B | 2 |');
  });

  it('adds separator row if header lacks one', () => {
    const children = [
      el('thead', [el('tr', [el('th', [textNode('Col1')]), el('th', [textNode('Col2')])])]),
      el('tbody', [el('tr', [el('td', [textNode('data')])])]),
    ];
    const result = convertOrderedTable(children);
    expect(result).toContain('---');
  });
});

describe('convertOrderedRow', () => {
  it('converts a row with th cells', () => {
    const children = [el('th', [textNode('Header')]), el('td', [textNode('Data')])];
    const result = convertOrderedRow(children, true, {});
    expect(result).toBe('| Header | Data |');
  });

  it('converts a row with td cells', () => {
    const children = [el('td', [textNode('A')]), el('td', [textNode('B')])];
    const result = convertOrderedRow(children, false, {});
    expect(result).toBe('| A | B |');
  });

  it('skips non-th/td children', () => {
    const children = [el('td', [textNode('A')]), textNode('noise'), el('td', [textNode('B')])];
    const result = convertOrderedRow(children, false, {});
    expect(result).toBe('| A | B |');
  });
});

describe('resolveHref', () => {
  it('returns # for empty href', () => {
    expect(resolveHref('')).toBe('#');
    expect(resolveHref(null)).toBe('#');
  });

  it('passes through http URLs', () => {
    expect(resolveHref('https://example.com')).toBe('https://example.com');
    expect(resolveHref('http://example.com')).toBe('http://example.com');
  });

  it('passes through mailto URLs', () => {
    expect(resolveHref('mailto:test@example.com')).toBe('mailto:test@example.com');
  });

  it('passes through anchor links', () => {
    expect(resolveHref('#section')).toBe('#section');
  });

  it('resolves .html links via ROUTE_MAP', () => {
    expect(resolveHref('component_reference.html')).toBe('/user-manual/component-reference/');
  });

  it('resolves .html links with hash', () => {
    expect(resolveHref('functions.html#__time')).toBe('/user-manual/functions/#__time');
  });

  it('resolves unknown .html links by slugifying', () => {
    expect(resolveHref('unknown_page.html')).toBe('/unknown-page/');
  });

  it('resolves unknown .html links with hash', () => {
    expect(resolveHref('unknown_page.html#anchor')).toBe('/unknown-page/#anchor');
  });

  it('passes through non-html, non-http links', () => {
    expect(resolveHref('/some/path')).toBe('/some/path');
  });
});

describe('detectLanguage', () => {
  it('detects bash from $ prompt', () => {
    expect(detectLanguage('$ jmeter -n -t test.jmx')).toBe('bash');
  });

  it('detects bash from sudo', () => {
    expect(detectLanguage('sudo apt-get install jmeter')).toBe('bash');
  });

  it('detects bash from brew', () => {
    expect(detectLanguage('brew install jmeter')).toBe('bash');
  });

  it('detects java from class keyword', () => {
    expect(detectLanguage('public class MySampler')).toBe('java');
  });

  it('detects java from import keyword', () => {
    expect(detectLanguage('import org.apache.jmeter')).toBe('java');
  });

  it('detects java from package keyword', () => {
    expect(detectLanguage('package com.example;')).toBe('java');
  });

  it('detects xml from xml declaration', () => {
    expect(detectLanguage('<?xml version="1.0"?>')).toBe('xml');
  });

  it('detects xml from project tag', () => {
    expect(detectLanguage('<project>')).toBe('xml');
  });

  it('detects xml from dependency tag', () => {
    expect(detectLanguage('<dependency>')).toBe('xml');
  });

  it('detects json from object syntax', () => {
    expect(detectLanguage('{ "key": "value" }')).toBe('json');
  });

  it('detects properties from # comment', () => {
    expect(detectLanguage('# JMeter properties')).toBe('properties');
  });

  it('returns empty string for unrecognized code', () => {
    expect(detectLanguage('just some text')).toBe('');
  });

  it('returns empty string for empty input', () => {
    expect(detectLanguage('')).toBe('');
    expect(detectLanguage(null)).toBe('');
  });
});

describe('generateFrontmatter', () => {
  it('generates frontmatter with title and description', () => {
    const result = generateFrontmatter('My Title', 'My Description');
    expect(result).toContain('title: "My Title"');
    expect(result).toContain('description: "My Description"');
    expect(result).toMatch(/^---/m);
    expect(result).toMatch(/---\n\n$/);
  });

  it('truncates description to 157 chars', () => {
    const longDesc = 'A'.repeat(200);
    const result = generateFrontmatter('Title', longDesc);
    expect(result).toContain('A'.repeat(157));
    expect(result).not.toContain('A'.repeat(158));
  });

  it('uses title as description when description is empty', () => {
    const result = generateFrontmatter('My Title', '');
    expect(result).toContain('description: "My Title"');
  });

  it('escapes double quotes in title', () => {
    const result = generateFrontmatter('Say "hello"', '');
    expect(result).toContain("Say 'hello'");
  });

  it('escapes double quotes in description', () => {
    const result = generateFrontmatter('Title', 'Say "world"');
    expect(result).toContain("Say 'world'");
  });
});

describe('FILE_MAP', () => {
  it('maps XML source files to MDX destinations', () => {
    expect(FILE_MAP['usermanual/get-started.xml']).toBe('getting-started/get-started.mdx');
    expect(FILE_MAP['usermanual/component_reference.xml']).toBe('user-manual/component-reference.mdx');
    expect(FILE_MAP['changes.xml']).toBe('user-manual/changes.mdx');
  });

  it('has entries for all major sections', () => {
    expect(Object.keys(FILE_MAP).length).toBeGreaterThan(30);
  });
});

describe('ROUTE_MAP', () => {
  it('maps base names to routes', () => {
    expect(ROUTE_MAP['component_reference']).toBe('/user-manual/component-reference/');
    expect(ROUTE_MAP['get-started']).toBe('/getting-started/get-started/');
    expect(ROUTE_MAP['functions']).toBe('/user-manual/functions/');
  });
});

describe('integration: parse and walk', () => {
  it('parses and converts a complete simple XML document', () => {
    const xml = '<document><title>Test</title><body><p>Hello <b>world</b></p></body></document>';
    const parsed = parse(xml);
    const result = walkOrdered(parsed, { sectNum: '', sectionLevel: 2 });
    expect(result).toContain('Hello **world**');
  });

  it('parses a document with sections and lists', () => {
    const xml = `<document><title>Test</title><body>
      <section name="Overview"><p>Intro</p></section>
      <section name="Details">
        <ul><li>Item 1</li><li>Item 2</li></ul>
      </section>
    </body></document>`;
    const parsed = parse(xml);
    const result = walkOrdered(parsed, { sectNum: '', sectionLevel: 2 });
    expect(result).toContain('## Overview');
    expect(result).toContain('## Details');
    expect(result).toContain('- Item 1');
    expect(result).toContain('- Item 2');
  });

  it('handles entity resolution in parsed content', () => {
    // The parser with processEntities:false keeps &yen; as-is.
    // resolveEntities must be called on the raw XML before parsing.
    const rawXml = '<document><title>Test</title><body><p>Cost &yen;500</p></body></document>';
    const resolved = resolveEntities(rawXml, '');
    const parsed = parse(resolved);
    const result = walkOrdered(parsed, { sectNum: '', sectionLevel: 2 });
    expect(result).toContain('¥500');
  });
});

describe('convertFile', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('converts a valid XML file to MDX', () => {
    const xml = `<?xml version="1.0"?>
<!DOCTYPE document [
<!ENTITY sect-num '1.2'>
]>
<document>
<title>Test Page</title>
<body>
<p>This is a test paragraph with enough text for description.</p>
<section name="Overview">
<p>Section content</p>
</section>
</body>
</document>`;
    const srcPath = path.join(tmpDir, 'test.xml');
    const destPath = path.join(tmpDir, 'output', 'test.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    const result = convertFile(srcPath, destPath);
    expect(result).toBe(true);
    expect(fs.existsSync(destPath)).toBe(true);

    const mdx = fs.readFileSync(destPath, 'utf-8');
    expect(mdx).toContain('title: "Test Page"');
    expect(mdx).toContain('## Overview');
    expect(mdx).toContain('Section content');
  });

  it('returns false on parse error', () => {
    const srcPath = path.join(tmpDir, 'broken.xml');
    const destPath = path.join(tmpDir, 'out.mdx');
    fs.writeFileSync(srcPath, '<not-closed', 'utf-8');

    const result = convertFile(srcPath, destPath);
    expect(result).toBe(false);
  });

  it('extracts description from first paragraph', () => {
    const xml = `<document><title>Desc Test</title><body><p>This is a long enough first paragraph to be used as the description text for the page.</p></body></document>`;
    const srcPath = path.join(tmpDir, 'desc.xml');
    const destPath = path.join(tmpDir, 'desc.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    convertFile(srcPath, destPath);
    const mdx = fs.readFileSync(destPath, 'utf-8');
    expect(mdx).toContain('This is a long enough first paragraph');
  });

  it('falls back to title when no paragraph for description', () => {
    const xml = `<document><title>No Desc</title><body><section name="Only Section"></section></body></document>`;
    const srcPath = path.join(tmpDir, 'nodesc.xml');
    const destPath = path.join(tmpDir, 'nodesc.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    convertFile(srcPath, destPath);
    const mdx = fs.readFileSync(destPath, 'utf-8');
    expect(mdx).toContain('description: "No Desc"');
  });

  it('escapes ${} in inline code', () => {
    const xml = `<document><title>Escape Test</title><body><p>Use \`${'${variable}'}\` syntax here for the test.</p></body></document>`;
    const srcPath = path.join(tmpDir, 'escape.xml');
    const destPath = path.join(tmpDir, 'escape.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    convertFile(srcPath, destPath);
    const mdx = fs.readFileSync(destPath, 'utf-8');
    expect(mdx).toContain('\\${variable}');
  });

  it('removes CGI template directives', () => {
    const xml = `<document><title>CGI Test</title><body><p>Normal text here for description.</p>[if-any x]hidden content[end]</body></document>`;
    const srcPath = path.join(tmpDir, 'cgi.xml');
    const destPath = path.join(tmpDir, 'cgi.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    convertFile(srcPath, destPath);
    const mdx = fs.readFileSync(destPath, 'utf-8');
    expect(mdx).not.toContain('[if-any');
    expect(mdx).not.toContain('hidden content');
  });

  it('uses sect-num in section names', () => {
    const xml = `<!DOCTYPE document [<!ENTITY sect-num '3.1'>]>
<document><title>SectNum Test</title><body><section name="Section &sect-num;">Content here for the test description.</section></body></document>`;
    const srcPath = path.join(tmpDir, 'sect.xml');
    const destPath = path.join(tmpDir, 'sect.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    convertFile(srcPath, destPath);
    const mdx = fs.readFileSync(destPath, 'utf-8');
    expect(mdx).toContain('## Section 3.1');
  });

  it('creates nested directories for output', () => {
    const xml = `<document><title>Nested</title><body><p>Description text here for nested test.</p></body></document>`;
    const srcPath = path.join(tmpDir, 'nested.xml');
    const destPath = path.join(tmpDir, 'a', 'b', 'c', 'nested.mdx');
    fs.writeFileSync(srcPath, xml, 'utf-8');

    convertFile(srcPath, destPath);
    expect(fs.existsSync(destPath)).toBe(true);
  });
});

describe('copyDirRecursive', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'copy-test-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('copies files recursively', () => {
    const src = path.join(tmpDir, 'src');
    const dest = path.join(tmpDir, 'dest');
    fs.mkdirSync(path.join(src, 'sub'), { recursive: true });
    fs.writeFileSync(path.join(src, 'file1.txt'), 'content1');
    fs.writeFileSync(path.join(src, 'sub', 'file2.txt'), 'content2');

    copyDirRecursive(src, dest);

    expect(fs.existsSync(path.join(dest, 'file1.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dest, 'sub', 'file2.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(dest, 'file1.txt'), 'utf-8')).toBe('content1');
  });

  it('does nothing if source does not exist', () => {
    const dest = path.join(tmpDir, 'nonexistent');
    copyDirRecursive(path.join(tmpDir, 'nope'), dest);
    expect(fs.existsSync(dest)).toBe(false);
  });
});

// ── Content preservation tests ───────────────────────────────────────

describe('splitFrontmatter', () => {
  it('splits frontmatter from body', () => {
    const content = '---\ntitle: "Test"\ndescription: "Desc"\n---\n\nBody text';
    const { frontmatter, rest } = splitFrontmatter(content);
    expect(frontmatter).toBe('title: "Test"\ndescription: "Desc"');
    expect(rest).toBe('\nBody text');
  });

  it('returns empty frontmatter when none present', () => {
    const { frontmatter, rest } = splitFrontmatter('Just body');
    expect(frontmatter).toBe('');
    expect(rest).toBe('Just body');
  });

  it('handles CRLF line endings', () => {
    const content = '---\r\ntitle: "Test"\r\n---\r\nBody';
    const { frontmatter, rest } = splitFrontmatter(content);
    expect(frontmatter).toBe('title: "Test"');
    expect(rest).toBe('Body');
  });
});

describe('parseFrontmatterFields', () => {
  it('parses key-value pairs preserving order', () => {
    const entries = parseFrontmatterFields('title: "A"\ndescription: "B"\ndifficulty: "C"');
    expect(entries).toHaveLength(3);
    expect(entries[0]).toEqual({ key: 'title', value: 'A' });
    expect(entries[1]).toEqual({ key: 'description', value: 'B' });
    expect(entries[2]).toEqual({ key: 'difficulty', value: 'C' });
  });

  it('strips surrounding double quotes', () => {
    const entries = parseFrontmatterFields('title: "Hello World"');
    expect(entries[0].value).toBe('Hello World');
  });

  it('preserves unquoted values', () => {
    const entries = parseFrontmatterFields('difficulty: advanced');
    expect(entries[0].value).toBe('advanced');
  });

  it('returns empty array for empty input', () => {
    expect(parseFrontmatterFields('')).toEqual([]);
    expect(parseFrontmatterFields(null)).toEqual([]);
  });
});

describe('serializeFrontmatter', () => {
  it('serializes entries with double-quoted values', () => {
    const result = serializeFrontmatter([
      { key: 'title', value: 'Test' },
      { key: 'difficulty', value: 'advanced' },
    ]);
    expect(result).toContain('title: "Test"');
    expect(result).toContain('difficulty: "advanced"');
    expect(result).toMatch(/^---\n/);
    expect(result).toMatch(/\n---\n\n$/);
  });

  it('escapes double quotes in values', () => {
    const result = serializeFrontmatter([{ key: 'title', value: 'Say "hi"' }]);
    expect(result).toContain("Say 'hi'");
  });
});

describe('extractImportLines', () => {
  it('extracts import statements', () => {
    const content = "import RelatedContent from '../../components/RelatedContent.astro';\n\n## Heading";
    expect(extractImportLines(content)).toBe("import RelatedContent from '../../components/RelatedContent.astro';");
  });

  it('extracts multiple import statements', () => {
    const content = "import A from 'a';\nimport B from 'b';\n\n## Heading";
    const result = extractImportLines(content);
    expect(result).toContain("import A from 'a';");
    expect(result).toContain("import B from 'b';");
  });

  it('returns empty string when no imports', () => {
    expect(extractImportLines('## Heading\n\nBody')).toBe('');
  });
});

describe('extractLeadingAdmonitions', () => {
  it('extracts :::tip and :::caution after first heading', () => {
    const content = `## 16. Best Practices

:::tip[Use CLI mode]
Use CLI mode.
:::

:::caution[Avoid VRT]
Avoid View Results Tree.
:::

## 16.1 Next Section

Content here.`;
    const result = extractLeadingAdmonitions(content);
    expect(result).toContain(':::tip[Use CLI mode]');
    expect(result).toContain('Use CLI mode.');
    expect(result).toContain(':::caution[Avoid VRT]');
    expect(result).toContain('Avoid View Results Tree.');
  });

  it('extracts :::note with title (custom) but not without (converter-generated)', () => {
    const content = `## Heading

:::note[Version-specific behavior]
Custom note.
:::

:::note
Converter-generated note.
:::

Content here.`;
    const result = extractLeadingAdmonitions(content);
    expect(result).toContain(':::note[Version-specific behavior]');
    expect(result).toContain('Custom note.');
    expect(result).not.toContain('Converter-generated note.');
  });

  it('stops at first non-admonition content', () => {
    const content = `## Heading

:::tip[Tip]
Tip text.
:::

This is regular content.

:::caution[Late]
This should not be captured.
:::`;
    const result = extractLeadingAdmonitions(content);
    expect(result).toContain(':::tip[Tip]');
    expect(result).not.toContain(':::caution[Late]');
  });

  it('returns empty when no custom admonitions after heading', () => {
    const content = `## Heading

Regular content here.`;
    expect(extractLeadingAdmonitions(content)).toBe('');
  });

  it('returns empty when no heading found', () => {
    expect(extractLeadingAdmonitions('Just text, no heading')).toBe('');
  });
});

describe('extractCustomSections', () => {
  it('extracts from marker-based files', () => {
    const rest = `import RelatedContent from '../../components/RelatedContent.astro';

<!-- SYNCED-BODY:START -->
## Heading

<!-- CUSTOM-INTRO:START -->
:::tip[Custom]
Custom tip.
:::
<!-- CUSTOM-INTRO:END -->

Content.
<!-- SYNCED-BODY:END -->

<!-- CUSTOM-FOOTER:START -->
<RelatedContent>
<Fragment slot="next">Next</Fragment>
</RelatedContent>
<!-- CUSTOM-FOOTER:END -->`;
    const result = extractCustomSections(rest);
    expect(result.imports).toContain('import RelatedContent');
    expect(result.customIntro).toContain(':::tip[Custom]');
    expect(result.customFooter).toContain('<RelatedContent>');
  });

  it('extracts from unmarked files heuristically', () => {
    const rest = `import RelatedContent from '../../components/RelatedContent.astro';

## Heading

:::caution[Warning]
Custom warning.
:::

Content here.

<RelatedContent>
<Fragment slot="next">Next</Fragment>
</RelatedContent>`;
    const result = extractCustomSections(rest);
    expect(result.imports).toContain('import RelatedContent');
    expect(result.customIntro).toContain(':::caution[Warning]');
    expect(result.customFooter).toContain('<RelatedContent>');
  });

  it('returns empty sections for empty input', () => {
    const result = extractCustomSections('');
    expect(result.imports).toBe('');
    expect(result.customIntro).toBe('');
    expect(result.customFooter).toBe('');
  });
});

describe('computeAutoDescription', () => {
  it('extracts first paragraph as description', () => {
    const body = 'This is a long enough first paragraph to use as description.\n\n## Heading';
    expect(computeAutoDescription(body, 'Title')).toBe('This is a long enough first paragraph to use as description.');
  });

  it('falls back to title when no paragraph', () => {
    const body = '## Heading\n\n## Another Heading';
    expect(computeAutoDescription(body, 'My Title')).toBe('My Title');
  });

  it('truncates to 157 characters', () => {
    const longPara = 'A'.repeat(200);
    const result = computeAutoDescription(longPara, 'Title');
    expect(result.length).toBe(157);
  });
});

describe('mergeFrontmatter', () => {
  it('refreshes title from upstream', () => {
    const existing = [{ key: 'title', value: 'Old Title' }];
    const merged = mergeFrontmatter(existing, 'New Title', 'Auto Desc');
    expect(merged.find(e => e.key === 'title').value).toBe('New Title');
  });

  it('preserves custom description when it differs from auto', () => {
    const existing = [
      { key: 'title', value: 'Title' },
      { key: 'description', value: 'My custom SEO description' },
    ];
    const merged = mergeFrontmatter(existing, 'Title', 'Auto-generated desc');
    expect(merged.find(e => e.key === 'description').value).toBe('My custom SEO description');
  });

  it('uses auto description when existing equals title (fallback)', () => {
    const existing = [
      { key: 'title', value: 'Title' },
      { key: 'description', value: 'Title' },
    ];
    const merged = mergeFrontmatter(existing, 'Title', 'Auto desc');
    expect(merged.find(e => e.key === 'description').value).toBe('Auto desc');
  });

  it('uses auto description when existing equals new auto (unchanged)', () => {
    const existing = [
      { key: 'title', value: 'Title' },
      { key: 'description', value: 'Same auto desc' },
    ];
    const merged = mergeFrontmatter(existing, 'Title', 'Same auto desc');
    expect(merged.find(e => e.key === 'description').value).toBe('Same auto desc');
  });

  it('preserves custom frontmatter fields', () => {
    const existing = [
      { key: 'title', value: 'Title' },
      { key: 'difficulty', value: 'advanced' },
      { key: 'guideType', value: 'reference' },
      { key: 'estimatedReadTime', value: '10 min read' },
      { key: 'lastVerified', value: 'JMeter 5.6' },
    ];
    const merged = mergeFrontmatter(existing, 'New Title', 'Auto');
    expect(merged.find(e => e.key === 'difficulty').value).toBe('advanced');
    expect(merged.find(e => e.key === 'guideType').value).toBe('reference');
    expect(merged.find(e => e.key === 'estimatedReadTime').value).toBe('10 min read');
    expect(merged.find(e => e.key === 'lastVerified').value).toBe('JMeter 5.6');
  });

  it('adds title and description for brand-new files', () => {
    const merged = mergeFrontmatter([], 'New Title', 'Auto desc');
    expect(merged.find(e => e.key === 'title').value).toBe('New Title');
    expect(merged.find(e => e.key === 'description').value).toBe('Auto desc');
  });

  it('preserves field order from existing', () => {
    const existing = [
      { key: 'title', value: 'T' },
      { key: 'description', value: 'D' },
      { key: 'difficulty', value: 'advanced' },
    ];
    const merged = mergeFrontmatter(existing, 'T', 'D');
    expect(merged.map(e => e.key)).toEqual(['title', 'description', 'difficulty']);
  });
});

describe('PRESERVED_FM_FIELDS', () => {
  it('contains expected custom fields', () => {
    expect(PRESERVED_FM_FIELDS).toContain('difficulty');
    expect(PRESERVED_FM_FIELDS).toContain('guideType');
    expect(PRESERVED_FM_FIELDS).toContain('estimatedReadTime');
    expect(PRESERVED_FM_FIELDS).toContain('lastVerified');
  });
});

describe('convertFile: content preservation', () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'convert-preserve-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeSrc(name, xml) {
    const srcPath = path.join(tmpDir, name);
    fs.writeFileSync(srcPath, xml, 'utf-8');
    return srcPath;
  }

  const SIMPLE_XML = (title, body) => `<document><title>${title}</title><body>${body}</body></document>`;

  it('preserves custom frontmatter fields across re-convert', () => {
    const srcPath = writeSrc('test.xml', SIMPLE_XML('Test Page', '<p>Body text here for description.</p>'));
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);
    let mdx = fs.readFileSync(destPath, 'utf-8');

    const { frontmatter, rest } = splitFrontmatter(mdx);
    const entries = parseFrontmatterFields(frontmatter);
    entries.push(
      { key: 'difficulty', value: 'advanced' },
      { key: 'guideType', value: 'reference' },
      { key: 'estimatedReadTime', value: '10 min read' },
      { key: 'lastVerified', value: 'JMeter 5.6' },
    );
    fs.writeFileSync(destPath, serializeFrontmatter(entries) + rest, 'utf-8');

    convertFile(srcPath, destPath);
    mdx = fs.readFileSync(destPath, 'utf-8');

    expect(mdx).toContain('difficulty: "advanced"');
    expect(mdx).toContain('guideType: "reference"');
    expect(mdx).toContain('estimatedReadTime: "10 min read"');
    expect(mdx).toContain('lastVerified: "JMeter 5.6"');
  });

  it('preserves custom SEO description across re-convert', () => {
    const srcPath = writeSrc('test.xml', SIMPLE_XML('Test Page', '<p>Auto-generated body text here.</p>'));
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);

    let mdx = fs.readFileSync(destPath, 'utf-8');
    mdx = mdx.replace(
      /description: ".*"/,
      'description: "My custom SEO description that is unique"'
    );
    fs.writeFileSync(destPath, mdx, 'utf-8');

    convertFile(srcPath, destPath);
    mdx = fs.readFileSync(destPath, 'utf-8');

    expect(mdx).toContain('My custom SEO description that is unique');
  });

  it('preserves import lines across re-convert', () => {
    const srcPath = writeSrc('test.xml', SIMPLE_XML('Test', '<p>Body text for description here.</p>'));
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);

    let mdx = fs.readFileSync(destPath, 'utf-8');
    const { frontmatter, rest } = splitFrontmatter(mdx);
    mdx = serializeFrontmatter(parseFrontmatterFields(frontmatter))
      + "import RelatedContent from '../../components/RelatedContent.astro';\n\n"
      + rest;
    fs.writeFileSync(destPath, mdx, 'utf-8');

    convertFile(srcPath, destPath);
    mdx = fs.readFileSync(destPath, 'utf-8');

    expect(mdx).toContain("import RelatedContent from '../../components/RelatedContent.astro';");
  });

  it('preserves RelatedContent footer across re-convert', () => {
    const srcPath = writeSrc('test.xml', SIMPLE_XML('Test', '<p>Body text for description here.</p>'));
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);

    let mdx = fs.readFileSync(destPath, 'utf-8');
    mdx = mdx.trimEnd() + '\n\n<RelatedContent>\n<Fragment slot="next">Next step</Fragment>\n</RelatedContent>\n';
    fs.writeFileSync(destPath, mdx, 'utf-8');

    convertFile(srcPath, destPath);
    mdx = fs.readFileSync(destPath, 'utf-8');

    expect(mdx).toContain('<RelatedContent>');
    expect(mdx).toContain('<Fragment slot="next">Next step</Fragment>');
    expect(mdx).toContain('</RelatedContent>');
  });

  it('preserves custom admonitions across re-convert', () => {
    const srcXml = `<document><title>Test</title><body>
<section name="Overview"><p>Section content here for description.</p></section>
</body></document>`;
    const srcPath = writeSrc('test.xml', srcXml);
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);

    let mdx = fs.readFileSync(destPath, 'utf-8');
    mdx = mdx.replace(
      '## Overview',
      '## Overview\n\n:::tip[Custom Tip]\nThis is a custom tip.\n:::'
    );
    fs.writeFileSync(destPath, mdx, 'utf-8');

    convertFile(srcPath, destPath);
    mdx = fs.readFileSync(destPath, 'utf-8');

    expect(mdx).toContain(':::tip[Custom Tip]');
    expect(mdx).toContain('This is a custom tip.');
  });

  it('always ends with a trailing newline', () => {
    const srcPath = writeSrc('test.xml', SIMPLE_XML('Test', '<p>Body text for description.</p>'));
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);
    const mdx = fs.readFileSync(destPath, 'utf-8');

    expect(mdx.endsWith('\n')).toBe(true);
  });

  it('is idempotent: second convert produces identical output', () => {
    const srcPath = writeSrc('test.xml', SIMPLE_XML('Test', '<p>Body text for description.</p>'));
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);
    const firstRun = fs.readFileSync(destPath, 'utf-8');

    convertFile(srcPath, destPath);
    const secondRun = fs.readFileSync(destPath, 'utf-8');

    expect(secondRun).toBe(firstRun);
  });

  it('is idempotent with custom content', () => {
    const srcXml = `<document><title>Test</title><body>
<section name="Overview"><p>Section content here for description.</p></section>
</body></document>`;
    const srcPath = writeSrc('test.xml', srcXml);
    const destPath = path.join(tmpDir, 'out.mdx');

    convertFile(srcPath, destPath);

    let mdx = fs.readFileSync(destPath, 'utf-8');
    const { frontmatter, rest } = splitFrontmatter(mdx);
    const entries = parseFrontmatterFields(frontmatter);
    entries.push({ key: 'difficulty', value: 'advanced' });
    mdx = serializeFrontmatter(entries)
      + "import RelatedContent from '../../components/RelatedContent.astro';\n\n"
      + rest.replace('## Overview', '## Overview\n\n:::tip[Custom]\nTip text.\n:::')
      + '\n\n<RelatedContent>\n<Fragment slot="next">Next</Fragment>\n</RelatedContent>';
    fs.writeFileSync(destPath, mdx, 'utf-8');

    convertFile(srcPath, destPath);
    const secondRun = fs.readFileSync(destPath, 'utf-8');

    convertFile(srcPath, destPath);
    const thirdRun = fs.readFileSync(destPath, 'utf-8');

    expect(thirdRun).toBe(secondRun);
  });
});
