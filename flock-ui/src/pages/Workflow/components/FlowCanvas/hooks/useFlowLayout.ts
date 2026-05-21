import { useCallback } from 'react';
import type { Node, Edge } from 'reactflow';

export function useFlowLayout(
  nodes: Node[],
  edges: Edge[],
  setNodes: (nodes: Node[] | ((nds: Node[]) => Node[])) => void,
  setEdges: (edges: Edge[] | ((eds: Edge[]) => Edge[])) => void
) {
  const layoutAllNodes = useCallback((customNodes?: Node[], customEdges?: Edge[]) => {
    const targetNodes = customNodes || nodes;
    const targetEdges = customEdges || edges;
    if (targetNodes.length === 0) return;

    const adj: Record<string, string[]> = {};
    const inDegree: Record<string, number> = {};

    targetNodes.forEach(n => {
      adj[n.id] = [];
      inDegree[n.id] = 0;
    });

    targetEdges.forEach(e => {
      if (adj[e.source] && adj[e.target] !== undefined) {
        adj[e.source].push(e.target);
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      }
    });

    const rank: Record<string, number> = {};
    targetNodes.forEach(n => {
      rank[n.id] = 0;
    });

    const queue: string[] = [];
    targetNodes.forEach(n => {
      if (inDegree[n.id] === 0) {
        queue.push(n.id);
      }
    });

    if (queue.length === 0 && targetNodes.length > 0) {
      queue.push(targetNodes[0].id);
    }

    const visited = new Set<string>();
    while (queue.length > 0) {
      const curr = queue.shift()!;
      if (visited.has(curr)) continue;
      visited.add(curr);

      const currRank = rank[curr];
      adj[curr].forEach(next => {
        rank[next] = Math.max(rank[next], currRank + 1);
        queue.push(next);
      });
    }

    const rankGroups: Record<number, string[]> = {};
    targetNodes.forEach(n => {
      const r = rank[n.id] || 0;
      if (!rankGroups[r]) {
        rankGroups[r] = [];
      }
      rankGroups[r].push(n.id);
    });

    const HORIZONTAL_GAP = 280;
    const VERTICAL_GAP = 140;

    const nextNodes = targetNodes.map(n => {
      const r = rank[n.id] || 0;
      const group = rankGroups[r];
      const index = group.indexOf(n.id);
      const count = group.length;

      const x = r * HORIZONTAL_GAP + 50;
      const y = (index - (count - 1) / 2) * VERTICAL_GAP + 200;

      return {
        ...n,
        position: { x, y }
      };
    });

    setNodes(nextNodes);
    if (customEdges) {
      setEdges(customEdges);
    }
  }, [nodes, edges, setNodes, setEdges]);

  return { layoutAllNodes };
}
