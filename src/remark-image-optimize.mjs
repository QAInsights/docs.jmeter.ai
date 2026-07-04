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
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');

const dimensionCache = new Map();

/**
 * Read image dimensions via sharp. Returns { width, height } or null.
 * Results are cached so each file is only read once per build.
 */
async function readDimensions(filePath) {
  if (dimensionCache.has(filePath)) return dimensionCache.get(filePath);
  try {
    const meta = await sharp(filePath).metadata();
    const dims = meta.width && meta.height
      ? { width: meta.width, height: meta.height }
      : null;
    dimensionCache.set(filePath, dims);
    return dims;
  } catch {
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
