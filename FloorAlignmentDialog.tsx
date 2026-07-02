import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type Pt = { x: number; y: number };

export interface AlignableFloor {
  floors: { polygon: Pt[] }[];
  walls: { p1: Pt; p2: Pt }[];
  structures: any[];
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  floor1: AlignableFloor | null;
  floor2: AlignableFloor | null;
  onConfirm: (dx: number, dy: number) => void;
}

const SVG_W = 800;
const SVG_H = 560;

const collectPts = (snap: AlignableFloor | null): Pt[] => {
  if (!snap) return [];
  const pts: Pt[] = [];
  for (const f of snap.floors) pts.push(...f.polygon);
  for (const w of snap.walls) {
    pts.push(w.p1);
    pts.push(w.p2);
  }
  for (const s of snap.structures as any[]) {
    if (s?.kind === "stairs" && Array.isArray(s.polygon)) pts.push(...s.polygon);
    else if (s?.kind === "railing" && s.p1 && s.p2) {
      pts.push(s.p1);
      pts.push(s.p2);
    }
  }
  return pts;
};

const bbox = (pts: Pt[]) => {
  if (!pts.length) return { minX: 0, minY: 0, maxX: 1, maxY: 1 };
  let minX = pts[0].x,
    minY = pts[0].y,
    maxX = pts[0].x,
    maxY = pts[0].y;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return { minX, minY, maxX, maxY };
};

function SnapshotLayer({
  snap,
  color,
  strokeWidth,
}: {
  snap: AlignableFloor;
  color: string;
  strokeWidth: number;
}) {
  return (
    <g>
      {snap.floors.map((f, i) =>
        f.polygon.length >= 3 ? (
          <polygon
            key={`floor-${i}`}
            points={f.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
            fill={color}
            fillOpacity={0.06}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeOpacity={0.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null,
      )}
      {snap.walls.map((w, i) => (
        <line
          key={`wall-${i}`}
          x1={w.p1.x}
          y1={w.p1.y}
          x2={w.p2.x}
          y2={w.p2.y}
          stroke={color}
          strokeWidth={strokeWidth}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {(snap.structures as any[]).map((s, i) => {
        if (s?.kind === "stairs" && Array.isArray(s.polygon) && s.polygon.length >= 3) {
          return (
            <polygon
              key={`stair-${i}`}
              points={s.polygon.map((p: Pt) => `${p.x},${p.y}`).join(" ")}
              fill={color}
              fillOpacity={0.2}
              stroke={color}
              strokeWidth={strokeWidth}
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        if (s?.kind === "railing" && s.p1 && s.p2) {
          return (
            <line
              key={`rail-${i}`}
              x1={s.p1.x}
              y1={s.p1.y}
              x2={s.p2.x}
              y2={s.p2.y}
              stroke={color}
              strokeWidth={strokeWidth}
              strokeDasharray="4 3"
              vectorEffect="non-scaling-stroke"
            />
          );
        }
        return null;
      })}
    </g>
  );
}

export function FloorAlignmentDialog({
  open,
  onOpenChange,
  floor1,
  floor2,
  onConfirm,
}: Props) {
  const [dx, setDx] = useState(0);
  const [dy, setDy] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [cam, setCam] = useState({ x: 0, y: 0 });
  const svgRef = useRef<SVGSVGElement>(null);

  // Drag state
  const dragRef = useRef<{
    mode: "floor2" | "camera";
    startClientX: number;
    startClientY: number;
    startDx: number;
    startDy: number;
    startCamX: number;
    startCamY: number;
  } | null>(null);

  // Fit-to-bbox view computed on open
  const view = useMemo(() => {
    const pts = [...collectPts(floor1), ...collectPts(floor2)];
    const b = bbox(pts);
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    const pad = 0.1;
    const scale = Math.min(SVG_W / (w * (1 + pad)), SVG_H / (h * (1 + pad)));
    const tx = SVG_W / 2 - scale * (b.minX + w / 2);
    const ty = SVG_H / 2 - scale * (b.minY + h / 2);
    return { scale, tx, ty };
  }, [floor1, floor2]);

  // Reset transient state when opening
  useEffect(() => {
    if (open) {
      setDx(0);
      setDy(0);
      setZoom(1);
      setCam({ x: 0, y: 0 });
    }
  }, [open]);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    (e.currentTarget as SVGSVGElement).setPointerCapture(e.pointerId);
    dragRef.current = {
      mode: e.shiftKey ? "camera" : "floor2",
      startClientX: e.clientX,
      startClientY: e.clientY,
      startDx: dx,
      startDy: dy,
      startCamX: cam.x,
      startCamY: cam.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const d = dragRef.current;
    if (!d) return;
    const ddx = e.clientX - d.startClientX;
    const ddy = e.clientY - d.startClientY;
    // SVG inner units; account for view.scale * zoom mapping world -> screen
    const k = view.scale * zoom;
    if (d.mode === "floor2") {
      setDx(d.startDx + ddx / k);
      setDy(d.startDy + ddy / k);
    } else {
      setCam({ x: d.startCamX + ddx, y: d.startCamY + ddy });
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (dragRef.current) {
      (e.currentTarget as SVGSVGElement).releasePointerCapture(e.pointerId);
      dragRef.current = null;
    }
  };

  const handleWheel = (e: React.WheelEvent<SVGSVGElement>) => {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
    setZoom((z) => Math.max(0.1, Math.min(10, z * factor)));
  };

  // Outer transform: pan (camera) + zoom around svg center, then fit-to-bbox.
  const outerTransform = `translate(${SVG_W / 2 + cam.x}, ${SVG_H / 2 + cam.y}) scale(${zoom}) translate(${-SVG_W / 2}, ${-SVG_H / 2}) translate(${view.tx}, ${view.ty}) scale(${view.scale})`;

  // Floor 2's manual nudge happens in world units, applied inside the fitted group.
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle>Align Floors</DialogTitle>
          <DialogDescription>
            Drag the translucent Floor 2 overlay so it sits correctly on top of Floor 1. Use Shift+Drag to pan the camera and the mouse wheel to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="relative w-full overflow-hidden rounded-md border bg-muted/30">
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            style={{
              display: "block",
              touchAction: "none",
              cursor: dragRef.current?.mode === "camera" ? "grabbing" : "move",
              userSelect: "none",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onWheel={handleWheel}
          >
            <g transform={outerTransform}>
              {/* Floor 1: locked background, dark */}
              {floor1 && (
                <SnapshotLayer snap={floor1} color="#1f2937" strokeWidth={1.5} />
              )}
              {/* Floor 2: draggable ghost, accent blue */}
              {floor2 && (
                <g
                  opacity={0.5}
                  transform={`translate(${dx}, ${dy})`}
                  style={{ pointerEvents: "none" }}
                >
                  <SnapshotLayer snap={floor2} color="#2563eb" strokeWidth={1.5} />
                </g>
              )}
            </g>
          </svg>

          {/* Helper text */}
          <div className="pointer-events-none absolute bottom-2 left-2 rounded bg-background/85 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
            Drag to move Floor 2 • Shift+Drag to pan camera • Scroll to zoom
          </div>
          {/* Legend */}
          <div className="pointer-events-none absolute top-2 right-2 flex flex-col gap-1 rounded bg-background/85 px-2 py-1 text-[11px] shadow-sm">
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4" style={{ background: "#1f2937" }} />
              <span>Floor 1</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-block h-2 w-4" style={{ background: "#2563eb" }} />
              <span>Floor 2 (ghost)</span>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            variant="ghost"
            onClick={() => {
              setDx(0);
              setDy(0);
            }}
          >
            Reset nudge
          </Button>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              onConfirm(dx, dy);
              onOpenChange(false);
            }}
          >
            Confirm alignment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default FloorAlignmentDialog;
