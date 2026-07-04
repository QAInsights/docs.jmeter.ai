import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';
import starlightDocSearch from '@astrojs/starlight-docsearch';
import { loadEnv } from 'vite';
import { sidebar } from './src/sidebar.mjs';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

export default defineConfig({
  site: 'https://docs.jmeter.ai',
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
            { label: 'I Am Speed', link: 'https://iamspeed.dev', attrs: { target: '_blank', rel: 'noopener noreferrer', title: 'I Am Speed - Developer Tools' } },
            { label: 'Dosa AI', link: 'https://ai.dosa.dev', attrs: { target: '_blank', rel: 'noopener noreferrer', title: 'Dosa AI - AI Platform' } },
          ],
        }),
      ],
      customCss: ['./src/styles/custom.css', './src/styles/landing.css'],
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
