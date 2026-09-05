/// <reference types="astro/client" />
/// <reference path="../node_modules/@astrojs/starlight/virtual-internal.d.ts" />

type KVNamespace = import('@cloudflare/workers-types/index.ts').KVNamespace;
type RateLimit = import('@cloudflare/workers-types/index.ts').RateLimit;
type Fetcher = import('@cloudflare/workers-types/index.ts').Fetcher;

declare module 'cloudflare:workers' {
  export const env: Env;
}
