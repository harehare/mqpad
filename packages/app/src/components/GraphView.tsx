import { useRef, useState } from "react";
import { LuX } from "react-icons/lu";
import type { GraphData } from "../graph/computeGraph";
import "./GraphView.css";

export type GraphViewProps = {
  graph: GraphData;
  activePath: string | null;
  onNavigate: (path: string) => void;
  onClose: () => void;
};

type NodePos = { id: string; label: string; x: number; y: number; vx: number; vy: number };

const WIDTH = 900;
const HEIGHT = 640;
const REPULSION = 2600;
const SPRING_LENGTH = 90;
const SPRING_STRENGTH = 0.02;
const CENTER_STRENGTH = 0.01;
const DAMPING = 0.85;
const CLICK_THRESHOLD = 4;

/**
 * A small, dependency-free force-directed layout: repulsion between every
 * node pair, a spring along each edge, and a weak pull to center. Runs
 * synchronously for a fixed iteration budget (scaled down for large vaults
 * to keep the O(n^2) repulsion pass bounded) rather than animating live,
 * since this is a one-shot "open the graph" view, not a live simulation.
 */
function simulate(graph: GraphData): NodePos[] {
  const iterations = Math.max(40, Math.min(260, Math.floor(15000 / Math.max(graph.nodes.length, 1))));
  const positions = new Map<string, NodePos>();
  graph.nodes.forEach((node, i) => {
    const angle = (i / Math.max(graph.nodes.length, 1)) * Math.PI * 2;
    const r = Math.min(WIDTH, HEIGHT) / 3;
    positions.set(node.id, {
      id: node.id,
      label: node.label,
      x: WIDTH / 2 + Math.cos(angle) * r,
      y: HEIGHT / 2 + Math.sin(angle) * r,
      vx: 0,
      vy: 0,
    });
  });
  const list = [...positions.values()];

  for (let iter = 0; iter < iterations; iter++) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]!;
        const b = list[j]!;
        let dx = a.x - b.x;
        let dy = a.y - b.y;
        let distSq = dx * dx + dy * dy;
        if (distSq < 1) {
          dx = Math.random() - 0.5;
          dy = Math.random() - 0.5;
          distSq = 1;
        }
        const dist = Math.sqrt(distSq);
        const force = REPULSION / distSq;
        const fx = (dx / dist) * force;
        const fy = (dy / dist) * force;
        a.vx += fx;
        a.vy += fy;
        b.vx -= fx;
        b.vy -= fy;
      }
    }
    for (const edge of graph.edges) {
      const a = positions.get(edge.source);
      const b = positions.get(edge.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
      const force = (dist - SPRING_LENGTH) * SPRING_STRENGTH;
      const fx = (dx / dist) * force;
      const fy = (dy / dist) * force;
      a.vx += fx;
      a.vy += fy;
      b.vx -= fx;
      b.vy -= fy;
    }
    for (const node of list) {
      node.vx += (WIDTH / 2 - node.x) * CENTER_STRENGTH;
      node.vy += (HEIGHT / 2 - node.y) * CENTER_STRENGTH;
      node.vx *= DAMPING;
      node.vy *= DAMPING;
      node.x += node.vx;
      node.y += node.vy;
    }
  }

  return list;
}

/** Full-screen overlay visualizing the vault's `[[WikiLink]]` graph as a simple force-directed layout - drag nodes, scroll to zoom, click a node to open it. */
export function GraphView({ graph, activePath, onNavigate, onClose }: GraphViewProps) {
  const [positions, setPositions] = useState<NodePos[]>(() => simulate(graph));
  const [view, setView] = useState({ x: 0, y: 0, scale: 1 });
  const dragNode = useRef<{ id: string; startX: number; startY: number; moved: boolean } | null>(null);
  const panDrag = useRef<{ startX: number; startY: number; originX: number; originY: number } | null>(null);

  const toWorld = (clientX: number, clientY: number, rect: DOMRect) => ({
    x: (clientX - rect.left - view.x) / view.scale,
    y: (clientY - rect.top - view.y) / view.scale,
  });

  const handleNodePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    dragNode.current = { id, startX: e.clientX, startY: e.clientY, moved: false };
  };

  const handleNodePointerMove = (e: React.PointerEvent, rect: DOMRect) => {
    const drag = dragNode.current;
    if (!drag) return;
    if (Math.abs(e.clientX - drag.startX) + Math.abs(e.clientY - drag.startY) > CLICK_THRESHOLD) drag.moved = true;
    const world = toWorld(e.clientX, e.clientY, rect);
    setPositions((prev) => prev.map((p) => (p.id === drag.id ? { ...p, x: world.x, y: world.y } : p)));
  };

  const handleNodePointerUp = (path: string) => {
    const drag = dragNode.current;
    dragNode.current = null;
    if (drag && !drag.moved) {
      onNavigate(path);
      onClose();
    }
  };

  const handleBackgroundPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    panDrag.current = { startX: e.clientX, startY: e.clientY, originX: view.x, originY: view.y };
  };

  const handleBackgroundPointerMove = (e: React.PointerEvent) => {
    const pan = panDrag.current;
    if (!pan) return;
    setView((prev) => ({
      ...prev,
      x: pan.originX + (e.clientX - pan.startX),
      y: pan.originY + (e.clientY - pan.startY),
    }));
  };

  const handleBackgroundPointerUp = () => {
    panDrag.current = null;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setView((prev) => ({ ...prev, scale: Math.max(0.3, Math.min(3, prev.scale - e.deltaY * 0.001)) }));
  };

  const byId = new Map(positions.map((p) => [p.id, p]));

  return (
    <div className="mqpad-graph-overlay" onClick={onClose}>
      <div className="mqpad-graph-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="mqpad-graph-header">
          <h2>Graph View</h2>
          <button type="button" className="mqpad-graph-close" onClick={onClose} title="Close" aria-label="Close">
            <LuX size={16} />
          </button>
        </div>
        {graph.nodes.length === 0 ? (
          <div className="mqpad-graph-empty">No notes yet.</div>
        ) : (
          <svg
            className="mqpad-graph-svg"
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            onWheel={handleWheel}
            onPointerDown={handleBackgroundPointerDown}
            onPointerMove={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              handleBackgroundPointerMove(e);
              handleNodePointerMove(e, rect);
            }}
            onPointerUp={handleBackgroundPointerUp}
          >
            <g transform={`translate(${view.x} ${view.y}) scale(${view.scale})`}>
              {graph.edges.map((edge, i) => {
                const a = byId.get(edge.source);
                const b = byId.get(edge.target);
                if (!a || !b) return null;
                return (
                  <line
                    key={i}
                    className="mqpad-graph-edge"
                    x1={a.x}
                    y1={a.y}
                    x2={b.x}
                    y2={b.y}
                  />
                );
              })}
              {positions.map((p) => (
                <g
                  key={p.id}
                  className={`mqpad-graph-node ${p.id === activePath ? "active" : ""}`}
                  transform={`translate(${p.x} ${p.y})`}
                  onPointerDown={(e) => handleNodePointerDown(e, p.id)}
                  onPointerUp={() => handleNodePointerUp(p.id)}
                >
                  <circle r={7} />
                  <text x={10} y={4}>
                    {p.label}
                  </text>
                </g>
              ))}
            </g>
          </svg>
        )}
      </div>
    </div>
  );
}
