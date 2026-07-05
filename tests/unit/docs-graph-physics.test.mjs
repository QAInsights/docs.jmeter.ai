import { describe, it, expect } from 'vitest';
import {
  layoutGroupNodes,
  layoutPageNodes,
  buildAdjacency,
  physicsStep,
} from '../../src/lib/docs-graph-physics.mjs';

describe('layoutGroupNodes', () => {
  const groups = [
    { id: 'g1', label: 'Getting Started' },
    { id: 'g2', label: 'User Manual' },
    { id: 'g3', label: 'Reference' },
  ];

  it('places groups in a radial layout around center', () => {
    const positions = layoutGroupNodes(groups, 450, 260, 155);
    expect(Object.keys(positions)).toHaveLength(3);
    for (const pos of Object.values(positions)) {
      expect(pos.x).toBeGreaterThan(0);
      expect(pos.y).toBeGreaterThan(0);
      expect(pos.angle).toBeDefined();
    }
  });

  it('returns unique angles for each group', () => {
    const positions = layoutGroupNodes(groups, 450, 260, 155);
    const angles = Object.values(positions).map((p) => p.angle);
    expect(new Set(angles).size).toBe(3);
  });

  it('handles empty groups array', () => {
    const positions = layoutGroupNodes([], 450, 260, 155);
    expect(Object.keys(positions)).toHaveLength(0);
  });
});

describe('layoutPageNodes', () => {
  const groupPositions = {
    g1: { x: 450, y: 100, angle: -Math.PI / 2 },
  };

  it('places pages relative to their parent group', () => {
    const pages = [
      { id: 'p1', groupId: 'g1' },
      { id: 'p2', groupId: 'g1' },
    ];
    const positions = layoutPageNodes(pages, groupPositions, 72);
    expect(Object.keys(positions)).toHaveLength(2);
    for (const pos of Object.values(positions)) {
      expect(pos.x).toBeDefined();
      expect(pos.y).toBeDefined();
    }
  });

  it('places ungrouped pages at origin', () => {
    const pages = [{ id: 'p1', groupId: null }];
    const positions = layoutPageNodes(pages, groupPositions);
    expect(positions.p1.x).toBe(0);
    expect(positions.p1.y).toBe(0);
  });

  it('skips pages whose group is missing from groupPositions', () => {
    const pages = [{ id: 'p1', groupId: 'nonexistent' }];
    const positions = layoutPageNodes(pages, groupPositions);
    expect(positions.p1).toBeUndefined();
  });
});

describe('buildAdjacency', () => {
  it('builds bidirectional adjacency from links', () => {
    const adj = buildAdjacency(['a', 'b', 'c'], [
      { source: 'a', target: 'b' },
      { source: 'b', target: 'c' },
    ]);
    expect(adj.a.has('b')).toBe(true);
    expect(adj.b.has('a')).toBe(true);
    expect(adj.b.has('c')).toBe(true);
    expect(adj.c.has('b')).toBe(true);
    expect(adj.a.has('c')).toBe(false);
  });

  it('initializes empty sets for isolated nodes', () => {
    const adj = buildAdjacency(['a', 'b'], []);
    expect(adj.a.size).toBe(0);
    expect(adj.b.size).toBe(0);
  });
});

describe('physicsStep', () => {
  it('moves unpinned nodes toward rest position with repulsion', () => {
    const nodesMap = {
      a: { x: 100, y: 100, vx: 0, vy: 0, pinned: false },
      b: { x: 110, y: 100, vx: 0, vy: 0, pinned: false },
    };
    const restPositions = {
      a: { x: 100, y: 100 },
      b: { x: 200, y: 100 },
    };
    physicsStep(nodesMap, restPositions, {
      springStrength: 0.08,
      repulsion: 800,
      damping: 0.85,
      minDistance: 30,
      bounds: { minX: 0, maxX: 900, minY: 0, maxY: 520 },
    });
    // Node b should have moved toward its rest position (x=200)
    expect(nodesMap.b.x).toBeGreaterThan(110);
  });

  it('does not move pinned nodes', () => {
    const nodesMap = {
      a: { x: 100, y: 100, vx: 0, vy: 0, pinned: true },
    };
    const restPositions = { a: { x: 200, y: 200 } };
    physicsStep(nodesMap, restPositions, {
      bounds: { minX: 0, maxX: 900, minY: 0, maxY: 520 },
    });
    expect(nodesMap.a.x).toBe(100);
    expect(nodesMap.a.y).toBe(100);
  });

  it('clamps positions within bounds', () => {
    const nodesMap = {
      a: { x: 890, y: 510, vx: 100, vy: 100, pinned: false },
    };
    const restPositions = { a: { x: 900, y: 520 } };
    physicsStep(nodesMap, restPositions, {
      springStrength: 0,
      repulsion: 0,
      damping: 1,
      bounds: { minX: 50, maxX: 850, minY: 50, maxY: 470 },
    });
    expect(nodesMap.a.x).toBeLessThanOrEqual(850);
    expect(nodesMap.a.y).toBeLessThanOrEqual(470);
  });
});
