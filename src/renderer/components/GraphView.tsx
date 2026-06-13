import { useEffect, useMemo, useRef, useState } from 'react';
import * as d3 from 'd3';
import { useAppStore } from '../stores/appStore';
import { readThemeColor } from '../lib/applyTheme';
import { filterGraphBySpaces, getGraphSpaces } from '../lib/graph-filter';
import { formatSpaceDisplay } from '@shared/spaces';

export function GraphView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const graph = useAppStore((s) => s.graph);
  const theme = useAppStore((s) => s.config.theme);
  const spaceSymbols = useAppStore((s) => s.spaceSymbols);
  const loadGraph = useAppStore((s) => s.loadGraph);
  const openFile = useAppStore((s) => s.openFile);
  const setSidebarMode = useAppStore((s) => s.setSidebarMode);

  const spaceIds = useMemo(
    () => getGraphSpaces(graph.nodes, (id) => formatSpaceDisplay(id, spaceSymbols)),
    [graph.nodes, spaceSymbols]
  );
  const [selectedSpaces, setSelectedSpaces] = useState<Set<string> | null>(null);

  useEffect(() => {
    loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    setSelectedSpaces((prev) => {
      if (!prev) return new Set(spaceIds);
      const next = new Set([...prev].filter((id) => spaceIds.includes(id)));
      for (const id of spaceIds) {
        if (!prev.has(id)) next.add(id);
      }
      return next;
    });
  }, [spaceIds]);

  const activeSpaces = selectedSpaces ?? new Set(spaceIds);
  const filteredGraph = useMemo(
    () => filterGraphBySpaces(graph, activeSpaces),
    [graph, activeSpaces]
  );

  const toggleSpace = (spaceId: string) => {
    setSelectedSpaces((prev) => {
      const base = prev ?? new Set(spaceIds);
      const next = new Set(base);
      if (next.has(spaceId)) {
        next.delete(spaceId);
      } else {
        next.add(spaceId);
      }
      return next;
    });
  };

  const selectAllSpaces = () => setSelectedSpaces(new Set(spaceIds));
  const clearSpaces = () => setSelectedSpaces(new Set());

  useEffect(() => {
    if (!svgRef.current || !containerRef.current || filteredGraph.nodes.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    const g = svg.append('g');

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const simulation = d3
      .forceSimulation(
        filteredGraph.nodes as (d3.SimulationNodeDatum & {
          id: string;
          label: string;
          group: string;
          links: number;
        })[]
      )
      .force(
        'link',
        d3
          .forceLink(filteredGraph.edges)
          .id((d) => (d as { id: string }).id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force(
        'collision',
        d3.forceCollide().radius((d) => Math.min(10 + (d as { links: number }).links * 2, 30))
      );

    const linkColor = readThemeColor('--merkaba-graph-link');
    const nodeStroke = readThemeColor('--merkaba-graph-node-stroke');
    const labelColor = readThemeColor('--merkaba-muted');

    const link = g
      .append('g')
      .selectAll('line')
      .data(filteredGraph.edges)
      .join('line')
      .attr('stroke', linkColor)
      .attr('stroke-width', 1.5)
      .attr('stroke-opacity', 0.6);

    const node = g
      .append('g')
      .selectAll('g')
      .data(filteredGraph.nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3
          .drag<SVGGElement, (typeof filteredGraph.nodes)[0]>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          })
      )
      .on('click', (_, d) => {
        setSidebarMode('files');
        openFile(d.id);
      });

    node
      .append('circle')
      .attr('r', (d) => Math.min(8 + d.links * 2, 25))
      .attr('fill', (d) => color(d.group) as string)
      .attr('stroke', nodeStroke)
      .attr('stroke-width', 1);

    node
      .append('text')
      .text((d) => d.label)
      .attr('x', 0)
      .attr('y', (d) => Math.min(8 + d.links * 2, 25) + 14)
      .attr('text-anchor', 'middle')
      .attr('fill', labelColor)
      .attr('font-size', '11px');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as d3.SimulationNodeDatum).x ?? 0)
        .attr('y1', (d) => (d.source as d3.SimulationNodeDatum).y ?? 0)
        .attr('x2', (d) => (d.target as d3.SimulationNodeDatum).x ?? 0)
        .attr('y2', (d) => (d.target as d3.SimulationNodeDatum).y ?? 0);

      node.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`);
    });

    return () => {
      simulation.stop();
    };
  }, [filteredGraph, openFile, setSidebarMode, theme]);

  const allSelected = activeSpaces.size === spaceIds.length;
  const noneSelected = activeSpaces.size === 0;

  return (
    <div ref={containerRef} className="flex-1 relative bg-merkaba-bg min-h-0">
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-start gap-3 pointer-events-none">
        <button
          type="button"
          onClick={() => setSidebarMode('files')}
          className="btn-secondary pointer-events-auto shrink-0"
        >
          ← Назад
        </button>

        <div className="flex flex-wrap items-center gap-2 pointer-events-auto min-w-0 flex-1">
          <span className="text-xs text-merkaba-muted shrink-0">Пространства:</span>
          <button
            type="button"
            onClick={selectAllSpaces}
            className={`px-2.5 py-1 rounded-lg text-xs border transition-colors ${
              allSelected
                ? 'bg-merkaba-accent/15 border-merkaba-accent text-merkaba-text'
                : 'bg-merkaba-elevated border-merkaba-border text-merkaba-muted hover:text-merkaba-text'
            }`}
          >
            Все
          </button>
          {spaceIds.map((spaceId) => {
            const active = activeSpaces.has(spaceId);
            return (
              <button
                key={spaceId}
                type="button"
                onClick={() => toggleSpace(spaceId)}
                className={`px-2.5 py-1 rounded-lg text-xs border transition-colors truncate max-w-[180px] ${
                  active
                    ? 'bg-merkaba-accent/15 border-merkaba-accent text-merkaba-text'
                    : 'bg-merkaba-elevated border-merkaba-border text-merkaba-muted hover:text-merkaba-text'
                }`}
                title={formatSpaceDisplay(spaceId, spaceSymbols)}
              >
                {formatSpaceDisplay(spaceId, spaceSymbols)}
              </button>
            );
          })}
          {!noneSelected && !allSelected && (
            <button
              type="button"
              onClick={clearSpaces}
              className="px-2 py-1 rounded-lg text-xs text-merkaba-muted hover:text-merkaba-text transition-colors"
            >
              Сбросить
            </button>
          )}
        </div>

        <div className="ml-auto text-xs text-merkaba-muted pointer-events-none shrink-0">
          {filteredGraph.nodes.length} узлов · {filteredGraph.edges.length} связей
        </div>
      </div>

      {graph.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-merkaba-muted">
          Нет заметок для отображения
        </div>
      ) : noneSelected ? (
        <div className="flex items-center justify-center h-full text-merkaba-muted">
          Выберите хотя бы одно пространство
        </div>
      ) : filteredGraph.nodes.length === 0 ? (
        <div className="flex items-center justify-center h-full text-merkaba-muted">
          В выбранных пространствах нет заметок
        </div>
      ) : (
        <svg ref={svgRef} width="100%" height="100%" />
      )}
    </div>
  );
}
