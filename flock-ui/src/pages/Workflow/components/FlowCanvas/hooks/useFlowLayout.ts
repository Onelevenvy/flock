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

    const HORIZONTAL_GAP = 350;
    const VERTICAL_GAP = 180;

    const nodePositions: Record<string, { x: number; y: number }> = {};
    const maxRank = Math.max(...Object.values(rank), 0);

    // Position column-by-column, sorting nodes inside each column based on incoming connection handles
    for (let r = 0; r <= maxRank; r++) {
      const group = rankGroups[r] || [];
      if (group.length === 0) continue;

      const weights = group.map((nodeId) => {
        const node = targetNodes.find((n) => n.id === nodeId)!;
        const incoming = targetEdges.filter((e) => e.target === nodeId);
        
        let totalWeight = 0;
        let count = 0;

        incoming.forEach((edge) => {
          const parentId = edge.source;
          const parentPos = nodePositions[parentId];
          if (parentPos) {
            const parentNode = targetNodes.find((n) => n.id === parentId);
            let handleIdx = 0;
            if (parentNode) {
              const pType = parentNode.type;
              const pData = parentNode.data || {};
              if (pType === 'human') {
                const actions = pData.user_actions || [];
                const keys = [...actions.map((a: any) => a.key), 'TIMEOUT'];
                const sHandle = (edge.sourceHandle || '').toLowerCase();
                handleIdx = keys.findIndex(k => String(k).toLowerCase() === sHandle);
                if (handleIdx < 0) handleIdx = 0;
              } else if (pType === 'classifier') {
                const cats = pData.categories || [];
                const sHandle = (edge.sourceHandle || '').toLowerCase();
                handleIdx = cats.findIndex((c: any) => String(c.category_id).toLowerCase() === sHandle);
                if (handleIdx < 0) handleIdx = 0;
              } else if (pType === 'ifelse') {
                const cases = pData.cases || [];
                const sHandle = (edge.sourceHandle || '').toLowerCase();
                handleIdx = cases.findIndex((c: any) => String(c.case_id).toLowerCase() === sHandle);
                if (handleIdx < 0) handleIdx = 0;
              }
            }
            // Give vertical weight based on parent Y position and its handle order index
            totalWeight += parentPos.y + handleIdx * 1000;
            count++;
          }
        });

        // Fallback to original array order if no parent is positioned yet
        const weight = count > 0 ? totalWeight / count : targetNodes.indexOf(node) * 10000;
        return { nodeId, weight };
      });

      // Sort nodes in this rank group by weight
      weights.sort((a, b) => a.weight - b.weight);
      const sortedGroup = weights.map((w) => w.nodeId);
      rankGroups[r] = sortedGroup;

      // Position all nodes in this rank group
      const count = sortedGroup.length;
      sortedGroup.forEach((nodeId, index) => {
        const x = r * HORIZONTAL_GAP + 50;
        const y = (index - (count - 1) / 2) * VERTICAL_GAP + 200;
        nodePositions[nodeId] = { x, y };
      });
    }

    const nextNodes = targetNodes.map(n => {
      const pos = nodePositions[n.id] || { x: 50, y: 200 };
      return {
        ...n,
        position: pos
      };
    });

    setNodes(nextNodes);
    if (customEdges) {
      setEdges(customEdges);
    }
  }, [nodes, edges, setNodes, setEdges]);

  return { layoutAllNodes };
}
