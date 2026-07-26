/**
 * Remark plugin: add loading="lazy" and width/height to markdown images.
 *
 * For images served from `public/images/`, reads actual pixel dimensions
 * via sharp (already a project dependency) and injects width/height
 * attributes to reduce Cumulative Layout Shift (CLS).
 *
 * All images also get loading="lazy" so non-critical images don't block
 * the initial page render.
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { visit } from 'unist-util-visit';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const dimensionCache = new Map();

let sharpModule = null;
let sharpWarned = false;

/**
 * Lazily resolve the sharp ESM default export. Subsequent calls reuse the
 * cached module reference so each image does not pay the import cost and we
 * can short-circuit when sharp is unavailable without re-trying.
 */
async function getSharp() {
  if (sharpModule !== null) return sharpModule;
  try {
    const mod = await import('sharp');
    sharpModule = mod.default;
    return sharpModule;
  } catch (err) {
    if (!sharpWarned) {
      sharpWarned = true;
      console.warn(
        `[remark-image-optimize] sharp unavailable; image width/height injection will be skipped for all images on this build (${err?.message ?? String(err)})`
      );
    }
    return null;
  }
}

/**
 * Read image dimensions via sharp. Returns { width, height } or null.
 * Results are cached so each file is only read once per build.
 *
 * `sharp` is loaded lazily so that importing this remark plugin does not
 * evaluate native bindings at Astro config load time. Some Node versions
 * (e.g. unreleased majors) may not have a matching sharp prebuild; without
 * this guard, `astro dev` and `astro build` would crash before any markdown
 * is processed. The graceful fallback logs a single warning and skips
 * width/height injection — images still get `loading="lazy"`.
 */
async function readDimensions(filePath) {
  if (dimensionCache.has(filePath)) return dimensionCache.get(filePath);
  const sharp = await getSharp();
  if (!sharp) {
    dimensionCache.set(filePath, null);
    return null;
  }
  try {
    const meta = await sharp(filePath).metadata();
    const dims = meta.width && meta.height
      ? { width: meta.width, height: meta.height }
      : null;
    dimensionCache.set(filePath, dims);
    return dims;
  } catch (err) {
    dimensionCache.set(filePath, null);
    return null;
  }
}

export default function remarkImageOptimize() {
  return async (tree) => {
    const imageNodes = [];

    visit(tree, 'image', (node) => {
      imageNodes.push(node);
    });

    await Promise.all(
      imageNodes.map(async (node) => {
        const data = node.data || (node.data = {});
        const hProps = data.hProperties || (data.hProperties = {});

        hProps.loading = 'lazy';

        if (node.url && node.url.startsWith('/')) {
          const localPath = path.join(PUBLIC_DIR, node.url);

          const dims = await readDimensions(localPath);
          if (dims) {
            hProps.width = dims.width;
            hProps.height = dims.height;
          }
        }
      })
    );
  };
}
