import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';
import starlightDocSearch from '@astrojs/starlight-docsearch';
import vercel from '@astrojs/vercel';
import { loadEnv } from 'vite';
import { sidebar } from './src/sidebar.mjs';
import remarkImageOptimize from './src/remark-image-optimize.mjs';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

// On Linux (Vercel build), force-include the rolldown native binding in the
// serverless bundle — @vercel/nft can't trace dynamically-loaded .node files.
// On Windows (local dev), the Linux binding doesn't exist so we skip it.
const isLinux = process.platform === 'linux';
const vercelAdapter = vercel({
  maxDuration: 30,
  ...(isLinux ? {
    includeFiles: [
      // Hoisted layout (shamefully-hoist=true)
      './node_modules/@rolldown/binding-linux-x64-gnu/rolldown-binding.linux-x64-gnu.node',
      './node_modules/@rolldown/binding-linux-x64-gnu/package.json',
      // pnpm store layout (fallback if not hoisted)
      './node_modules/.pnpm/@rolldown+binding-linux-x64-gnu@1.1.4/node_modules/@rolldown/binding-linux-x64-gnu/rolldown-binding.linux-x64-gnu.node',
      './node_modules/.pnpm/@rolldown+binding-linux-x64-gnu@1.1.4/node_modules/@rolldown/binding-linux-x64-gnu/package.json',
    ],
  } : {}),
});

export default defineConfig({
  site: 'https://docs.jmeter.ai',
  // Vercel adapter enables on-demand serverless routes (e.g. /api/chat)
  // while keeping every docs page prerendered as static HTML.
  adapter: vercelAdapter,
  markdown: {
    remarkPlugins: [remarkImageOptimize],
  },
  integrations: [
    starlight({
      title: 'JMeter Docs',
      description: 'Community documentation for Apache JMeter',
      favicon: '/favicon.svg',
      logo: {
        light: './src/assets/logo-light.svg',
        dark: './src/assets/logo-dark.svg',
        replacesTitle: false,
      },
      plugins: [
        starlightDocSearch({
          appId: env.PUBLIC_ALGOLIA_APP_ID,
          apiKey: env.PUBLIC_ALGOLIA_API_KEY,
          indexName: env.PUBLIC_ALGOLIA_INDEX_NAME,
        }),
        lucode({
          footerText: '',
          navLinks: [
            { label: 'QAInsights', link: 'https://qainsights.com', attrs: { target: '_blank', rel: 'noopener noreferrer', title: 'QAInsights - Performance Testing Blog' } },
            { label: 'JMeter AI', link: 'https://jmeter.ai', attrs: { target: '_blank', rel: 'noopener noreferrer', title: 'JMeter AI - AI Platform' } },
            { label: 'I Am Speed', link: 'https://iamspeed.dev', attrs: { target: '_blank', rel: 'noopener noreferrer', title: 'I Am Speed - Developer Tools' } },
            { label: 'Dosa', link: 'https://ai.dosa.dev', attrs: { target: '_blank', rel: 'noopener noreferrer', title: 'Dosa AI - AI Platform' } },
          ],
        }),
      ],
      customCss: ['./src/styles/custom.css', './src/styles/landing.css', './src/styles/ask-ai.css'],
      components: {
        Footer: './src/components/FooterDisclaimer.astro',
        Head: './src/components/SeoHead.astro',
        PageTitle: './src/components/PageTitle.astro',
        ThemeSelect: './src/components/ThemeToggle.astro',
        PageSidebar: './src/components/PageSidebar.astro',
        Header: './src/components/CustomHeader.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/QAInsights/docs.jmeter.ai' },
      ],
      editLink: {
        baseUrl: 'https://github.com/QAInsights/docs.jmeter.ai/edit/main/',
      },
      lastUpdated: true,
      sidebar,
    }),
  ],
});
