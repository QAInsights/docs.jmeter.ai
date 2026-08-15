/**
 * Generate public/og/<slug>.png Open Graph cards for every docs page.
 *
 * This replaced the prerendered /og/[...slug].png route during the
 * Cloudflare migration: the Cloudflare adapter prerenders inside workerd
 * (miniflare), where the native @resvg/resvg-js binding can't load. Running
 * as a plain Node build script keeps satori + resvg working unchanged, and
 * the PNGs deploy as plain static assets at identical URLs.
 *
 * Wired into `npm run build` so cards stay in sync automatically.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { stripFrontmatter, parseFrontmatter } from './generate-llms-full.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DOCS_DIR = path.join(ROOT, 'src/content/docs');
const OUTPUT_DIR = path.join(ROOT, 'public', 'og');
const FONT_PATH = path.join(
  ROOT,
  'node_modules/@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff',
);

const CATEGORY_MAP = {
  tools: 'INTERACTIVE TOOL',
  topics: 'TOPIC GUIDE',
  'user-manual': 'USER MANUAL',
  reference: 'REFERENCE',
  extending: 'EXTENDING',
  'getting-started': 'GETTING STARTED',
  legal: 'LEGAL',
};

/** Recursively collect docs slugs: a/b.mdx → a/b, a/b/index.mdx → a/b. */
function collectSlugs(dir, base = '') {
  const slugs = [];
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    const rel = base ? `${base}/${name}` : name;
    if (fs.statSync(full).isDirectory()) {
      slugs.push(...collectSlugs(full, rel));
    } else if (name.endsWith('.mdx')) {
      slugs.push(rel.replace(/\.mdx$/, '').replace(/\/index$/, ''));
    }
  }
  return slugs;
}

function cardFor(slug) {
  const file = path.join(DOCS_DIR, `${slug}.mdx`);
  const indexFile = path.join(DOCS_DIR, slug, 'index.mdx');
  const resolved = fs.existsSync(file) ? file : fs.existsSync(indexFile) ? indexFile : null;
  const fm = resolved ? parseFrontmatter(stripFrontmatter(fs.readFileSync(resolved, 'utf8')).frontmatter) : {};
  const firstSegment = slug.split('/')[0] || '';
  return {
    slug,
    title: fm.title || 'JMeter Documentation',
    description: fm.description || '',
    category: CATEGORY_MAP[firstSegment] || firstSegment.toUpperCase() || 'DOCUMENTATION',
  };
}

/** Satori markup for one card (unchanged from the old /og route). */
async function renderCard({ title, description, category }, fontData) {
  const svg = await satori(
    {
      type: 'div',
      props: {
        style: {
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '60px',
          backgroundColor: '#1c1917',
          backgroundImage: 'radial-gradient(circle at 85% 15%, #431407 0%, #1c1917 65%)',
          color: '#fafaf9',
          fontFamily: 'Geist',
        },
        children: [
          // Header Badge
          {
            type: 'div',
            props: {
              style: { display: 'flex', alignItems: 'center', gap: '14px' },
              children: [
                {
                  type: 'div',
                  props: {
                    style: {
                      background: 'linear-gradient(135deg, #ea580c, #f97316)',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 'bold',
                      padding: '6px 16px',
                      borderRadius: '9999px',
                      letterSpacing: '0.08em',
                    },
                    children: category,
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: { color: '#a8a29e', fontSize: '18px', fontWeight: 700 },
                    children: 'docs.jmeter.ai',
                  },
                },
              ],
            },
          },
          // Main Body Title & Description
          {
            type: 'div',
            props: {
              style: { display: 'flex', flexDirection: 'column', gap: '16px' },
              children: [
                {
                  type: 'h1',
                  props: {
                    style: {
                      fontSize: title.length > 35 ? '50px' : '62px',
                      fontWeight: 800,
                      lineHeight: 1.15,
                      margin: 0,
                      color: '#fafaf9',
                    },
                    children: title,
                  },
                },
                {
                  type: 'p',
                  props: {
                    style: {
                      fontSize: '22px',
                      color: '#d6d3d1',
                      margin: 0,
                      lineHeight: 1.4,
                      display: '-webkit-box',
                      overflow: 'hidden',
                    },
                    children: description.length > 150 ? `${description.slice(0, 147)}...` : description,
                  },
                },
              ],
            },
          },
          // Footer Branding
          {
            type: 'div',
            props: {
              style: {
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                borderTop: '1px solid #44403c',
                paddingTop: '20px',
              },
              children: [
                {
                  type: 'span',
                  props: {
                    style: { color: '#f97316', fontSize: '18px', fontWeight: 700 },
                    children: 'QAInsights • Apache JMeter Community',
                  },
                },
                {
                  type: 'span',
                  props: {
                    style: { color: '#78716c', fontSize: '16px', fontWeight: 700 },
                    children: 'Interactive Calculators & Guides',
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      width: 1200,
      height: 630,
      fonts: [{ name: 'Geist', data: fontData, weight: 700, style: 'normal' }],
    },
  );
  return new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } }).render().asPng();
}

async function main() {
  const fontData = fs.readFileSync(FONT_PATH);
  const slugs = collectSlugs(DOCS_DIR);
  // Root home page card
  slugs.push('home');
  const cards = slugs.map((slug) =>
    slug === 'home'
      ? {
          slug,
          title: 'JMeter Documentation',
          description:
            'Modern Apache JMeter docs: user manual, interactive tools, and performance testing guides.',
          category: 'DOCS.JMETER.AI',
        }
      : cardFor(slug),
  );
  for (const card of cards) {
    const out = path.join(OUTPUT_DIR, `${card.slug}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await renderCard(card, fontData));
  }
  console.log(`[og-images] wrote ${cards.length} cards to ${path.relative(ROOT, OUTPUT_DIR)}`);
}

// Run only when invoked directly, not when imported by tests.
const invoked = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) main();
