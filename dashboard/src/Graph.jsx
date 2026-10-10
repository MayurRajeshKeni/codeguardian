import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

const COLORS = { CLEAN: '#10b981', SANITIZED: '#06b6d4', TAINTED: '#f59e0b', VULNERABLE: '#ef4444' };
const EDGE_LABEL = { TRUE_BRANCH: 'true', FALSE_BRANCH: 'false', UNCONDITIONAL: '' };

export function formatInstruction(i) {
  switch (i.op) {
    case 'ASSIGN': return `${i.result} = ${i.arg1}`;
    case 'CALL': return `${i.result ? `${i.result} = ` : ''}${i.arg1}(${i.arg2 ?? ''})`;
    case 'IF_FALSE': return `ifFalse ${i.arg1} goto ${i.result}`;
    case 'IF_TRUE': return `if ${i.arg1} goto ${i.result}`;
    case 'GOTO': return `goto ${i.result}`;
    case 'RETURN': return `return ${i.arg1 ?? ''}`;
    case 'NOT': return `${i.result} = !${i.arg1}`;
    case 'NOP': case 'LABEL': return i.op.toLowerCase();
    default: return `${i.result} = ${i.arg1} ${i.op} ${i.arg2}`;
  }
}

export default function Graph({ cfg, audit, pathBlocks, onSelect }) {
  const box = useRef(null);
  const cy = useRef(null);

  useEffect(() => {
    const nodes = cfg.blocks.map((b) => ({
      data: {
        id: b.id,
        color: COLORS[audit.blockStatus[b.id]] ?? COLORS.CLEAN,
        label: `${b.id} · ${b.label}\n${b.instructions.slice(0, 3).map(formatInstruction).join('\n')}${b.instructions.length > 3 ? '\n…' : ''}`,
      },
    }));
    const edges = cfg.edges.map((e) => ({ data: { id: `${e.from}-${e.to}`, source: e.from, target: e.to, label: EDGE_LABEL[e.type] } }));
    cy.current = cytoscape({
      container: box.current,
      elements: [...nodes, ...edges],
      layout: { name: 'dagre', rankDir: 'TB', nodeSep: 40, rankSep: 50 },
      style: [
        { selector: 'node', style: { shape: 'round-rectangle', 'background-color': '#11161d', 'border-width': 2, 'border-color': 'data(color)', color: '#d7dee8', label: 'data(label)', 'text-wrap': 'wrap', 'text-valign': 'center', 'text-halign': 'center', 'font-family': 'JetBrains Mono, Consolas, monospace', 'font-size': 11, width: 'label', height: 'label', padding: '12px' } },
        { selector: 'edge', style: { width: 2, 'line-color': '#4a5563', 'target-arrow-color': '#4a5563', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier', label: 'data(label)', color: '#8b97a6', 'font-size': 10, 'text-background-color': '#0b0f14', 'text-background-opacity': 1 } },
        { selector: 'node:selected', style: { 'background-color': '#1d2733' } },
        { selector: '.faded', style: { opacity: 0.3 } },
        { selector: 'node.path', style: { 'border-width': 4, 'border-color': '#ef4444', 'background-color': '#2a1215' } },
        { selector: 'edge.path', style: { width: 5, 'line-color': '#ef4444', 'target-arrow-color': '#ef4444', 'z-index': 10 } },
      ],
    });
    cy.current.on('tap', 'node', (event) => onSelect(event.target.id()));
    return () => cy.current.destroy();
  }, [cfg, audit]);

  useEffect(() => {
    const graph = cy.current;
    graph.elements().removeClass('path faded');
    if (pathBlocks.length === 0) return;
    graph.elements().addClass('faded');
    pathBlocks.forEach((id, k) => {
      graph.getElementById(id).removeClass('faded').addClass('path');
      if (k > 0) graph.getElementById(`${pathBlocks[k - 1]}-${id}`).removeClass('faded').addClass('path');
    });
  }, [pathBlocks, cfg, audit]);

  return <div className="graph" ref={box} />;
}
