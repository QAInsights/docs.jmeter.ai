/**
 * Build graph data from the canonical sidebar.
 *
 * Returns { nodes, links, pageCount } where:
 *   nodes: group nodes + page nodes
 *   links: group-to-page edges + curated cross-links
 */

import { sidebar } from '../sidebar.mjs';

/**
 * Curated cross-links connecting related pages across groups.
 * Each entry: [sourcePageLink, targetPageLink]
 */
export const crossLinks = [
  ['/topics/functions-and-variables', '/user-manual/functions'],
  ['/topics/api-load-testing', '/user-manual/build-web-test-plan'],
  ['/topics/distributed-testing', '/user-manual/remote-test'],
  ['/topics/ci-cd-load-testing', '/user-manual/best-practices'],
  ['/topics/http-recorder', '/user-manual/build-web-test-plan'],
  ['/user-manual/listeners', '/user-manual/generating-dashboard'],
  ['/user-manual/listeners', '/user-manual/realtime-results'],
  ['/user-manual/component-reference', '/extending/extending-jmeter'],
  ['/user-manual/best-practices', '/user-manual/build-test-plan'],
  ['/reference/download-jmeter', '/getting-started/get-started'],
];

/**
 * Derive a stable node ID from a page link path.
 * Strips the leading slash and replaces remaining slashes with dots.
 */
export function pageIdFromLink(link) {
  return link.replace(/^\//, '').replace(/\//g, '.');
}

/**
 * Derive a stable node ID for a group from its label.
 * Lowercases and replaces spaces/non-word chars with hyphens.
 */
export function groupIdFromLabel(label) {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-+$/, '');
}

/**
 * Recursively flatten page items under a group.
 */
function flattenPages(items, groupLabel) {
  const out = [];
  for (const item of items) {
    if (item.link && item.label) {
      out.push({ label: item.label, link: item.link, groupLabel });
    } else if (item.items) {
      out.push(...flattenPages(item.items, groupLabel));
    }
  }
  return out;
}

/**
 * Build the full graph from the sidebar.
 * @param {Array} [sidebarData] - sidebar array, defaults to canonical sidebar
 * @returns {{ nodes: Array, links: Array, pageCount: number }}
 */
export function buildGraphData(sidebarData = sidebar) {
  const groupNodes = [];
  const pageNodes = [];
  const groupLinks = [];
  const pageMap = new Map();

  for (const entry of sidebarData) {
    if (entry.items) {
      const groupId = groupIdFromLabel(entry.label);
      const pages = flattenPages(entry.items, entry.label);

      groupNodes.push({
        id: groupId,
        type: 'group',
        label: entry.label,
        pageCount: pages.length,
      });

      for (const page of pages) {
        const pageId = pageIdFromLink(page.link);
        pageNodes.push({
          id: pageId,
          type: 'page',
          label: page.label,
          link: page.link,
          groupId,
          groupLabel: page.groupLabel,
        });
        pageMap.set(page.link, pageId);
        groupLinks.push({ source: groupId, target: pageId, type: 'group' });
      }
    } else if (entry.link && entry.label) {
      const pageId = pageIdFromLink(entry.link);
      pageNodes.push({
        id: pageId,
        type: 'page',
        label: entry.label,
        link: entry.link,
        groupId: null,
        groupLabel: 'Overview',
      });
      pageMap.set(entry.link, pageId);
    }
  }

  const nodes = [...groupNodes, ...pageNodes];

  const links = [...groupLinks];
  for (const [src, tgt] of crossLinks) {
    const srcId = pageMap.get(src);
    const tgtId = pageMap.get(tgt);
    if (srcId && tgtId) {
      links.push({ source: srcId, target: tgtId, type: 'cross' });
    }
  }

  return { nodes, links, pageCount: pageNodes.length };
}
