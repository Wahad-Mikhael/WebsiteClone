import { useEffect, useRef, useState } from "react";
import type { FloorData, WalkPoseRef, Door, WindowItem, FurnitureItem, StairsStructure3D } from "./FloorPlan3D";

/**
 * Compact top-left minimap for Walk mode. Mirrors the styling of the 2D
 * floor plan canvas (paper background, beige floor fills, black walls,
 * white door gaps + arcs, blue windows, grey furniture, hatched stairs)
 * plus a rotating view cone at the walker's position.
 *
 * Sampling loop is throttled to ~20Hz and driven by requestAnimationFrame,
 * so it never triggers React re-renders inside the r3f useFrame path.
 */
export function WalkMinimap({
  floorData,
  poseRef,
  activeFloor,
  onTeleport,
}: {
  floorData: FloorData | null;
  poseRef: WalkPoseRef | undefined;
  activeFloor: 1 | 2;
  onTeleport?: (worldX: number, worldZ: number) => void;
}) {
  const [tick, setTick] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastRef = useRef(0);

  useEffect(() => {
    let mounted = true;
    const loop = (t: number) => {
      if (!mounted) return;
      if (t - lastRef.current > 50) {
        lastRef.current = t;
        setTick((n) => (n + 1) & 0xffff);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => {
      mounted = false;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  if (!floorData) return null;

  // Bounds: walls + floor polygons + structures + furniture corners so
  // uploaded plans with only polygon shells still render.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const consider = (p: { x: number; y: number }) => {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  };
  for (const wall of floorData.walls) { consider(wall.p1); consider(wall.p2); }
  for (const f of floorData.floors ?? []) {
    for (const p of (f as { polygon?: { x: number; y: number }[] }).polygon ?? []) consider(p);
  }
  for (const s of floorData.structures ?? []) {
    const anyS = s as { p1?: { x: number; y: number }; p2?: { x: number; y: number }; polygon?: { x: number; y: number }[] };
    if (anyS.p1) consider(anyS.p1);
    if (anyS.p2) consider(anyS.p2);
    for (const p of anyS.polygon ?? []) consider(p);
  }
  for (const fi of floorData.furniture ?? []) {
    for (const p of fi.corners ?? []) consider(p);
  }
  if (!isFinite(minX)) return null;

  const pad = 10;
  const w = maxX - minX;
  const h = maxY - minY;
  const size = 220;
  const scale = (size - pad * 2) / Math.max(w, h, 1);
  const toX = (x: number) => (x - minX) * scale + pad + (size - pad * 2 - w * scale) / 2;
  const toY = (y: number) => (y - minY) * scale + pad + (size - pad * 2 - h * scale) / 2;

  const pose = poseRef?.current;
  const px = pose ? toX(pose.x) : size / 2;
  const py = pose ? toY(pose.z) : size / 2;
  const yaw = pose?.yaw ?? 0;
  const hx = Math.sin(yaw);
  const hy = Math.cos(yaw);
  const coneLen = 26;
  const coneHalf = Math.PI / 5;
  const rx1 = px + Math.cos(Math.atan2(hy, hx) - coneHalf) * coneLen;
  const ry1 = py + Math.sin(Math.atan2(hy, hx) - coneHalf) * coneLen;
  const rx2 = px + Math.cos(Math.atan2(hy, hx) + coneHalf) * coneLen;
  const ry2 = py + Math.sin(Math.atan2(hy, hx) + coneHalf) * coneLen;

  void tick;

  // ---- Style tokens tuned to the 2D canvas ---------------------------------
  const PAPER = "#faf7f1";
  const FLOOR_FILL = "#f1ead9";
  const FLOOR_STROKE = "#c9bfa5";
  const WALL = "#111827";
  const DOOR_ARC = "#94a3b8";
  const WINDOW = "#3b82f6";
  const FURN_FILL = "#e5e7eb";
  const FURN_STROKE = "#6b7280";
  const STAIR_FILL = "#eef2f7";
  const STAIR_STROKE = "#334155";

  const wallThicknessPx = (t?: number) => Math.max(1.2, (t ?? 4) * scale);

  return (
    <div className="absolute top-4 left-4 z-30 rounded-xl border border-border bg-card/95 backdrop-blur shadow-md p-2">
      <svg
        width={size}
        height={size}
        className={`block rounded-md ${onTeleport ? "cursor-crosshair" : ""}`}
        onPointerDown={(e) => {
          if (!onTeleport) return;
          (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const wx = (sx - pad - (size - pad * 2 - w * scale) / 2) / scale + minX;
          const wz = (sy - pad - (size - pad * 2 - h * scale) / 2) / scale + minY;
          onTeleport(wx, wz);
        }}
        onPointerMove={(e) => {
          if (!onTeleport) return;
          if (!(e.currentTarget as SVGSVGElement).hasPointerCapture(e.pointerId)) return;
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const sx = e.clientX - rect.left;
          const sy = e.clientY - rect.top;
          const wx = (sx - pad - (size - pad * 2 - w * scale) / 2) / scale + minX;
          const wz = (sy - pad - (size - pad * 2 - h * scale) / 2) / scale + minY;
          onTeleport(wx, wz);
        }}
      >
        {/* Paper background */}
        <rect x={0} y={0} width={size} height={size} rx={8} fill={PAPER} />

        {/* Floor polygons (rooms) */}
        {(floorData.floors ?? []).map((f, i) => {
          const poly = (f as { polygon?: { x: number; y: number }[] }).polygon;
          if (!poly || poly.length < 3) return null;
          const d = poly.map((p, j) => `${j === 0 ? "M" : "L"}${toX(p.x)},${toY(p.y)}`).join(" ") + " Z";
          return (
            <path
              key={`f-${i}`}
              d={d}
              fill={FLOOR_FILL}
              stroke={FLOOR_STROKE}
              strokeWidth={0.6}
            />
          );
        })}

        {/* Stairs — hatched footprint with tread lines */}
        {(floorData.structures ?? []).map((s, i) => {
          if ((s as StairsStructure3D).kind !== "stairs") return null;
          const stair = s as StairsStructure3D;
          const poly = stair.polygon ?? [];
          if (poly.length < 3) return null;
          const d = poly.map((p, j) => `${j === 0 ? "M" : "L"}${toX(p.x)},${toY(p.y)}`).join(" ") + " Z";
          // Simple tread lines: connect midpoints between consecutive edges.
          const treads = Math.max(2, stair.tread_count ?? 8);
          const treadLines: { x1: number; y1: number; x2: number; y2: number }[] = [];
          if (poly.length >= 4 && stair.start && stair.end) {
            const sx = stair.start.x, sy = stair.start.y;
            const ex = stair.end.x, ey = stair.end.y;
            const dxT = (ex - sx) / treads;
            const dyT = (ey - sy) / treads;
            // Perpendicular vector for tread width.
            const len = Math.hypot(ex - sx, ey - sy) || 1;
            const perpX = -(ey - sy) / len;
            const perpY = (ex - sx) / len;
            const halfWpx = (stair.width_in ?? 36) * 0.5;
            for (let t = 1; t < treads; t++) {
              const cx = sx + dxT * t;
              const cy = sy + dyT * t;
              treadLines.push({
                x1: toX(cx - perpX * halfWpx),
                y1: toY(cy - perpY * halfWpx),
                x2: toX(cx + perpX * halfWpx),
                y2: toY(cy + perpY * halfWpx),
              });
            }
          }
          return (
            <g key={`s-${i}`}>
              <path d={d} fill={STAIR_FILL} stroke={STAIR_STROKE} strokeWidth={0.9} />
              {treadLines.map((l, j) => (
                <line
                  key={`t-${i}-${j}`}
                  x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2}
                  stroke={STAIR_STROKE}
                  strokeWidth={0.5}
                  opacity={0.7}
                />
              ))}
            </g>
          );
        })}

        {/* Furniture — footprint rectangles from corners */}
        {(floorData.furniture ?? []).map((fi: FurnitureItem, i) => {
          const c = fi.corners;
          if (!c || c.length < 3) return null;
          const d = c.map((p, j) => `${j === 0 ? "M" : "L"}${toX(p.x)},${toY(p.y)}`).join(" ") + " Z";
          return (
            <path
              key={`fu-${i}`}
              d={d}
              fill={FURN_FILL}
              fillOpacity={0.9}
              stroke={FURN_STROKE}
              strokeWidth={0.6}
            />
          );
        })}

        {/* Walls — thick black strokes */}
        {floorData.walls.map((wall) => (
          <line
            key={wall.id}
            x1={toX(wall.p1.x)}
            y1={toY(wall.p1.y)}
            x2={toX(wall.p2.x)}
            y2={toY(wall.p2.y)}
            stroke={WALL}
            strokeWidth={wallThicknessPx(wall.thickness)}
            strokeLinecap="butt"
          />
        ))}

        {/* Doors — white gap on the wall + short swing arc */}
        {(floorData.doors ?? []).map((d: Door) => {
          const x1 = toX(d.hinge.x), y1 = toY(d.hinge.y);
          const x2 = toX(d.strike.x), y2 = toY(d.strike.y);
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          // Perp for arc direction (toward leaf point if available).
          let nx = -dy / len, ny = dx / len;
          if (d.leaf) {
            const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
            const lx = toX(d.leaf.x), ly = toY(d.leaf.y);
            if ((lx - mx) * nx + (ly - my) * ny < 0) { nx = -nx; ny = -ny; }
          }
          const r = len;
          const ax = x1 + nx * r, ay = y1 + ny * r;
          return (
            <g key={d.id}>
              {/* Erase wall under door with paper color */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={PAPER} strokeWidth={Math.max(2, len * 0.35)} strokeLinecap="butt" />
              {/* Jambs */}
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WALL} strokeWidth={0.8} />
              {/* Swing arc */}
              <path
                d={`M ${x2} ${y2} A ${r} ${r} 0 0 1 ${ax} ${ay}`}
                fill="none"
                stroke={DOOR_ARC}
                strokeWidth={0.7}
              />
              {/* Leaf */}
              <line x1={x1} y1={y1} x2={ax} y2={ay} stroke={WALL} strokeWidth={0.8} />
            </g>
          );
        })}

        {/* Windows — blue double-line across the opening */}
        {(floorData.windows ?? []).map((w: WindowItem) => {
          const cx = toX(w.center.x);
          const cy = toY(w.center.y);
          const halfW = (w.width * scale) / 2;
          const cos = Math.cos(w.rotation_rad);
          const sin = Math.sin(w.rotation_rad);
          const ax = cx - cos * halfW, ay = cy - sin * halfW;
          const bx = cx + cos * halfW, by = cy + sin * halfW;
          const off = Math.max(1, (w.thickness * scale) * 0.35);
          const nx = -sin * off, ny = cos * off;
          return (
            <g key={w.id}>
              {/* Erase wall under window */}
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={PAPER} strokeWidth={Math.max(2, off * 2 + 1)} strokeLinecap="butt" />
              <line x1={ax + nx} y1={ay + ny} x2={bx + nx} y2={by + ny} stroke={WINDOW} strokeWidth={0.9} />
              <line x1={ax - nx} y1={ay - ny} x2={bx - nx} y2={by - ny} stroke={WINDOW} strokeWidth={0.9} />
              <line x1={ax} y1={ay} x2={bx} y2={by} stroke={WINDOW} strokeWidth={0.5} opacity={0.6} />
            </g>
          );
        })}

        {/* Walker cone + dot */}
        {pose && (
          <>
            <polygon
              points={`${px},${py} ${rx1},${ry1} ${rx2},${ry2}`}
              fill="hsl(var(--primary))"
              fillOpacity={0.28}
              stroke="hsl(var(--primary))"
              strokeWidth={1}
            />
            <circle cx={px} cy={py} r={4.5} fill="hsl(var(--primary))" stroke="white" strokeWidth={1.5} />
          </>
        )}
      </svg>
      <div className="text-[10px] mt-1 text-center font-semibold tracking-wide text-muted-foreground">
        FLOOR {activeFloor}
      </div>
    </div>
  );
}
