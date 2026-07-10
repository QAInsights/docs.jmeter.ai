<p align="center">
  <img src="src/assets/logo-light.svg" alt="JMeter Docs" width="120" height="120" />
</p>

<h1 align="center">JMeter Docs</h1>

<p align="center">
  Community-maintained documentation for <a href="https://jmeter.apache.org/">Apache JMeter</a> built with Astro + Starlight
</p>

<p align="center">
  <a href="https://docs.jmeter.ai"><strong>docs.jmeter.ai</strong></a>
</p>

<p align="center">
  <a href="https://github.com/QAInsights/docs.jmeter.ai/actions"><img alt="CI" src="https://img.shields.io/github/actions/workflow/status/QAInsights/docs.jmeter.ai/sync-upstream.yml?branch=main&label=sync" /></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-Apache%202.0-blue.svg" /></a>
  <a href="https://astro.build"><img alt="Astro" src="https://img.shields.io/badge/built%20with-Astro%207-orange.svg" /></a>
</p>

---

> **Disclaimer:** This is an independent community resource and is **not affiliated with** the Apache Software Foundation.

## Features

- **Full-text search** powered by Pagefind
- **Dark mode** with system preference detection
- **Organized sidebar**: User Manual, Reference, Extending, Legal
- **LLM-friendly** text exports (`llms.txt` / `llms-full.txt`)
- **Custom landing page** with terminal hero, metrics strip, and bento grid
- **SEO optimized** with structured data (FAQ, HowTo schemas)

## Getting Started

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

### Preview Production Build

```bash
npm run preview
```

## Scripts

| Script                       | Description                                      |
|------------------------------|--------------------------------------------------|
| `npm run dev`                | Start dev server                                 |
| `npm run build`              | Generate `llms-full.txt` then build the site     |
| `npm run preview`            | Preview the production build locally             |
| `npm test`                   | Run unit tests                                   |
| `npm run test:watch`         | Run tests in watch mode                          |
| `npm run test:coverage`      | Run tests with coverage report                   |
| `npm run convert`            | Convert upstream JMeter docs to Starlight format |
| `npm run generate-llms-full` | Generate LLM-friendly text export                |

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes using [Conventional Commits](https://www.conventionalcommits.org/)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Important: MDX files are generated

The `src/content/docs/**/*.mdx` files are **generated artifacts** produced by
`tools/convert.mjs` from the upstream [Apache JMeter](https://github.com/apache/jmeter)
`xdocs/` XML. A nightly workflow (`.github/workflows/sync-upstream.yml`) regenerates
them and opens a sync PR.

**Direct edits to MDX files will be overwritten** by the next sync run. To make a
lasting change to documentation content:

- **Prefer fixing the converter** in `tools/convert.mjs` so the change applies to all
  generated pages and survives syncs.
- **Or upstream the change** to `apache/jmeter` `xdocs/` so it flows down naturally.
- **Or open an issue** describing the desired change so maintainers can decide the
  best path.

Changes to non-generated files (components, styles, tools, tests, config) are not
affected by the sync and can be edited directly.

## License

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

Apache JMeter is a trademark of The Apache Software Foundation. This project is not endorsed by or affiliated with the ASF.
