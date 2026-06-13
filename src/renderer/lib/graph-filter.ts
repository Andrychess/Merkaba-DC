import type { GraphData } from '@shared/types';

export function getGraphSpaces(
  nodes: GraphData['nodes'],
  labelFor?: (spaceId: string) => string
): string[] {
  const ids = [...new Set(nodes.map((n) => n.group))];
  if (labelFor) {
    return ids.sort((a, b) => labelFor(a).localeCompare(labelFor(b), 'ru'));
  }
  return ids.sort((a, b) => a.localeCompare(b, 'ru'));
}

export function filterGraphBySpaces(graph: GraphData, spaces: Set<string>): GraphData {
  if (spaces.size === 0) {
    return { nodes: [], edges: [] };
  }

  const nodeIds = new Set(
    graph.nodes.filter((n) => spaces.has(n.group)).map((n) => n.id)
  );
  const nodes = graph.nodes.filter((n) => nodeIds.has(n.id));
  const edges = graph.edges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes, edges };
}
