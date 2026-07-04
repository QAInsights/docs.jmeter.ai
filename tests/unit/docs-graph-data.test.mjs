/**
 * Tests for docs-graph-data utility.
 *
 * Verifies that the graph data built from the sidebar is complete and valid:
 *   - every sidebar leaf appears as a page node
 *   - every group node corresponds to a sidebar section with items
 *   - all link source/target IDs reference existing nodes
 *   - cross-links point to valid page node IDs
 *   - no duplicate node IDs
 */

import { describe, it, expect } from 'vitest';
import { buildGraphData, crossLinks, pageIdFromLink } from '../../src/lib/docs-graph-data.mjs';
import { flattenSidebar, sidebar } from '../../src/sidebar.mjs';

describe('buildGraphData', () => {
  const { nodes, links, pageCount } = buildGraphData();

  const groupNodes = nodes.filter((n) => n.type === 'group');
  const pageNodes = nodes.filter((n) => n.type === 'page');

  it('produces a page node for every sidebar leaf', () => {
    const flatLeaves = flattenSidebar();
    expect(pageCount).toBe(flatLeaves.length);
    expect(pageNodes.length).toBe(flatLeaves.length);

    for (const leaf of flatLeaves) {
      const match = pageNodes.find((n) => n.link === leaf.link);
      expect(match, `Missing page node for: ${leaf.link}`).toBeDefined();
    }
  });

  it('produces a group node for every sidebar section with items', () => {
    const sidebarGroups = sidebar.filter((e) => e.items);
    expect(groupNodes.length).toBe(sidebarGroups.length);

    for (const group of sidebarGroups) {
      const match = groupNodes.find((n) => n.label === group.label);
      expect(match, `Missing group node for: ${group.label}`).toBeDefined();
    }
  });

  it('assigns a correct pageCount to each group node', () => {
    for (const gn of groupNodes) {
      const actual = pageNodes.filter((p) => p.groupLabel === gn.label).length;
      expect(gn.pageCount).toBe(actual);
    }
  });

  it('has no duplicate node IDs', () => {
    const ids = nodes.map((n) => n.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it('all link source and target IDs reference existing nodes', () => {
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const link of links) {
      expect(nodeIds.has(link.source), `Dangling source: ${link.source}`).toBe(true);
      expect(nodeIds.has(link.target), `Dangling target: ${link.target}`).toBe(true);
    }
  });

  it('every cross-link references valid page links', () => {
    const pageLinks = new Set(pageNodes.map((n) => n.link));
    for (const [src, tgt] of crossLinks) {
      expect(pageLinks.has(src), `Cross-link source not in sidebar: ${src}`).toBe(true);
      expect(pageLinks.has(tgt), `Cross-link target not in sidebar: ${tgt}`).toBe(true);
    }
  });

  it('group links outnumber cross-links', () => {
    const groupLinkCount = links.filter((l) => l.type === 'group').length;
    const crossLinkCount = links.filter((l) => l.type === 'cross').length;
    expect(groupLinkCount).toBeGreaterThan(crossLinkCount);
  });

  it('every page node with a groupId references an existing group node', () => {
    const groupIds = new Set(groupNodes.map((n) => n.id));
    for (const page of pageNodes) {
      if (page.groupId === null) continue;
      expect(groupIds.has(page.groupId), `Orphan page: ${page.label} (group: ${page.groupId})`).toBe(true);
    }
  });
});

describe('pageIdFromLink', () => {
  it('strips leading slash and replaces slashes with dots', () => {
    expect(pageIdFromLink('/user-manual/build-test-plan')).toBe('user-manual.build-test-plan');
    expect(pageIdFromLink('/getting-started/get-started')).toBe('getting-started.get-started');
  });

  it('handles root-level links', () => {
    expect(pageIdFromLink('/')).toBe('');
  });
});
