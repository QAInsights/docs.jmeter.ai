import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  parseComponents,
  parseFunctions,
  extractSyncedBody,
  buildDescription,
  buildComponentPage,
  buildFunctionPage,
  buildComponentsHub,
  buildFunctionsHub,
  buildLegacyComponentAnchorMap,
  buildLegacyFunctionAnchorMap,
  rewriteLegacyReferenceLinks,
  MIN_COMPONENT_COUNT,
  MIN_FUNCTION_COUNT,
} from '../../scripts/generate-reference-pages.mjs';
import { referenceSlug, componentPath, functionPath } from '../../src/lib/reference-slug.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const COMPONENT_SOURCE = path.join(ROOT, 'src/content/docs/user-manual/component-reference.mdx');
const FUNCTION_SOURCE = path.join(ROOT, 'src/content/docs/user-manual/functions.mdx');

const componentRaw = fs.readFileSync(COMPONENT_SOURCE, 'utf8');
const functionRaw = fs.readFileSync(FUNCTION_SOURCE, 'utf8');

describe('referenceSlug', () => {
  it('lowercases and hyphenates plain names', () => {
    expect(referenceSlug('FTP Request Defaults')).toBe('ftp-request-defaults');
  });

  it('strips leading/trailing underscores and a trailing ()', () => {
    expect(referenceSlug('__time()')).toBe('time');
    expect(referenceSlug('__UUID')).toBe('uuid');
  });

  it('collapses punctuation runs into single hyphens', () => {
    expect(referenceSlug('Post-Processors')).toBe('post-processors');
    expect(referenceSlug('JSR223 / Beanshell')).toBe('jsr223-beanshell');
  });

  it('builds component and function paths with a trailing slash', () => {
    expect(componentPath('HTTP Request')).toBe('/components/http-request/');
    expect(functionPath('__P')).toBe('/functions/p/');
  });
});

describe('extractSyncedBody', () => {
  it('slices content between the SYNCED-BODY markers', () => {
    const body = 'intro\n{/* SYNCED-BODY:START */}\nkept\n{/* SYNCED-BODY:END */}\nfooter';
    expect(extractSyncedBody(body).trim()).toBe('kept');
  });

  it('returns the whole body when markers are missing', () => {
    expect(extractSyncedBody('no markers here')).toBe('no markers here');
  });
});

describe('parseComponents (real component-reference.mdx)', () => {
  const categories = parseComponents(componentRaw);
  const all = categories.flatMap((c) => c.components);

  it('finds at least the expected minimum number of components', () => {
    expect(all.length).toBeGreaterThanOrEqual(MIN_COMPONENT_COUNT);
  });

  it('groups components under their real category headings', () => {
    const names = categories.map((c) => c.category);
    expect(names).toContain('Samplers');
    expect(names).toContain('Logic Controllers');
    expect(names).toContain('Timers');
    expect(names).toContain('Assertions');
  });

  it('does not create an "Introduction" category (no dotted heading)', () => {
    const names = categories.map((c) => c.category);
    expect(names.some((n) => /introduction/i.test(n))).toBe(false);
  });

  it('extracts a known component with its property table intact', () => {
    const ftp = all.find((c) => c.name === 'FTP Request');
    expect(ftp).toBeDefined();
    expect(ftp.body).toContain('Server Name or IP');
    expect(ftp.body).toContain('| Name | Required | Description |');
  });

  it('splits a "formerly" suffix out of the component name', () => {
    const flowControl = all.find((c) => c.name.startsWith('Flow Control Action'));
    expect(flowControl).toBeDefined();
    expect(flowControl.formerly).toBe('Test Action');
  });

  it('produces no duplicate slugs across all parsed components', () => {
    const slugs = all.map((c) => referenceSlug(c.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('parseFunctions (real functions.mdx)', () => {
  const functions = parseFunctions(functionRaw);

  it('finds at least the expected minimum number of functions', () => {
    expect(functions.length).toBeGreaterThanOrEqual(MIN_FUNCTION_COUNT);
  });

  it('only includes headings that look like __functionName', () => {
    expect(functions.every((f) => /^__[A-Za-z0-9]+$/.test(f.name))).toBe(true);
  });

  it('extracts a known function with its property table intact', () => {
    const counter = functions.find((f) => f.name === '__counter');
    expect(counter).toBeDefined();
    expect(counter.body).toContain('First argument');
  });

  it('does not attach the trailing numbered document sections to the last function', () => {
    const last = functions.find((f) => f.name === '__StringToFile');
    expect(last).toBeDefined();
    expect(last.body).not.toContain('Pre-defined Variables');
    expect(last.body).not.toContain('Pre-defined Properties');
  });

  it('produces no duplicate slugs across all parsed functions', () => {
    const slugs = functions.map((f) => referenceSlug(f.name));
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe('buildDescription', () => {
  it('stays within the 80-160 char SEO gate for a short name', () => {
    const desc = buildDescription('__P', 'function', 'function');
    expect(desc.length).toBeGreaterThanOrEqual(80);
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it('stays within the 80-160 char SEO gate for a long component name', () => {
    const desc = buildDescription('LDAP Extended Request', 'component', 'Miscellaneous Features');
    expect(desc.length).toBeGreaterThanOrEqual(80);
    expect(desc.length).toBeLessThanOrEqual(160);
  });

  it('stays within range for every real component and function name', () => {
    const categories = parseComponents(componentRaw);
    for (const { category, components } of categories) {
      for (const c of components) {
        const desc = buildDescription(c.name, 'component', category);
        expect(desc.length, `${c.name}: "${desc}"`).toBeGreaterThanOrEqual(80);
        expect(desc.length, `${c.name}: "${desc}"`).toBeLessThanOrEqual(160);
      }
    }
    for (const fn of parseFunctions(functionRaw)) {
      const desc = buildDescription(fn.name, 'function', 'function');
      expect(desc.length, `${fn.name}: "${desc}"`).toBeGreaterThanOrEqual(80);
      expect(desc.length, `${fn.name}: "${desc}"`).toBeLessThanOrEqual(160);
    }
  });
});

describe('buildComponentPage / buildFunctionPage (idempotency)', () => {
  const categories = parseComponents(componentRaw);
  const functions = parseFunctions(functionRaw);
  const ftp = categories.flatMap((c) => c.components).find((c) => c.name === 'FTP Request');
  const counter = functions.find((f) => f.name === '__counter');

  it('produces byte-identical component page output for the same input', () => {
    const first = buildComponentPage(ftp, 'Samplers');
    const second = buildComponentPage(ftp, 'Samplers');
    expect(first).toBe(second);
  });

  it('produces byte-identical function page output for the same input', () => {
    const first = buildFunctionPage(counter);
    const second = buildFunctionPage(counter);
    expect(first).toBe(second);
  });

  it('produces byte-identical hub pages for the same input', () => {
    expect(buildComponentsHub(categories)).toBe(buildComponentsHub(categories));
    expect(buildFunctionsHub(functions)).toBe(buildFunctionsHub(functions));
  });

  it('renders both hubs with server-rendered filterable directories', () => {
    expect(buildComponentsHub(categories)).toContain("import ReferenceDirectory from '../../../components/ReferenceDirectory.astro';");
    expect(buildFunctionsHub(functions)).toContain("import ReferenceDirectory from '../../../components/ReferenceDirectory.astro';");
    expect(buildComponentsHub(categories)).toContain('<ReferenceDirectory kind="component" />');
    expect(buildFunctionsHub(functions)).toContain('<ReferenceDirectory kind="function" />');
  });

  it('sets canonicalTopic for every generated reference page', () => {
    for (const { category, components } of categories) {
      for (const component of components) {
        expect(buildComponentPage(component, category), component.name).toMatch(/^canonicalTopic: [a-z0-9-]+$/m);
      }
    }
    for (const fn of functions) {
      expect(buildFunctionPage(fn), fn.name).toContain('canonicalTopic: functions-and-variables');
    }
  });

  it('embeds valid YAML frontmatter with a title matching the component name', () => {
    const page = buildComponentPage(ftp, 'Samplers');
    expect(page.startsWith('---\ntitle: "FTP Request"')).toBe(true);
  });

  it('links back to the monolith component anchor using the rendered heading-id scheme (hyphenated)', () => {
    // Astro's default heading-id algorithm (github-slugger) lowercases and
    // hyphenates component headings ("## FTP Request" -> id="ftp-request"),
    // so the "view in context" link must use the same scheme to scroll
    // correctly, not the legacy NAME_WITH_UNDERSCORES anchor <complink> used.
    const page = buildComponentPage(ftp, 'Samplers');
    expect(page).toContain('/user-manual/component-reference/#ftp-request)');
  });

  it('links back to the monolith function anchor using the raw name (github-slugger keeps underscores)', () => {
    // "## __counter" renders id="__counter" verbatim - unlike components,
    // function headings are not hyphenated because they contain no spaces.
    const page = buildFunctionPage(counter);
    expect(page).toContain('/user-manual/functions/#__counter)');
  });
});

describe('legacy anchor rewriting (pre-existing dead links from the old <complink>/<funclink> scheme)', () => {
  const categories = parseComponents(componentRaw);
  const functions = parseFunctions(functionRaw);
  const componentAnchorMap = buildLegacyComponentAnchorMap(categories);
  const functionAnchorMap = buildLegacyFunctionAnchorMap(functions);

  it('maps a legacy NAME_WITH_UNDERSCORES component anchor to the new split-page path', () => {
    expect(componentAnchorMap.get('FTP_Request_Defaults')).toBe('/components/ftp-request-defaults/');
    expect(componentAnchorMap.get('User_Parameters')).toBe('/components/user-parameters/');
    expect(componentAnchorMap.get('Test_Action')).toBe('/components/flow-control-action/');
    expect(componentAnchorMap.get('HTTP_Proxy_Server')).toBe('/components/http-s-test-script-recorder/');
    expect(rewriteLegacyReferenceLinks('[Recorder](/user-manual/component-reference/#HTTP%28S%29_Test_Script_Recorder)', componentAnchorMap, functionAnchorMap)).toBe('[Recorder](/components/http-s-test-script-recorder/)');
  });

  it('maps a legacy __function anchor to the new split-page path', () => {
    expect(functionAnchorMap.get('__CSVRead')).toBe('/functions/csvread/');
    expect(functionAnchorMap.get('__time')).toBe('/functions/time/');
    expect(functionAnchorMap.get('__CSVRead__')).toBe('/functions/csvread/');
  });

  it('rewrites historical component and function cross-references without touching surrounding text', () => {
    const source = 'See [FTP Request Defaults](/user-manual/component-reference/#FTP_Request_Defaults) and [__CSVRead](/user-manual/functions/#__CSVRead).';
    const rewritten = rewriteLegacyReferenceLinks(source, componentAnchorMap, functionAnchorMap);
    expect(rewritten).toBe('See [FTP Request Defaults](/components/ftp-request-defaults/) and [__CSVRead](/functions/csvread/).');
    expect(rewriteLegacyReferenceLinks(rewritten, componentAnchorMap, functionAnchorMap)).toBe(rewritten);
  });

  it('keeps committed monolith cross-references aligned with the split pages', () => {
    expect(componentRaw).toContain('[FTP Request Defaults](/components/ftp-request-defaults/)');
    expect(componentRaw).not.toContain('/user-manual/component-reference/#FTP_Request_Defaults');
    expect(functionRaw).not.toMatch(/\/user-manual\/(?:component-reference|functions)\/#(?:FTP_Request_Defaults|__CSVRead)/);
    const testPlan = fs.readFileSync(path.join(ROOT, 'src/content/docs/user-manual/test-plan.mdx'), 'utf8');
    expect(testPlan).toContain('[Once Only Controller](/components/once-only-controller/)');
    const proxy = fs.readFileSync(path.join(ROOT, 'src/content/docs/user-manual/jmeter-proxy-step-by-step.mdx'), 'utf8');
    expect(proxy).toContain('/components/http-s-test-script-recorder/');
  });

  it('keeps all non-generated docs free of known legacy reference links', () => {
    const docsDir = path.join(ROOT, 'src/content/docs');
    for (const entry of fs.readdirSync(docsDir, { recursive: true })) {
      if (!entry.endsWith('.mdx') || ['components', 'functions'].includes(entry.split(path.sep)[0])) continue;
      const source = fs.readFileSync(path.join(docsDir, entry), 'utf8');
      expect(rewriteLegacyReferenceLinks(source, componentAnchorMap, functionAnchorMap), entry).toBe(source);
    }
  });

  it('leaves non-component anchors (category/section headings) untouched', () => {
    const body = 'See the [Assertions](/user-manual/component-reference/#Assertions) section and [Introduction](/user-manual/component-reference/#introduction).';
    const rewritten = rewriteLegacyReferenceLinks(body, componentAnchorMap, functionAnchorMap);
    expect(rewritten).toBe(body);
  });

  it('leaves links that are not in the legacy scheme untouched', () => {
    const body = 'Already correct: [FTP Request Defaults](/components/ftp-request-defaults/).';
    const rewritten = rewriteLegacyReferenceLinks(body, componentAnchorMap, functionAnchorMap);
    expect(rewritten).toBe(body);
  });

  it('produces generated pages with zero remaining legacy-style component anchors', () => {
    // Every legacy NAME_WITH_UNDERSCORES component anchor should have been
    // rewritten to a real split-page path by the time pages are built.
    for (const { category, components } of categories) {
      for (const c of components) {
        const rewritten = rewriteLegacyReferenceLinks(c.body, componentAnchorMap, functionAnchorMap);
        const page = buildComponentPage({ ...c, body: rewritten }, category);
        const staleLinks = page.match(/\/user-manual\/component-reference\/#[A-Za-z]*_[A-Za-z_]*/g) || [];
        expect(staleLinks, `${c.name}: ${staleLinks.join(', ')}`).toEqual([]);
      }
    }
  });
});
