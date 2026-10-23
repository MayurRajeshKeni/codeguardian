import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

cytoscape.use(dagre);

const COLORS = {
  CLEAN: '#10b981',
  SANITIZED: '#06b6d4',
  TAINTED: '#f59e0b',
  VULNERABLE: '#ef4444',
};

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

function escapeXml(unsafe) {
  return String(unsafe ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateBlockSvg(b, status, statusColor, isLight = false) {
  const instructions = b.instructions.slice(0, 4).map(formatInstruction);
  const isTruncated = b.instructions.length > 4;

  const labelText = `${b.id} · ${b.label}`;
  let maxChars = Math.max(labelText.length + status.length + 5, 20);
  for (const inst of instructions) {
    if (inst.length > maxChars) maxChars = inst.length;
  }

  const width = Math.max(230, Math.min(360, Math.round(maxChars * 7.6 + 34)));
  const contentLinesCount = instructions.length + (isTruncated ? 1 : 0);
  const height = Math.max(76, 32 + contentLinesCount * 20 + 12);

  const statusBg = {
    CLEAN: isLight ? 'rgba(5, 150, 105, 0.12)' : 'rgba(16, 185, 129, 0.16)',
    SANITIZED: isLight ? 'rgba(8, 145, 178, 0.12)' : 'rgba(6, 182, 212, 0.16)',
    TAINTED: isLight ? 'rgba(217, 119, 6, 0.12)' : 'rgba(245, 158, 11, 0.16)',
    VULNERABLE: isLight ? 'rgba(220, 38, 38, 0.12)' : 'rgba(239, 68, 68, 0.22)',
  }[status] || (isLight ? 'rgba(0, 0, 0, 0.05)' : 'rgba(255, 255, 255, 0.1)');

  const statusBorder = {
    CLEAN: isLight ? 'rgba(5, 150, 105, 0.35)' : 'rgba(16, 185, 129, 0.45)',
    SANITIZED: isLight ? 'rgba(8, 145, 178, 0.35)' : 'rgba(6, 182, 212, 0.45)',
    TAINTED: isLight ? 'rgba(217, 119, 6, 0.35)' : 'rgba(245, 158, 11, 0.45)',
    VULNERABLE: isLight ? 'rgba(220, 38, 38, 0.35)' : 'rgba(239, 68, 68, 0.55)',
  }[status] || (isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255, 255, 255, 0.2)');

  const chipWidth = Math.round(status.length * 6.6 + 14);
  const chipX = width - chipWidth - 10;

  const cardBg = isLight ? '#ffffff' : '#0d1117';
  const headerBg = isLight ? '#f8fafc' : '#161d28';
  const headerBorder = isLight ? '#e2e8f0' : '#253244';
  const idTextColor = isLight ? '#0f172a' : '#ffffff';
  const labelTextColor = isLight ? '#64748b' : '#94a3b8';
  const dotColor = isLight ? '#cbd5e1' : '#475569';
  const instTextColor = isLight ? '#334155' : '#cbd5e1';
  const ellipsisColor = isLight ? '#94a3b8' : '#64748b';

  const linesSvg = instructions.map((inst, idx) => {
    const y = 49 + idx * 20;
    const cleanInst = inst.length > 40 ? inst.slice(0, 39) + '…' : inst;
    return `<text x="14" y="${y}" font-family="'JetBrains Mono', Consolas, monospace" font-size="11" fill="${instTextColor}">${escapeXml(cleanInst)}</text>`;
  }).join('');

  const ellipsisSvg = isTruncated
    ? `<text x="14" y="${49 + instructions.length * 20}" font-family="'JetBrains Mono', Consolas, monospace" font-size="11" fill="${ellipsisColor}">…</text>`
    : '';

  const idWidth = b.id.length * 8;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <!-- Background Card -->
    <rect width="${width}" height="${height}" rx="7" fill="${cardBg}" />

    <!-- Top Distinct Header Bar -->
    <path d="M 0,7 A 7,7 0 0,1 7,0 L ${width - 7},0 A 7,7 0 0,1 ${width},7 L ${width},30 L 0,30 Z" fill="${headerBg}" />
    <line x1="0" y1="30" x2="${width}" y2="30" stroke="${headerBorder}" stroke-width="1.2" />

    <!-- Accent Pill Indicator on Left -->
    <rect x="9" y="7" width="3.5" height="16" rx="1.5" fill="${statusColor}" />

    <!-- Header Block ID -->
    <text x="18" y="19" font-family="'JetBrains Mono', Consolas, monospace" font-size="11.5" font-weight="700" fill="${idTextColor}">${escapeXml(b.id)}</text>
    
    <!-- Divider Dot -->
    <text x="${18 + idWidth + 4}" y="19" font-family="'JetBrains Mono', Consolas, monospace" font-size="10.5" fill="${dotColor}">·</text>

    <!-- Header Block Label -->
    <text x="${18 + idWidth + 14}" y="19" font-family="'JetBrains Mono', Consolas, monospace" font-size="11" font-weight="500" fill="${labelTextColor}">${escapeXml(b.label)}</text>

    <!-- Header Status Chip on Right -->
    <rect x="${chipX}" y="6.5" width="${chipWidth}" height="17" rx="3.5" fill="${statusBg}" stroke="${statusBorder}" stroke-width="1" />
    <text x="${chipX + chipWidth / 2}" y="18.5" text-anchor="middle" font-family="'JetBrains Mono', Consolas, monospace" font-size="9" font-weight="700" fill="${statusColor}" letter-spacing="0.4">${status}</text>

    <!-- Instruction Lines Body (Left-Aligned Monospace) -->
    ${linesSvg}
    ${ellipsisSvg}
  </svg>`;

  return {
    svgDataUri: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`,
    width,
    height,
  };
}

function MiniMap({ cyInstance, pathBlocks, isExpanded, onToggle, theme }) {
  const [viewport, setViewport] = useState(null);
  const [nodesData, setNodesData] = useState([]);
  const [graphBounds, setGraphBounds] = useState({ x1: 0, y1: 0, w: 1000, h: 800 });

  useEffect(() => {
    if (!cyInstance) return;
    const update = () => {
      const cy = cyInstance;
      const bb = cy.elements().boundingBox();
      const padding = 50;
      const w = Math.max(100, (bb.x2 - bb.x1) + padding * 2);
      const h = Math.max(100, (bb.y2 - bb.y1) + padding * 2);
      const x1 = bb.x1 - padding;
      const y1 = bb.y1 - padding;
      setGraphBounds({ x1, y1, w, h });

      const extent = cy.extent();
      setViewport(extent);

      const nodes = cy.nodes().map((n) => ({
        id: n.id(),
        pos: n.position(),
        color: n.data('color'),
        w: n.width(),
        h: n.height(),
      }));
      setNodesData(nodes);
    };

    update();
    cyInstance.on('pan zoom render position', update);
    return () => {
      cyInstance.removeListener('pan zoom render position', update);
    };
  }, [cyInstance]);

  const mapWidth = 190;
  const mapHeight = 125;
  const scale = Math.min(mapWidth / (graphBounds.w || 1), mapHeight / (graphBounds.h || 1));
  const toMapX = (x) => (x - graphBounds.x1) * scale;
  const toMapY = (y) => (y - graphBounds.y1) * scale;

  const handleClick = (e) => {
    if (!cyInstance) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;
    const modelX = graphBounds.x1 + clickX / scale;
    const modelY = graphBounds.y1 + clickY / scale;
    cyInstance.animate({ center: { x: modelX, y: modelY }, duration: 250 });
  };

  return (
    <div className={`minimap-panel ${isExpanded ? 'open' : 'collapsed'}`}>
      <div className="minimap-header" onClick={onToggle}>
        <span className="minimap-title">MINI-MAP</span>
        <button type="button" className="minimap-toggle-btn">{isExpanded ? '−' : '+'}</button>
      </div>
      {isExpanded && (
        <div className="minimap-body" onClick={handleClick} title="Click to pan graph">
          <svg width={mapWidth} height={mapHeight} className="minimap-svg">
            <rect
              width={mapWidth}
              height={mapHeight}
              fill={theme === 'light' ? '#ffffff' : '#090d14'}
              stroke={theme === 'light' ? '#cbd5e1' : 'rgba(255,255,255,0.08)'}
              strokeWidth="1"
              rx="4"
            />
            {nodesData.map((n) => {
              const nx = toMapX(n.pos.x - n.w / 2);
              const ny = toMapY(n.pos.y - n.h / 2);
              const nw = Math.max(5, n.w * scale);
              const nh = Math.max(4, n.h * scale);
              const isPath = pathBlocks.includes(n.id);
              const isLight = theme === 'light';
              return (
                <rect
                  key={n.id}
                  x={nx}
                  y={ny}
                  width={nw}
                  height={nh}
                  rx={2}
                  fill={isPath ? '#ef4444' : n.color}
                  stroke={isPath ? '#ffffff' : (isLight ? 'rgba(0, 0, 0, 0.15)' : 'rgba(255,255,255,0.2)')}
                  strokeWidth={isPath ? 1.5 : 0.5}
                />
              );
            })}
            {viewport && (
              <rect
                x={Math.max(0, toMapX(viewport.x1))}
                y={Math.max(0, toMapY(viewport.y1))}
                width={Math.min(mapWidth, viewport.w * scale)}
                height={Math.min(mapHeight, viewport.h * scale)}
                fill={theme === 'light' ? 'rgba(14, 165, 233, 0.16)' : 'rgba(56, 189, 248, 0.12)'}
                stroke={theme === 'light' ? '#0284c7' : '#38bdf8'}
                strokeWidth={1.5}
                strokeDasharray="4 2"
              />
            )}
          </svg>
        </div>
      )}
    </div>
  );
}

export default function Graph({ cfg, audit, pathBlocks, focusTarget, onSelect, resizeTrigger, theme }) {
  const box = useRef(null);
  const cy = useRef(null);
  const [minimapOpen, setMinimapOpen] = useState(true);
  const [, setCyReady] = useState(false);
  const isLight = theme === 'light';

  useEffect(() => {
    const nodes = cfg.blocks.map((b) => {
      const status = audit.blockStatus[b.id] ?? 'CLEAN';
      const statusColor = COLORS[status] ?? COLORS.CLEAN;
      const { svgDataUri, width, height } = generateBlockSvg(b, status, statusColor, isLight);

      return {
        data: {
          id: b.id,
          color: statusColor,
          svgDataUri,
          width,
          height,
        },
      };
    });

    const edges = cfg.edges.map((e) => ({
      data: {
        id: `${e.from}-${e.to}`,
        source: e.from,
        target: e.to,
        label: EDGE_LABEL[e.type],
      },
    }));

    cy.current = cytoscape({
      container: box.current,
      elements: [...nodes, ...edges],
      layout: { name: 'dagre', rankDir: 'TB', nodeSep: 40, rankSep: 50 },
      minZoom: 0.35,
      maxZoom: 2.2,
      wheelSensitivity: 0.22,
      style: [
        {
          selector: 'node',
          style: {
            shape: 'round-rectangle',
            width: 'data(width)',
            height: 'data(height)',
            'background-image': 'data(svgDataUri)',
            'background-fit': 'contain',
            'background-clip': 'node',
            'background-color': isLight ? '#ffffff' : '#0d1117',
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.85,
            padding: 0,
            label: '',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 2,
            'line-color': isLight ? '#94a3b8' : '#4a5563',
            'target-arrow-color': isLight ? '#94a3b8' : '#4a5563',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            color: isLight ? '#475569' : '#8b97a6',
            'font-size': 10,
            'text-background-color': isLight ? '#f1f5f9' : '#0b0f14',
            'text-background-opacity': 1,
          },
        },
        {
          selector: 'node:selected',
          style: {
            'border-color': '#38bdf8',
            'border-width': 4,
            'border-opacity': 1,
            'shadow-blur': 16,
            'shadow-color': '#38bdf8',
            'shadow-opacity': 0.8,
          },
        },
        {
          selector: '.faded',
          style: { opacity: 0.2 },
        },
        {
          selector: 'node.path',
          style: {
            'border-width': 4,
            'border-color': '#ef4444',
            'border-opacity': 1,
            'shadow-blur': 18,
            'shadow-color': '#ef4444',
            'shadow-opacity': 0.85,
          },
        },
        {
          selector: 'edge.path',
          style: {
            width: 4,
            'line-color': '#ef4444',
            'target-arrow-color': '#ef4444',
            'z-index': 10,
            'shadow-blur': 12,
            'shadow-color': '#ef4444',
            'shadow-opacity': 0.75,
          },
        },
      ],
    });

    cy.current.fit(undefined, 40);
    setCyReady(true);

    cy.current.on('tap', 'node', (event) => onSelect(event.target.id()));
    cy.current.on('dbltap', (event) => {
      if (event.target === cy.current) {
        cy.current.fit(undefined, 40);
      }
    });

    return () => {
      if (cy.current) {
        cy.current.destroy();
      }
    };
  }, [cfg, audit, theme]);

  // Handle path highlighting
  useEffect(() => {
    const graph = cy.current;
    if (!graph) return;
    graph.elements().removeClass('path faded');
    if (pathBlocks.length === 0) return;
    graph.elements().addClass('faded');
    pathBlocks.forEach((id, k) => {
      const node = graph.getElementById(id);
      if (node.length) node.removeClass('faded').addClass('path');
      if (k > 0) {
        const edge = graph.getElementById(`${pathBlocks[k - 1]}-${id}`);
        if (edge.length) edge.removeClass('faded').addClass('path');
      }
    });
  }, [pathBlocks, cfg, audit]);

  // Handle smooth auto-pan & focus triggers from App.jsx
  useEffect(() => {
    if (!focusTarget || !cy.current) return;
    const graph = cy.current;

    if (focusTarget.type === 'block') {
      const node = graph.getElementById(focusTarget.blockId);
      if (node.length) {
        graph.animate({
          center: { eles: node },
          zoom: Math.min(graph.maxZoom(), 1.25),
          duration: 450,
          easing: 'ease-in-out-cubic',
        });
      }
    } else if (focusTarget.type === 'path' && focusTarget.blocks?.length) {
      const eles = graph.collection();
      focusTarget.blocks.forEach((id) => {
        eles.merge(graph.getElementById(id));
      });
      if (eles.length) {
        graph.animate({
          fit: { eles, padding: 70 },
          duration: 500,
          easing: 'ease-in-out-cubic',
        });
      }
    }
  }, [focusTarget]);

  // Resize listener when sidebar expands/collapses or divider drags
  useEffect(() => {
    if (cy.current) {
      cy.current.resize();
    }
  }, [resizeTrigger]);

  const handleZoomIn = () => {
    if (!cy.current) return;
    cy.current.zoom({
      level: Math.min(cy.current.maxZoom(), cy.current.zoom() * 1.3),
      renderedPosition: { x: cy.current.width() / 2, y: cy.current.height() / 2 },
    });
  };

  const handleZoomOut = () => {
    if (!cy.current) return;
    cy.current.zoom({
      level: Math.max(cy.current.minZoom(), cy.current.zoom() * 0.77),
      renderedPosition: { x: cy.current.width() / 2, y: cy.current.height() / 2 },
    });
  };

  const handleFit = () => {
    if (!cy.current) return;
    cy.current.fit(undefined, 40);
  };

  return (
    <div className="graph-wrapper">
      <div className="graph" ref={box} />

      <div className="graph-controls">
        <button type="button" className="graph-btn" onClick={handleZoomIn} title="Zoom In (+)">
          +
        </button>
        <button type="button" className="graph-btn" onClick={handleZoomOut} title="Zoom Out (−)">
          −
        </button>
        <button type="button" className="graph-btn fit-btn" onClick={handleFit} title="Fit Graph to Screen (Double-click background also fits)">
          ⛶ Fit View
        </button>
      </div>

      <MiniMap
        cyInstance={cy.current}
        pathBlocks={pathBlocks}
        isExpanded={minimapOpen}
        onToggle={() => setMinimapOpen(!minimapOpen)}
        theme={theme}
      />
    </div>
  );
}
