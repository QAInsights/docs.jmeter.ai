import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import lucode from 'lucode-starlight';
import { sidebar } from './src/sidebar.mjs';

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
        lucode({ footerText: '' }),
      ],
      customCss: ['./src/styles/custom.css', './src/styles/landing.css'],
      components: {
        Footer: './src/components/FooterDisclaimer.astro',
        Head: './src/components/SeoHead.astro',
        PageTitle: './src/components/PageTitle.astro',
        ThemeSelect: './src/components/ThemeToggle.astro',
        PageSidebar: './src/components/PageSidebar.astro',
      },
      social: [
        { icon: 'github', label: 'GitHub', href: 'https://github.com/QAInsights/docs.jmeter.ai' },
      ],
      editLink: {
        baseUrl: 'https://github.com/QAInsights/docs.jmeter.ai/edit/main/',
      },
      sidebar,
    }),
  ],
});
