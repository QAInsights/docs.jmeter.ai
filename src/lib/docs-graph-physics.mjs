/**
 * Pure physics and layout functions for the docs graph visualization.
 * Extracted from DocsGraph.astro for testability.
 */

/**
 * Compute initial radial layout positions for group nodes.
 * Returns an object mapping group ID to { x, y, angle }.
 */
export function layoutGroupNodes(groups, cx, cy, radius) {
  const positions = {};
  groups.forEach((g, i) => {
    const angle = (i / groups.length) * Math.PI * 2 - Math.PI / 2;
    positions[g.id] = {
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      angle,
    };
  });
  return positions;
}

/**
 * Compute initial positions for page nodes relative to their parent group.
 * Returns an object mapping page ID to { x, y }.
 */
export function layoutPageNodes(pages, groupPositions, dist = 72, maxSpread = Math.PI / 2.5) {
  const positions = {};
  const pagesByGroup = {};

  for (const p of pages) {
    if (!p.groupId) {
      positions[p.id] = { x: 0, y: 0 };
      continue;
    }
    if (!pagesByGroup[p.groupId]) pagesByGroup[p.groupId] = [];
    pagesByGroup[p.groupId].push(p);
  }

  for (const [groupId, groupPages] of Object.entries(pagesByGroup)) {
    const gp = groupPositions[groupId];
    if (!gp) continue;
    const count = groupPages.length;
    const spread = count > 1 ? Math.min(maxSpread, count * 0.1) : 0;

    groupPages.forEach((p, j) => {
      const t = count === 1 ? 0.5 : j / (count - 1);
      const angle = gp.angle + (t - 0.5) * spread;
      positions[p.id] = {
        x: gp.x + Math.cos(angle) * dist,
        y: gp.y + Math.sin(angle) * dist,
      };
    });
  }

  return positions;
}

/**
 * Build an adjacency map from a links array.
 * Returns { nodeId: Set<nodeId> }.
 */
export function buildAdjacency(nodeIds, links) {
  const adj = {};
  for (const id of nodeIds) {
    adj[id] = new Set();
  }
  for (const link of links) {
    if (adj[link.source]) adj[link.source].add(link.target);
    if (adj[link.target]) adj[link.target].add(link.source);
  }
  return adj;
}

/**
 * Compute one physics step: spring force toward rest + repulsion from others.
 * Mutates nodes in-place and returns them for chaining.
 *
 * @param {Object} nodesMap - { id: { x, y, vx, vy, pinned } }
 * @param {Object} restPositions - { id: { x, y } }
 * @param {Object} config - { springStrength, repulsion, damping, minDistance, bounds }
 */
export function physicsStep(nodesMap, restPositions, config) {
  const {
    springStrength = 0.08,
    repulsion = 800,
    damping = 0.85,
    minDistance = 30,
    bounds = { minX: 50, maxX: 850, minY: 50, maxY: 470 },
  } = config;

  const ids = Object.keys(nodesMap);

  for (const id of ids) {
    const node = nodesMap[id];
    if (node.pinned) continue;

    let fx = 0;
    let fy = 0;

    const rest = restPositions[id];
    if (rest) {
      fx += (rest.x - node.x) * springStrength;
      fy += (rest.y - node.y) * springStrength;
    }

    for (const otherId of ids) {
      if (otherId === id) continue;
      const other = nodesMap[otherId];
      const dx = node.x - other.x;
      const dy = node.y - other.y;
      let dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDistance) dist = minDistance;
      const force = repulsion / (dist * dist);
      fx += (dx / dist) * force;
      fy += (dy / dist) * force;
    }

    node.vx = (node.vx + fx) * damping;
    node.vy = (node.vy + fy) * damping;
    node.x += node.vx;
    node.y += node.vy;

    node.x = Math.max(bounds.minX, Math.min(bounds.maxX, node.x));
    node.y = Math.max(bounds.minY, Math.min(bounds.maxY, node.y));
  }

  return nodesMap;
}
