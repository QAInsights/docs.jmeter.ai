import { EventEmitter } from 'node:events';
import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';
import starlightDocSearch from '@astrojs/starlight-docsearch';
import cloudflare from '@astrojs/cloudflare';

EventEmitter.defaultMaxListeners = 30;
import { loadEnv } from 'vite';
import { sidebar } from './src/sidebar.mjs';
import remarkImageOptimize from './src/remark-image-optimize.mjs';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

// Algolia DocSearch credentials may be absent in CI (e.g. the upstream sync
// workflow's build-verification step). Fall back to placeholders so the config
// schema validates and the site builds; the real values are injected into
// the build environment (GitHub Actions / local .env) at build time.
const algoliaAppId = env.PUBLIC_ALGOLIA_APP_ID || 'placeholder-app-id';
const algoliaApiKey = env.PUBLIC_ALGOLIA_API_KEY || 'placeholder-api-key';
const algoliaIndexName = env.PUBLIC_ALGOLIA_INDEX_NAME || 'placeholder-index';

export default defineConfig({
  site: 'https://docs.jmeter.ai',
  // Cloudflare adapter enables on-demand Worker routes (e.g. /api/chat)
  // while keeping every docs page prerendered as static assets.
  // imageService 'compile': all images are processed at build time (sharp);
  // no runtime image binding is needed.
  adapter: cloudflare({
    platformProxy: { enabled: true },
    imageService: 'compile',
  }),
  markdown: {
    processor: unified({
      remarkPlugins: [remarkImageOptimize],
    }),
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
          appId: algoliaAppId,
          apiKey: algoliaApiKey,
          indexName: algoliaIndexName,
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
      customCss: ['./src/styles/custom.css', './src/styles/landing.css', './src/styles/ask-ai.css', './src/styles/tools.css'],
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
