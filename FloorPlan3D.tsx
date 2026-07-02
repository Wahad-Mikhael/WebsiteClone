import { memo, useMemo, useState, useRef, useLayoutEffect, Suspense, useEffect } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, useTexture, Bvh } from "@react-three/drei";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import * as THREE from "three";
import LightingSystem from "./LightingSystem";
import { DoorInstance, WindowInstance, useModelPreload } from "./ModelSystem";
import { Furniture3D } from "./Furniture3D";
import type { AssetModel } from "@/lib/assets";

// Shared, module-level default materials. Every wall/floor/ceiling that isn't
// tinted, textured, hovered, or selected can point at these references so
// r3f doesn't allocate a fresh MeshStandardMaterial per mesh. Selection/hover
// states still use inline JSX materials so their emissive can vary per mesh.
const SHARED_MATERIALS = {
  wall: new THREE.MeshStandardMaterial({ color: "#e8e3dc", roughness: 0.85, metalness: 0.05 }),
  floor: new THREE.MeshStandardMaterial({ color: "#c9b89c", roughness: 0.7, metalness: 0.05, side: THREE.DoubleSide }),
  ceiling: new THREE.MeshStandardMaterial({ color: "#ffffff", transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, roughness: 1, metalness: 0 }),
};

export type Pt = { x: number; y: number };
export type Floor = { id: string; polygon: Pt[] };
export type Wall = { id: string; thickness: number; p1: Pt; p2: Pt };
export type Door = {
  id: string;
  thickness: number;
  width: number;
  hinge: Pt;
  strike: Pt;
  leaf: Pt;
  height_in?: number;
  flipX?: boolean;
  flipY?: boolean;
  open?: boolean;
  model_url?: string;
  is_double?: boolean;
  is_arch?: boolean;
};
export type WindowItem = {
  id: string;
  width: number;
  thickness: number;
  center: Pt;
  rotation_rad: number;
  height_in?: number;
  sill_height_in?: number;
  dist_from_ceiling_in?: number;
  model_url?: string;
  is_patio?: boolean;
};

export type MaterialAssignment = {
  color_url: string;
  roughness_url: string;
  normal_url: string;
  ao_url?: string;
  metallic_url?: string;
};
export type VisualMetadata = Record<
  string,
  { color?: string; material?: MaterialAssignment; tile_scale?: number; tint?: string }
>;
export type FurnitureItem = {
  id: string;
  type: string;
  is_L_shaped: boolean;
  corners: Pt[];
  back_edge?: { p1: Pt; p2: Pt };
  angle_deg: number;
  model_url?: string;
};
export type Selection3D =
  | { kind: "wall"; id: string }
  | { kind: "floor"; id: string }
  | { kind: "door"; id: string }
  | { kind: "window"; id: string }
  | { kind: "baseboard"; id: string }
  | { kind: "furniture"; id: string }
  | null;

export interface FloorData {
  floors: Floor[];
  walls: Wall[];
  doors: Door[];
  windows: WindowItem[];
  furniture?: FurnitureItem[];
  ceilingHeightIn: number;
}

interface Props {
  /** Ordered floors, index 0 = Floor 1, index 1 = Floor 2. */
  floorsData: FloorData[];
  /** "ALL" or 1-based floor index to isolate visibility. */
  visibleFloor: "ALL" | 1 | 2;
  furnitureAssets?: AssetModel[];
  pixelsPerFoot: number;
  visualMetadata: VisualMetadata;
  selection: Selection3D;
  onSelect: (s: Selection3D) => void;
  ambientIntensity: number;
  directionalIntensity: number;
  windowIntensity?: number;
  roomLightIntensity?: number;
  nightMode?: boolean;
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
  sunWarmth?: number;
  exposure?: number;
  onZoomChange?: (zoom: number) => void;
}


const DEFAULT_WALL_COLOR = "#e8e3dc";
const DEFAULT_FLOOR_COLOR = "#c9b89c";

// Dispose the previous BufferGeometry when a useMemo replaces it. R3F only
// auto-disposes on unmount, so a wall/floor whose geometry rebuilds during a
// drag would otherwise leak the prior ExtrudeGeometry/ShapeGeometry every
// frame. Pair every dynamic geometry useMemo in this file with this hook.
function useDisposableGeometry<T extends THREE.BufferGeometry | null>(geom: T): T {
  useEffect(() => {
    return () => {
      geom?.dispose();
    };
  }, [geom]);
  return geom;
}

// Project center onto a wall segment. Returns position along wall (t in pixels)
// and perpendicular distance. We use this to associate openings with walls.
function projectOntoWall(center: Pt, w: Wall) {
  const dx = w.p2.x - w.p1.x;
  const dy = w.p2.y - w.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { along: 0, perp: Infinity, len: 0 };
  const ux = dx / len;
  const uy = dy / len;
  const vx = center.x - w.p1.x;
  const vy = center.y - w.p1.y;
  const along = vx * ux + vy * uy;
  const perp = Math.abs(vx * -uy + vy * ux);
  return { along, perp, len };
}

function findWallForOpening(center: Pt, walls: Wall[]): { wall: Wall; along: number } | null {
  let best: { wall: Wall; along: number; score: number } | null = null;
  for (const w of walls) {
    const { along, perp, len } = projectOntoWall(center, w);
    if (along < -2 || along > len + 2) continue;
    const tol = w.thickness / 2 + 8;
    if (perp > tol) continue;
    if (!best || perp < best.score) best = { wall: w, along, score: perp };
  }
  return best ? { wall: best.wall, along: best.along } : null;
}

function buildWallGeometry(
  lengthPx: number,
  heightPx: number,
  thicknessPx: number,
  holes: Array<{ x: number; y: number; w: number; h: number; arch?: boolean }>,
) {
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(lengthPx, 0);
  shape.lineTo(lengthPx, heightPx);
  shape.lineTo(0, heightPx);
  shape.lineTo(0, 0);

  for (const h of holes) {
    const hole = new THREE.Path();
    const x0 = Math.max(0, Math.min(lengthPx, h.x));
    const x1 = Math.max(0, Math.min(lengthPx, h.x + h.w));
    const y0 = Math.max(0, Math.min(heightPx, h.y));
    const y1 = Math.max(0, Math.min(heightPx, h.y + h.h));
    if (x1 - x0 < 0.5 || y1 - y0 < 0.5) continue;
    if (h.arch) {
      // Arched opening: top is a semicircle whose radius equals half the
      // opening width. The tip of the semicircle sits exactly at y1, so the
      // arc center is (cx, y1 - R) and the straight sides run from y0 up to
      // y1 - R. Winding matches the rectangular hole (CCW).
      const wHole = x1 - x0;
      const R = Math.max(0.5, wHole / 2);
      const cx = (x0 + x1) / 2;
      const archY = Math.max(y0, y1 - R);
      hole.moveTo(x0, y0);
      hole.lineTo(x1, y0);
      hole.lineTo(x1, archY);
      hole.absarc(cx, archY, R, 0, Math.PI, false);
      hole.lineTo(x0, y0);
    } else {
      hole.moveTo(x0, y0);
      hole.lineTo(x1, y0);
      hole.lineTo(x1, y1);
      hole.lineTo(x0, y1);
      hole.lineTo(x0, y0);
    }
    shape.holes.push(hole);
  }

  const geom = new THREE.ExtrudeGeometry(shape, {
    depth: thicknessPx,
    bevelEnabled: false,
    curveSegments: 32,
  });
  // Center thickness around the wall axis
  geom.translate(0, 0, -thicknessPx / 2);
  // Duplicate uv → uv2 for AO map support.
  const uv = geom.attributes.uv;
  if (uv) geom.setAttribute("uv2", new THREE.BufferAttribute(uv.array.slice(), 2));
  return geom;
}

type EndAdjust = { front: number; back: number };
type WallAdjust = { start: EndAdjust; end: EndAdjust };

function computeWallAdjustments(walls: Wall[]): Record<string, WallAdjust> {
  const tol = 4;
  const out: Record<string, WallAdjust> = {};

  for (const A of walls) {
    const lenA = Math.hypot(A.p2.x - A.p1.x, A.p2.y - A.p1.y);
    const adj: WallAdjust = {
      start: { front: 0, back: 0 },
      end: { front: lenA, back: lenA },
    };
    if (lenA < 1e-6) {
      out[A.id] = adj;
      continue;
    }
    const wDirX = (A.p2.x - A.p1.x) / lenA;
    const wDirY = (A.p2.y - A.p1.y) / lenA;
    const tA = A.thickness;

    for (const endName of ["start", "end"] as const) {
      const Pa = endName === "start" ? A.p1 : A.p2;
      const outAx = endName === "start" ? wDirX : -wDirX;
      const outAy = endName === "start" ? wDirY : -wDirY;
      const perpAx = -outAy;
      const perpAy = outAx;

      const corners: Array<{ outBx: number; outBy: number; tB: number }> = [];
      const tjuncs: Array<{ tB: number; sinTheta: number }> = [];

      for (const B of walls) {
        if (B.id === A.id) continue;
        const d1 = Math.hypot(B.p1.x - Pa.x, B.p1.y - Pa.y);
        const d2 = Math.hypot(B.p2.x - Pa.x, B.p2.y - Pa.y);
        if (d1 < tol || d2 < tol) {
          const Bp = d1 < tol ? B.p2 : B.p1;
          const vx = Bp.x - Pa.x;
          const vy = Bp.y - Pa.y;
          const lenB = Math.hypot(vx, vy);
          if (lenB > 1e-6) {
            corners.push({ outBx: vx / lenB, outBy: vy / lenB, tB: B.thickness });
          }
        } else {
          const bdx = B.p2.x - B.p1.x;
          const bdy = B.p2.y - B.p1.y;
          const bLen = Math.hypot(bdx, bdy);
          if (bLen < 1e-6) continue;
          const bux = bdx / bLen;
          const buy = bdy / bLen;
          const t = (Pa.x - B.p1.x) * bux + (Pa.y - B.p1.y) * buy;
          if (t < tol || t > bLen - tol) continue;
          const projX = B.p1.x + t * bux;
          const projY = B.p1.y + t * buy;
          const perpD = Math.hypot(Pa.x - projX, Pa.y - projY);
          if (perpD > B.thickness / 2 + tol) continue;
          const sinTheta = Math.abs(wDirX * buy - wDirY * bux);
          tjuncs.push({ tB: B.thickness, sinTheta });
        }
      }

      if (corners.length === 1) {
        const { outBx, outBy, tB } = corners[0];
        const perpBx = -outBy;
        const perpBy = outBx;
        const cross = outAx * outBy - outAy * outBx;
        if (Math.abs(cross) < 1e-3) continue;

        for (const s of [1, -1] as const) {
          const nAx = s * perpAx;
          const nAy = s * perpAy;
          const sB = nAx * perpBx + nAy * perpBy >= 0 ? 1 : -1;
          const nBx = sB * perpBx;
          const nBy = sB * perpBy;

          const Ex = (tB / 2) * nBx - (tA / 2) * nAx;
          const Ey = (tB / 2) * nBy - (tA / 2) * nAy;
          const det = -cross;
          const u = (Ex * -outBy - Ey * -outBx) / det;
          const localX = endName === "start" ? u : lenA - u;

          if (endName === "start") {
            if (s > 0) adj.start.front = localX;
            else adj.start.back = localX;
          } else {
            if (s > 0) adj.end.back = localX;
            else adj.end.front = localX;
          }
        }
      } else if (corners.length === 0 && tjuncs.length > 0) {
        const tj = tjuncs[0];
        if (tj.sinTheta > 0.05) {
          const trim = tj.tB / 2 / tj.sinTheta;
          if (endName === "start") {
            adj.start.front = trim;
            adj.start.back = trim;
          } else {
            adj.end.front = lenA - trim;
            adj.end.back = lenA - trim;
          }
        }
      }
    }
    out[A.id] = adj;
  }
  return out;
}

interface TexturedSurfaceProps {
  material: MaterialAssignment;
  repeat: [number, number] | number[];
  offset?: [number, number] | number[];
  emissive: string;
  emissiveIntensity: number;
  hasUv2?: boolean;
  tint?: string;
}
function TexturedSurface({ material, repeat, offset, emissive, emissiveIntensity, hasUv2, tint }: TexturedSurfaceProps) {
  const fallback = material.color_url;
  const urls = [
    material.color_url || fallback,
    material.roughness_url || fallback,
    material.normal_url || fallback,
    material.ao_url || fallback,
    material.metallic_url || fallback,
  ];
  const [colorRaw, roughRaw, normRaw, aoRaw, metalRaw] = useTexture(urls);
  const colorMap = material.color_url ? colorRaw : null;
  const roughnessMap = material.roughness_url ? roughRaw : null;
  const normalMap = material.normal_url ? normRaw : null;
  const aoMap = material.ao_url && hasUv2 ? aoRaw : null;
  const metalnessMap = material.metallic_url ? metalRaw : null;

  const matRef = useRef<THREE.MeshStandardMaterial>(null);

  useLayoutEffect(() => {
    for (const t of [colorMap, roughnessMap, normalMap, aoMap, metalnessMap]) {
      if (!t) continue;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(repeat[0], repeat[1]);
      if (offset) t.offset.set(offset[0], offset[1]);
      t.anisotropy = 8;
      t.needsUpdate = true;
    }
    if (colorMap) colorMap.colorSpace = THREE.SRGBColorSpace;
    if (matRef.current) matRef.current.needsUpdate = true;
  }, [colorMap, roughnessMap, normalMap, aoMap, metalnessMap, repeat[0], repeat[1], offset?.[0], offset?.[1]]);

  return (
    <meshStandardMaterial
      ref={matRef}
      color={tint ?? "#ffffff"}
      map={colorMap ?? undefined}
      roughnessMap={roughnessMap ?? undefined}
      normalMap={normalMap ?? undefined}
      aoMap={aoMap ?? undefined}
      aoMapIntensity={aoMap ? 1 : 0}
      metalnessMap={metalnessMap ?? undefined}
      envMapIntensity={1}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
      roughness={roughnessMap ? 1 : 0.7}
      metalness={metalnessMap ? 1 : 0.05}
      side={THREE.DoubleSide}
    />
  );
}

interface FloorMeshProps {
  floor: Floor;
  color: string;
  material?: MaterialAssignment;
  tileScale: number;
  pixelsPerFoot: number;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  yOffset: number;
  tint?: string;
}
function FloorMeshImpl({ floor, color, material, tileScale, pixelsPerFoot, selected, onClick, yOffset, tint }: FloorMeshProps) {
  const geom = useDisposableGeometry(useMemo(() => {
    if (floor.polygon.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(floor.polygon[0].x, floor.polygon[0].y);
    for (let i = 1; i < floor.polygon.length; i++) {
      shape.lineTo(floor.polygon[i].x, floor.polygon[i].y);
    }
    shape.closePath();
    const g = new THREE.ShapeGeometry(shape);
    const uv = g.attributes.uv;
    if (uv) g.setAttribute("uv2", new THREE.BufferAttribute(uv.array.slice(), 2));
    return g;
  }, [floor.polygon]));

  const { repeat, offset } = useMemo(() => {
    let minX = Infinity, minY = Infinity;
    for (const p of floor.polygon) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
    }
    const tilePx = pixelsPerFoot * 4 * tileScale;
    return { repeat: [1 / tilePx, 1 / tilePx], offset: [-minX / tilePx, -minY / tilePx] };
  }, [floor.polygon, pixelsPerFoot, tileScale]);

  const [hovered, setHovered] = useState(false);
  if (!geom) return null;
  const emissive = selected ? "#ff7a18" : hovered ? "#ffb066" : "#000000";
  const emissiveIntensity = selected ? 0.25 : hovered ? 0.18 : 0;
  const fallbackColor = tint ?? color;
  const useShared = !material && !tint && !selected && !hovered && color === DEFAULT_FLOOR_COLOR;
  return (
    <mesh
      geometry={geom}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, yOffset, 0]}
      onClick={(e) => { e.stopPropagation(); onClick(e); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={() => setHovered(false)}
      receiveShadow
    >
      {material ? (
        <Suspense fallback={<meshStandardMaterial color={fallbackColor} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />}>
          <TexturedSurface material={material} repeat={repeat} offset={offset} emissive={emissive} emissiveIntensity={emissiveIntensity} hasUv2 tint={tint} />
        </Suspense>
      ) : useShared ? (
        <primitive object={SHARED_MATERIALS.floor} attach="material" />
      ) : (
        <meshStandardMaterial color={fallbackColor} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}
const FloorMesh = memo(FloorMeshImpl, (a, b) =>
  a.floor === b.floor &&
  a.color === b.color &&
  a.material === b.material &&
  a.tileScale === b.tileScale &&
  a.pixelsPerFoot === b.pixelsPerFoot &&
  a.selected === b.selected &&
  a.yOffset === b.yOffset &&
  a.tint === b.tint,
);

// THE NEW MATHEMATICAL ENGINE
// Takes a Start Point (A), an End Point (B), and a Normal, and extrudes the profile perfectly along that path.
type Vec3Tuple = [number, number, number];
interface SweepPieceProps {
  A: Vec3Tuple;
  B: Vec3Tuple;
  normal: Vec3Tuple;
  shape: THREE.Shape;
  color: string;
  emissive: string;
  emissiveIntensity: number;
  material?: MaterialAssignment;
  tint?: string;
  pixelsPerFoot?: number;
  tileScale?: number;
}
function SweepPiece({ A, B, normal, shape, color, emissive, emissiveIntensity, material, tint, pixelsPerFoot, tileScale }: SweepPieceProps) {
  const result = useMemo(() => {
    const vA = new THREE.Vector3(...A);
    const vB = new THREE.Vector3(...B);
    const vN = new THREE.Vector3(...normal).normalize();

    const length = vA.distanceTo(vB);
    if (length < 0.001) return null;

    const extrude = new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, curveSegments: 1 });

    // Build perfect coordinate frame
    const zAxis = new THREE.Vector3().subVectors(vB, vA).normalize(); // Extrude direction
    const xAxis = vN; // Thickness direction
    const yAxis = new THREE.Vector3().crossVectors(zAxis, xAxis).normalize(); // Width direction

    const matrix = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis);
    matrix.setPosition(vA);

    extrude.applyMatrix4(matrix);
    extrude.computeVertexNormals();
    const uv = extrude.attributes.uv;
    if (uv) extrude.setAttribute("uv2", new THREE.BufferAttribute(uv.array.slice(), 2));
    return { geom: extrude, length };
  }, [A, B, normal, shape]);

  const geom = useDisposableGeometry(result?.geom ?? null);
  if (!result || !geom) return null;
  const { length } = result;
  const ppf = pixelsPerFoot ?? 1;
  const ts = tileScale || 1;
  const repeatX = Math.max(0.05, length / (ppf * 4 * ts));

  return (
    <mesh geometry={geom} castShadow receiveShadow>
      {material ? (
        <Suspense fallback={<meshStandardMaterial color={tint ?? color} roughness={0.4} metalness={0} emissive={emissive} emissiveIntensity={emissiveIntensity} side={THREE.DoubleSide} />}>
          <TexturedSurface material={material} repeat={[repeatX, 1]} emissive={emissive} emissiveIntensity={emissiveIntensity} hasUv2 tint={tint} />
        </Suspense>
      ) : (
        <meshStandardMaterial color={tint ?? color} roughness={0.4} metalness={0} emissive={emissive} emissiveIntensity={emissiveIntensity} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}

interface WallAdjustment {
  start: { front: number; back: number };
  end: { front: number; back: number };
}
interface WallMeshProps {
  wall: Wall;
  ceilingPx: number;
  inchToPx: (n: number) => number;
  doors: Door[];
  windows: WindowItem[];
  color: string;
  material?: MaterialAssignment;
  tileScale: number;
  pixelsPerFoot: number;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
  adjustments: WallAdjustment;
  baseboardSelected: boolean;
  onSelectBaseboard: () => void;
  tint?: string;
  baseboardMaterial?: MaterialAssignment;
  baseboardTint?: string;
  baseboardColor?: string;
  baseboardTileScale?: number;
}
function WallMeshImpl({ wall, ceilingPx, inchToPx, doors, windows, color, material, tileScale, pixelsPerFoot, selected, onClick, adjustments, baseboardSelected, onSelectBaseboard, tint, baseboardMaterial, baseboardTint, baseboardColor, baseboardTileScale }: WallMeshProps) {
  const dx = wall.p2.x - wall.p1.x;
  const dy = wall.p2.y - wall.p1.y;
  const length = Math.hypot(dx, dy);
  const angle = Math.atan2(dy, dx);

  const geom = useDisposableGeometry(useMemo(() => {
    const holes: Array<{ x: number; y: number; w: number; h: number; arch?: boolean }> = [];
    for (const d of doors) {
      const center = { x: (d.hinge.x + d.strike.x) / 2, y: (d.hinge.y + d.strike.y) / 2 };
      const { along } = projectOntoWall(center, wall);
      const heightPx = inchToPx(d.height_in ?? 80);
      holes.push({ x: along - d.width / 2, y: 0, w: d.width, h: heightPx, arch: !!d.is_arch });
    }
    for (const win of windows) {
      const { along } = projectOntoWall(win.center, wall);
      const heightPx = inchToPx(win.height_in ?? 48);
      const sillPx = inchToPx(win.sill_height_in ?? 36);
      holes.push({ x: along - win.width / 2, y: sillPx, w: win.width, h: heightPx });
    }
    const g = buildWallGeometry(length, ceilingPx, wall.thickness, holes);
    const pos = g.attributes.position;
    const eps = 0.5;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      if (x < eps) {
        pos.setX(i, z >= 0 ? adjustments.start.front : adjustments.start.back);
      } else if (x > length - eps) {
        pos.setX(i, z >= 0 ? adjustments.end.front : adjustments.end.back);
      }
    }
    pos.needsUpdate = true;
    g.computeVertexNormals();
    return g;
  }, [length, ceilingPx, wall, doors, windows, inchToPx, adjustments]));

  const profileShape = useMemo(() => {
    const B = inchToPx(0.625);
    const H = inchToPx(5.25);
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(B, 0);
    s.lineTo(B, H); // Future curves (Colonial, ogee, etc.) go here
    s.lineTo(0, H);
    s.lineTo(0, 0);
    return s;
  }, [inchToPx]);

  const segments = useMemo(() => {
    const doorHoles = doors
      .map((d: Door) => {
        const center = { x: (d.hinge.x + d.strike.x) / 2, y: (d.hinge.y + d.strike.y) / 2 };
        const { along } = projectOntoWall(center, wall);
        return { start: along - d.width / 2, end: along + d.width / 2 };
      })
      .concat(
        windows
          .filter((w: WindowItem) => w.is_patio)
          .map((w: WindowItem) => {
            const { along } = projectOntoWall(w.center, wall);
            return { start: along - w.width / 2, end: along + w.width / 2 };
          }),
      )
      .sort((a: { start: number; end: number }, b: { start: number; end: number }) => a.start - b.start);

    const segs: Array<{ start: number; end: number; startCut: boolean; endCut: boolean }> = [];
    let cx = 0;
    let prevWasDoor = false;
    for (const d of doorHoles) {
      if (d.start > cx + 0.1) {
        segs.push({ start: cx, end: d.start, startCut: prevWasDoor, endCut: true });
      }
      cx = Math.max(cx, d.end);
      prevWasDoor = true;
    }
    if (cx < length - 0.1) {
      segs.push({ start: cx, end: length, startCut: prevWasDoor, endCut: false });
    }
    return segs;
  }, [length, doors, windows, wall]);

  // SWEEP PATHS: BASEBOARDS
  const baseboardPieces = useMemo(() => {
    const B = inchToPx(0.625);
    const T2 = wall.thickness / 2;
    const pieces: Array<{ key: string; A: Vec3Tuple; B: Vec3Tuple; normal: Vec3Tuple }> = [];

    const isExposedStart = Math.abs(adjustments.start.front) < 0.1 && Math.abs(adjustments.start.back) < 0.1;
    const isExposedEnd = Math.abs(adjustments.end.front - length) < 0.1 && Math.abs(adjustments.end.back - length) < 0.1;

    segments.forEach((seg, i) => {
      const len = seg.end - seg.start;
      if (len <= 0.01) return;

      // Front Face (Right to Left sweep)
      pieces.push({ key: `bf-${i}`, A: [seg.end, 0, T2], B: [seg.start, 0, T2], normal: [0, 0, 1] });
      // Back Face (Left to Right sweep)
      pieces.push({ key: `bb-${i}`, A: [seg.start, 0, -T2], B: [seg.end, 0, -T2], normal: [0, 0, -1] });

      // Left Door Jambs / Wall Ends (Face points Left / -X)
      if (seg.startCut || (seg.start < 0.1 && isExposedStart)) {
        // Sweep Front to Back to keep "Up" correct when extruding Left
        pieces.push({ key: `bjs-${i}`, A: [seg.start, 0, T2 + B], B: [seg.start, 0, -T2 - B], normal: [-1, 0, 0] });
      }
      // Right Door Jambs / Wall Ends (Face points Right / +X)
      if (seg.endCut || (seg.end > length - 0.1 && isExposedEnd)) {
        // Sweep Back to Front to keep "Up" correct when extruding Right
        pieces.push({ key: `bje-${i}`, A: [seg.end, 0, -T2 - B], B: [seg.end, 0, T2 + B], normal: [1, 0, 0] });
      }
    });
    return pieces;
  }, [segments, wall.thickness, inchToPx, length, adjustments]);

  // SWEEP PATHS: DOOR & WINDOW CASINGS
  // 5. CASING PIECES (Doors and Windows)
  const casingPieces = useMemo(() => {
    const B = inchToPx(0.625);
    const H = inchToPx(5.25);
    const T2 = wall.thickness / 2;
    const pieces: Array<{ key: string; A: Vec3Tuple; B: Vec3Tuple; normal: Vec3Tuple }> = [];

    // --- DOORS ---
    doors.forEach((d: Door, i: number) => {
      if (d.is_arch) return; // Arches have no door casing/jamb trim.
      const center = { x: (d.hinge.x + d.strike.x) / 2, y: (d.hinge.y + d.strike.y) / 2 };
      const { along } = projectOntoWall(center, wall);
      const width = d.width;
      const left = along - width / 2;
      const right = along + width / 2;
      const height = inchToPx(d.height_in ?? 80);

      // FRONT CASING (Hugs the front face at +T2)
      pieces.push({ key: `dfr-${i}`, A: [right, H, T2], B: [right, height, T2], normal: [0, 0, 1] }); // Right Leg
      pieces.push({ key: `dfl-${i}`, A: [left, height, T2], B: [left, H, T2], normal: [0, 0, 1] }); // Left Leg
      pieces.push({ key: `dfh-${i}`, A: [right + H, height, T2], B: [left - H, height, T2], normal: [0, 0, 1] }); // Header

      // BACK CASING (flush on the back face at -T2; legs sweep reversed so profile width points outward, not into the opening)
      pieces.push({ key: `dbr-${i}`, A: [right, height, -T2], B: [right, H, -T2], normal: [0, 0, -1] }); // Right Leg
      pieces.push({ key: `dbl-${i}`, A: [left, H, -T2], B: [left, height, -T2], normal: [0, 0, -1] }); // Left Leg
      pieces.push({ key: `dbh-${i}`, A: [left - H, height, -T2], B: [right + H, height, -T2], normal: [0, 0, -1] }); // Header
    });

    // --- WINDOWS ---
    windows.forEach((win: WindowItem, i: number) => {
      const { along } = projectOntoWall(win.center, wall);
      const width = win.width;
      const left = along - width / 2;
      const right = along + width / 2;

      if (win.is_patio) {
        // Patio door — floor anchored, no sill, just legs + header on both faces.
        const height = inchToPx(win.height_in ?? 80);
        pieces.push({ key: `wfr-${i}`, A: [right, H, T2], B: [right, height, T2], normal: [0, 0, 1] });
        pieces.push({ key: `wfl-${i}`, A: [left, height, T2], B: [left, H, T2], normal: [0, 0, 1] });
        pieces.push({ key: `wfh-${i}`, A: [right + H, height, T2], B: [left - H, height, T2], normal: [0, 0, 1] });
        pieces.push({ key: `wbr-${i}`, A: [right, height, -T2], B: [right, H, -T2], normal: [0, 0, -1] });
        pieces.push({ key: `wbl-${i}`, A: [left, H, -T2], B: [left, height, -T2], normal: [0, 0, -1] });
        pieces.push({ key: `wbh-${i}`, A: [left - H, height, -T2], B: [right + H, height, -T2], normal: [0, 0, -1] });
        return;
      }

      const height = inchToPx(win.height_in ?? 48);
      const bottom = inchToPx(win.sill_height_in ?? 36);
      const top = bottom + height;

      // FRONT CASING (Hugs the front face at +T2)
      pieces.push({ key: `wfr-${i}`, A: [right, bottom, T2], B: [right, top, T2], normal: [0, 0, 1] }); // Right Leg
      pieces.push({ key: `wfl-${i}`, A: [left, top, T2], B: [left, bottom, T2], normal: [0, 0, 1] }); // Left Leg
      pieces.push({ key: `wfh-${i}`, A: [right + H, top, T2], B: [left - H, top, T2], normal: [0, 0, 1] }); // Header
      pieces.push({ key: `wfb-${i}`, A: [left - H, bottom, T2], B: [right + H, bottom, T2], normal: [0, 0, 1] }); // Sill

      // BACK CASING (flush on the back face at -T2; legs sweep reversed so profile width points outward, not into the opening)
      pieces.push({ key: `wbr-${i}`, A: [right, top, -T2], B: [right, bottom, -T2], normal: [0, 0, -1] }); // Right Leg
      pieces.push({ key: `wbl-${i}`, A: [left, bottom, -T2], B: [left, top, -T2], normal: [0, 0, -1] }); // Left Leg
      pieces.push({ key: `wbh-${i}`, A: [left - H, top, -T2], B: [right + H, top, -T2], normal: [0, 0, -1] }); // Header
      pieces.push({ key: `wbb-${i}`, A: [right + H, bottom, -T2], B: [left - H, bottom, -T2], normal: [0, 0, -1] }); // Sill
    });

    return pieces;
  }, [doors, windows, wall, inchToPx]);

  const [hovered, setHovered] = useState(false);
  const [bbHovered, setBbHovered] = useState(false);
  const emissive = selected ? "#ff7a18" : hovered ? "#ffb066" : "#000000";
  const emissiveIntensity = selected ? 0.3 : hovered ? 0.2 : 0;
  const bbEmissive = baseboardSelected ? "#ff7a18" : bbHovered ? "#ffb066" : "#000000";
  const bbEmissiveIntensity = baseboardSelected ? 0.3 : bbHovered ? 0.2 : 0;

  return (
    <group position={[wall.p1.x, 0, wall.p1.y]} rotation={[0, -angle, 0]}>
      <mesh
        geometry={geom}
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
        castShadow
        receiveShadow
      >
        {material ? (
          <Suspense fallback={<meshStandardMaterial color={tint ?? color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} metalness={0.05} />}>
            <TexturedSurface material={material} repeat={[Math.max(0.05, length / (pixelsPerFoot * 4 * tileScale)), Math.max(0.05, ceilingPx / (pixelsPerFoot * 4 * tileScale))]} emissive={emissive} emissiveIntensity={emissiveIntensity} hasUv2 tint={tint} />
          </Suspense>
        ) : !tint && !selected && !hovered && color === DEFAULT_WALL_COLOR ? (
          <primitive object={SHARED_MATERIALS.wall} attach="material" />
        ) : (
          <meshStandardMaterial color={tint ?? color} emissive={emissive} emissiveIntensity={emissiveIntensity} roughness={0.85} metalness={0.05} />
        )}
      </mesh>

      {/* ALL TRIMS & BASEBOARDS (Mapped natively using SweepPiece) */}
      {(baseboardPieces.length > 0 || casingPieces.length > 0) && (
        <group
          onClick={(e) => { e.stopPropagation(); onSelectBaseboard(); }}
          onPointerOver={(e) => { e.stopPropagation(); setBbHovered(true); }}
          onPointerOut={() => setBbHovered(false)}
        >
          {baseboardPieces.map((p) => (
            <SweepPiece key={p.key} A={p.A} B={p.B} normal={p.normal} shape={profileShape} color={baseboardColor ?? "#f4f4f0"} emissive={bbEmissive} emissiveIntensity={bbEmissiveIntensity} material={baseboardMaterial} tint={baseboardTint} pixelsPerFoot={pixelsPerFoot} tileScale={baseboardTileScale ?? 1} />
          ))}
          {casingPieces.map((p) => (
            <SweepPiece key={p.key} A={p.A} B={p.B} normal={p.normal} shape={profileShape} color={baseboardColor ?? "#f4f4f0"} emissive={bbEmissive} emissiveIntensity={bbEmissiveIntensity} material={baseboardMaterial} tint={baseboardTint} pixelsPerFoot={pixelsPerFoot} tileScale={baseboardTileScale ?? 1} />
          ))}
        </group>
      )}
    </group>
  );
}
const WallMesh = memo(WallMeshImpl, (a, b) =>
  a.wall === b.wall &&
  a.ceilingPx === b.ceilingPx &&
  a.doors === b.doors &&
  a.windows === b.windows &&
  a.color === b.color &&
  a.material === b.material &&
  a.tileScale === b.tileScale &&
  a.pixelsPerFoot === b.pixelsPerFoot &&
  a.selected === b.selected &&
  a.adjustments === b.adjustments &&
  a.baseboardSelected === b.baseboardSelected &&
  a.tint === b.tint &&
  a.baseboardMaterial === b.baseboardMaterial &&
  a.baseboardTint === b.baseboardTint &&
  a.baseboardColor === b.baseboardColor &&
  a.baseboardTileScale === b.baseboardTileScale,
);

interface OpeningPlaceholderProps {
  position: Vec3Tuple;
  rotationY: number;
  width: number;
  height: number;
  thickness: number;
  yOffset: number;
  color: string;
  selected: boolean;
  onClick: (e: ThreeEvent<MouseEvent>) => void;
}
function OpeningPlaceholderImpl({ position, rotationY, width, height, thickness, yOffset, color, selected, onClick }: OpeningPlaceholderProps) {
  const [hovered, setHovered] = useState(false);
  const emissive = selected ? "#ff7a18" : hovered ? "#ffb066" : "#000000";
  const emissiveIntensity = selected ? 0.4 : hovered ? 0.25 : 0;
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh
        position={[0, yOffset + height / 2, 0]}
        onClick={(e) => { e.stopPropagation(); onClick(e); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      >
        <boxGeometry args={[width, height, thickness * 0.6]} />
        <meshStandardMaterial color={color} transparent opacity={0.55} emissive={emissive} emissiveIntensity={emissiveIntensity} />
      </mesh>
    </group>
  );
}
const OpeningPlaceholder = memo(OpeningPlaceholderImpl, (a, b) =>
  a.position[0] === b.position[0] && a.position[1] === b.position[1] && a.position[2] === b.position[2] &&
  a.rotationY === b.rotationY &&
  a.width === b.width && a.height === b.height && a.thickness === b.thickness &&
  a.yOffset === b.yOffset && a.color === b.color && a.selected === b.selected,
);

function CeilingMeshImpl({ polygon, yPx }: { polygon: Pt[]; yPx: number }) {
  const geom = useDisposableGeometry(useMemo(() => {
    if (!polygon || polygon.length < 3) return null;
    const shape = new THREE.Shape();
    shape.moveTo(polygon[0].x, polygon[0].y);
    for (let i = 1; i < polygon.length; i++) shape.lineTo(polygon[i].x, polygon[i].y);
    shape.closePath();
    return new THREE.ShapeGeometry(shape);
  }, [polygon]));
  if (!geom) return null;
  return (
    <mesh
      geometry={geom}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, yPx, 0]}
      castShadow
      receiveShadow
      raycast={() => null}
    >
      <primitive object={SHARED_MATERIALS.ceiling} attach="material" />
    </mesh>
  );
}
const CeilingMesh = memo(CeilingMeshImpl, (a, b) => a.polygon === b.polygon && a.yPx === b.yPx);

type SceneContentsProps = {
  floors: Floor[];
  walls: Wall[];
  doors: Door[];
  windows: WindowItem[];
  furniture?: FurnitureItem[];
  furnitureAssets?: AssetModel[];
  ceilingHeightIn: number;
  pixelsPerFoot: number;
  visualMetadata: VisualMetadata;
  selection: Selection3D;
  onSelect: (s: Selection3D) => void;
};
function SceneContents({ floors, walls, doors, windows, furniture, furnitureAssets, ceilingHeightIn, pixelsPerFoot, visualMetadata, selection, onSelect }: SceneContentsProps) {
  const inchToPx = (n: number) => (n / 12) * pixelsPerFoot;
  const ceilingPx = inchToPx(ceilingHeightIn);

  const wallAdjustments = useMemo(() => computeWallAdjustments(walls), [walls]);

  const openingsByWall = useMemo(() => {
    const map: Record<string, { doors: Door[]; windows: WindowItem[] }> = {};
    for (const w of walls) map[w.id] = { doors: [], windows: [] };
    for (const d of doors) {
      const c = { x: (d.hinge.x + d.strike.x) / 2, y: (d.hinge.y + d.strike.y) / 2 };
      const m = findWallForOpening(c, walls);
      if (m && map[m.wall.id]) map[m.wall.id].doors.push(d);
    }
    for (const win of windows) {
      const m = findWallForOpening(win.center, walls);
      if (m && map[m.wall.id]) map[m.wall.id].windows.push(win);
    }
    return map;
  }, [walls, doors, windows]);

  return (
    <Bvh firstHitOnly>
      {floors.map((f: Floor, i: number) => (
        <FloorMesh key={f.id} floor={f} color={visualMetadata[f.id]?.color ?? DEFAULT_FLOOR_COLOR} material={visualMetadata[f.id]?.material} tileScale={visualMetadata[f.id]?.tile_scale ?? 1} pixelsPerFoot={pixelsPerFoot} selected={selection?.kind === "floor" && selection.id === f.id} onClick={() => onSelect({ kind: "floor", id: f.id })} yOffset={i === 0 ? -0.5 : 0} tint={visualMetadata[f.id]?.tint} />
      ))}
      {floors.map((f: Floor) => (
        <CeilingMesh key={`ceil_${f.id}`} polygon={f.polygon} yPx={ceilingPx} />
      ))}
      {walls.map((w: Wall) => {
        const grouped = openingsByWall[w.id] ?? { doors: [], windows: [] };
        return (
          <WallMesh key={w.id} wall={w} ceilingPx={ceilingPx} inchToPx={inchToPx} doors={grouped.doors} windows={grouped.windows} color={visualMetadata[w.id]?.color ?? DEFAULT_WALL_COLOR} material={visualMetadata[w.id]?.material} tileScale={visualMetadata[w.id]?.tile_scale ?? 1} pixelsPerFoot={pixelsPerFoot} selected={selection?.kind === "wall" && selection.id === w.id} onClick={() => onSelect({ kind: "wall", id: w.id })} adjustments={wallAdjustments[w.id] ?? { start: { front: 0, back: 0 }, end: { front: Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y), back: Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y) } }} baseboardSelected={selection?.kind === "baseboard" && selection.id === w.id} onSelectBaseboard={() => onSelect({ kind: "baseboard", id: w.id })} tint={visualMetadata[w.id]?.tint} baseboardMaterial={visualMetadata[`baseboard_${w.id}`]?.material} baseboardTint={visualMetadata[`baseboard_${w.id}`]?.tint} baseboardColor={visualMetadata[`baseboard_${w.id}`]?.color} baseboardTileScale={visualMetadata[`baseboard_${w.id}`]?.tile_scale ?? 1} />
        );
      })}
      {doors.map((d: Door) => {
        if (d.is_arch) return null;
        const doorForModel: Door = d.is_double
          ? { ...d, hinge: { x: (d.hinge.x + d.strike.x) / 2, y: (d.hinge.y + d.strike.y) / 2 } }
          : d;
        if (d.model_url) {
          return (
            <Suspense key={d.id} fallback={null}>
              <DoorInstance door={doorForModel} url={d.model_url} inchToPx={inchToPx} selected={selection?.kind === "door" && selection.id === d.id} onClick={() => onSelect({ kind: "door", id: d.id })} tint={visualMetadata[d.id]?.tint} />
            </Suspense>
          );
        }
        const c = { x: (d.hinge.x + d.strike.x) / 2, y: (d.hinge.y + d.strike.y) / 2 };
        const m = findWallForOpening(c, walls);
        if (!m) return null;
        const w = m.wall;
        const angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
        const heightPx = inchToPx(d.height_in ?? 80);
        return (
          <OpeningPlaceholder key={d.id} position={[c.x, 0, c.y]} rotationY={-angle} width={d.width} height={heightPx} thickness={w.thickness} yOffset={0} color="#8b5a2b" selected={selection?.kind === "door" && selection.id === d.id} onClick={() => onSelect({ kind: "door", id: d.id })} />
        );
      })}
      {windows.map((win: WindowItem) => {
        if (win.model_url) {
          return (
            <Suspense key={win.id} fallback={null}>
              <WindowInstance win={win} walls={walls} url={win.model_url} ceilingPx={ceilingPx} inchToPx={inchToPx} selected={selection?.kind === "window" && selection.id === win.id} onClick={() => onSelect({ kind: "window", id: win.id })} tint={visualMetadata[win.id]?.tint} />
            </Suspense>
          );
        }
        const m = findWallForOpening(win.center, walls);
        if (!m) return null;
        const w = m.wall;
        const angle = Math.atan2(w.p2.y - w.p1.y, w.p2.x - w.p1.x);
        const heightPx = inchToPx(win.height_in ?? 48);
        const sillPx = inchToPx(win.sill_height_in ?? 36);
        return (
          <OpeningPlaceholder key={win.id} position={[win.center.x, 0, win.center.y]} rotationY={-angle} width={win.width} height={heightPx} thickness={w.thickness} yOffset={sillPx} color="#7fb3d9" selected={selection?.kind === "window" && selection.id === win.id} onClick={() => onSelect({ kind: "window", id: win.id })} />
        );
      })}
      {furniture && furniture.length > 0 && (
        <Furniture3D
          items={furniture}
          assets={furnitureAssets ?? []}
          selection={selection}
          onSelect={onSelect}
        />
      )}
    </Bvh>
  );
}


function CameraRig({ pixelsPerFoot }: { pixelsPerFoot: number }) {
  const dist = pixelsPerFoot * 30;
  const far = Math.max(pixelsPerFoot * 500, 5000);
  return <PerspectiveCamera makeDefault fov={45} position={[dist, dist, dist]} near={Math.max(pixelsPerFoot * 0.5, 1)} far={far} />;
}

export default function FloorPlan3D({ floorsData, visibleFloor, furnitureAssets, pixelsPerFoot, visualMetadata, selection, onSelect, ambientIntensity, directionalIntensity, windowIntensity = 4, roomLightIntensity = 0.2, nightMode = false, sunAzimuthDeg = 135, sunElevationDeg = 55, sunWarmth = 0.25, exposure = 1.0, onZoomChange }: Props) {
  const allModelUrls = useMemo(() => {
    const urls: (string | undefined)[] = [];
    for (const fd of floorsData) {
      for (const d of fd.doors) urls.push(d.model_url);
      for (const w of fd.windows) urls.push(w.model_url);
      for (const f of fd.furniture ?? []) urls.push(f.model_url);
    }
    return urls;
  }, [floorsData]);
  useModelPreload(allModelUrls);

  const initialDist = pixelsPerFoot * 30 * Math.sqrt(3);
  const controlsRef = useRef<any>(null);

  const inchToPx = (n: number) => (n / 12) * pixelsPerFoot;
  const INTER_FLOOR_GAP_IN = 1;

  // Per-floor stacked Y offsets in world units (px).
  const stackY = useMemo(() => {
    const arr: number[] = [];
    let y = 0;
    for (let i = 0; i < floorsData.length; i++) {
      arr.push(y);
      y += inchToPx(floorsData[i].ceilingHeightIn + INTER_FLOOR_GAP_IN);
    }
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorsData, pixelsPerFoot]);

  // Shared XY scene center across all floors (so alignment holds).
  const sceneCenter = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const fd of floorsData) {
      for (const f of fd.floors) for (const p of f.polygon) {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
      for (const w of fd.walls) for (const p of [w.p1, w.p2]) {
        if (p.x < minX) minX = p.x; if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x; if (p.y > maxY) maxY = p.y;
      }
    }
    if (!isFinite(minX)) return { x: 0, y: 0 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2 };
  }, [floorsData]);

  // Aggregate arrays for LightingSystem so the sun bounds and window
  // portals cover the whole stack.
  const lightingInputs = useMemo(() => {
    const floors: Floor[] = [];
    const walls: Wall[] = [];
    const windows: WindowItem[] = [];
    let maxCeilingIn = 0;
    for (const fd of floorsData) {
      floors.push(...fd.floors);
      walls.push(...fd.walls);
      windows.push(...fd.windows);
      if (fd.ceilingHeightIn > maxCeilingIn) maxCeilingIn = fd.ceilingHeightIn;
    }
    return { floors, walls, windows, ceilingPx: inchToPx(maxCeilingIn || 108) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorsData, pixelsPerFoot]);

  return (
    <Canvas
      frameloop="demand"
      shadows={{ type: THREE.PCFSoftShadowMap }}
      onPointerMissed={() => onSelect(null)}
      onContextMenu={(e) => e.preventDefault()}
      dpr={[1, 2]}
      gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: exposure }}
      style={{ width: "100%", height: "100%" }}
    >
      <CameraRig pixelsPerFoot={pixelsPerFoot} />
      <InvalidateOnChange deps={[floorsData, visibleFloor, visualMetadata, selection, pixelsPerFoot, ambientIntensity, directionalIntensity, windowIntensity, roomLightIntensity, nightMode, sunAzimuthDeg, sunElevationDeg, sunWarmth, exposure]} />
      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        maxPolarAngle={Math.PI / 2 - 0.05}
        mouseButtons={{ LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: undefined as unknown as THREE.MOUSE }}
        onChange={() => {
          if (onZoomChange && controlsRef.current) {
            const d = controlsRef.current.getDistance();
            if (d > 0) onZoomChange(initialDist / d);
          }
        }}
      />
      <group position={[-sceneCenter.x, 0, -sceneCenter.y]}>
        <LightingSystem
          floors={lightingInputs.floors}
          walls={lightingInputs.walls}
          windows={lightingInputs.windows}
          ceilingPx={lightingInputs.ceilingPx}
          pixelsPerFoot={pixelsPerFoot}
          sunIntensity={directionalIntensity}
          ambientIntensity={ambientIntensity}
          windowIntensity={windowIntensity}
          roomLightIntensity={0}
          nightMode={nightMode}
          sunAzimuthDeg={sunAzimuthDeg}
          sunElevationDeg={sunElevationDeg}
          sunWarmth={sunWarmth}
        />
        <Suspense fallback={null}>
          {floorsData.map((fd, i) => {
            const floorIdx = (i + 1) as 1 | 2;
            const isVisible = visibleFloor === "ALL" || visibleFloor === floorIdx;
            if (!isVisible) return null;
            const ceilPx = inchToPx(fd.ceilingHeightIn);
            const roomScale = ceilPx * ceilPx * 0.25;
            const roomEffective = nightMode
              ? Math.max(roomLightIntensity, 0.6) * roomScale * 1.5
              : roomLightIntensity * roomScale;
            const roomColor = nightMode ? "#ffd9a8" : "#ffffff";
            return (
              // Hidden floors are fully unmounted so their meshes can't
              // intercept raycasts on the visible floor beneath them.
              <group key={`floor_${i}`} position={[0, stackY[i], 0]}>
                {/* Per-floor ceiling fixture lights (one per room, skipping the building footprint at index 0) */}
                {fd.floors.slice(1).map((room) => {
                  let sx = 0, sy = 0;
                  for (const p of room.polygon) { sx += p.x; sy += p.y; }
                  const cx = sx / Math.max(1, room.polygon.length);
                  const cy = sy / Math.max(1, room.polygon.length);
                  return (
                    <pointLight
                      key={`lamp_${room.id}`}
                      position={[cx, ceilPx - 4, cy]}
                      intensity={roomEffective}
                      color={roomColor}
                      distance={ceilPx * 6}
                      decay={2}
                    />
                  );
                })}
                <SceneContents
                  floors={fd.floors}
                  walls={fd.walls}
                  doors={fd.doors}
                  windows={fd.windows}
                  furniture={fd.furniture}
                  furnitureAssets={furnitureAssets}
                  ceilingHeightIn={fd.ceilingHeightIn}
                  pixelsPerFoot={pixelsPerFoot}
                  visualMetadata={visualMetadata}
                  selection={selection}
                  onSelect={onSelect}
                />
              </group>
            );
          })}
        </Suspense>
      </group>
      <Suspense fallback={null}>
        <Environment files="/environments/noon_grass_1k.hdr" background environmentIntensity={0.3} />
      </Suspense>
      <EffectComposer multisampling={4} enableNormalPass>
        <N8AO aoRadius={pixelsPerFoot * 1} intensity={1.5} distanceFalloff={3} quality="low" />
      </EffectComposer>
    </Canvas>
  );
}


// Triggers an explicit invalidate() when any scene-relevant prop changes,
// so the demand-mode render loop renders exactly one frame per real update.
function InvalidateOnChange({ deps }: { deps: unknown[] }) {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return null;
}
