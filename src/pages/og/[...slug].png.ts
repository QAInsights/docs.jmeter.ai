import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';

// Load Geist 700 bold font buffer locally from node_modules/@fontsource/geist-sans
const fontPath = path.resolve('node_modules/@fontsource/geist-sans/files/geist-sans-latin-700-normal.woff');
const fontData = fs.readFileSync(fontPath);

export const getStaticPaths: GetStaticPaths = async () => {
  const docs = await getCollection('docs');
  const paths = docs.map((entry) => {
    const rawSlug = entry.id.replace(/\.(md|mdx)$/, '');
    const firstSegment = rawSlug.split('/')[0] || '';
    const categoryMap: Record<string, string> = {
      tools: 'INTERACTIVE TOOL',
      topics: 'TOPIC GUIDE',
      'user-manual': 'USER MANUAL',
      reference: 'REFERENCE',
      extending: 'EXTENDING',
      'getting-started': 'GETTING STARTED',
      legal: 'LEGAL',
    };
    const category = categoryMap[firstSegment] || firstSegment.toUpperCase() || 'DOCUMENTATION';

    return {
      params: { slug: rawSlug },
      props: {
        title: entry.data.title || 'JMeter Documentation',
        description: entry.data.description || 'Community-maintained Apache JMeter documentation with guides and tools.',
        category,
      },
    };
  });

  // Root home page card
  paths.push({
    params: { slug: 'home' },
    props: {
      title: 'JMeter Documentation',
      description: 'Modern Apache JMeter docs: user manual, interactive tools, and performance testing guides.',
      category: 'DOCS.JMETER.AI',
    },
  });

  return paths;
};

export const GET: APIRoute = async ({ props }) => {
  const { title = 'JMeter Documentation', description = '', category = 'DOCUMENTATION' } = props || {};

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
      fonts: [
        {
          name: 'Geist',
          data: fontData,
          weight: 700,
          style: 'normal',
        },
      ],
    }
  );

  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
  const pngBuffer = resvg.render().asPng();

  return new Response(pngBuffer, {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
