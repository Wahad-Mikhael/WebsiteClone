import { memo, useMemo, useRef, useLayoutEffect, useCallback, Suspense, useEffect } from "react";
import { Canvas, useThree, type ThreeEvent } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera, Environment, useTexture, Bvh, Grid } from "@react-three/drei";
import { EffectComposer, N8AO } from "@react-three/postprocessing";
import * as THREE from "three";
import LightingSystem from "./LightingSystem";
import { DoorInstance, WindowInstance, useModelPreload } from "./ModelSystem";
import { Furniture3D } from "./Furniture3D";
import type { AssetModel } from "@/lib/assets";
import { SHARED_MATERIALS, SHARED_HOVER_MATERIALS, SHARED_STAIR_STRINGER_MATERIAL } from "@/lib/sharedMaterials";
import { getStairInitialRunAngle, getStairTurnSign, getStairLegLengthsPx, getStairOpenEndMids, type StairLike } from "@/lib/stairLogic";

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
  flipLR?: boolean;
};
export type Selection3D =
  | { kind: "wall"; id: string }
  | { kind: "floor"; id: string }
  | { kind: "door"; id: string }
  | { kind: "window"; id: string }
  | { kind: "baseboard"; id: string }
  | { kind: "furniture"; id: string }
  | { kind: "stairs"; id: string }
  | null;

export type StairsStructure3D = {
  id: string;
  kind: "stairs";
  polygon: Pt[];
  shape?: "straight" | "L" | "U";
  width_in?: number;
  rotation_rad?: number;
  rotation_anchor?: Pt;
  direction?: "UP" | "DN";
  start?: Pt;
  end?: Pt;
  linked_stair_id?: string;
  spans_to_floor?: 2;
  tread_count?: number;
};
export type Structure3D = StairsStructure3D | { id: string; kind: "railing"; [k: string]: unknown };

export interface FloorData {
  floors: Floor[];
  walls: Wall[];
  doors: Door[];
  windows: WindowItem[];
  furniture?: FurnitureItem[];
  structures?: Structure3D[];
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
  /** Bump this number to snap the camera to a top-down plan view. */
  topDownNonce?: number;
}


const DEFAULT_WALL_COLOR = "#e8e3dc";
const DEFAULT_FLOOR_COLOR = "rgb(201, 156, 156)";
// Stable module-level raycast references. r3f applies props by assignment;
// passing `undefined` after `() => null` leaves `mesh.raycast = undefined`,
// silently disabling intersections. Passing a real function reference both
// times restores hit-testing when a hidden floor is shown again.
const DEFAULT_MESH_RAYCAST = THREE.Mesh.prototype.raycast;
const NULL_RAYCAST = () => null;

// Sky gradient background: white near the horizon fading to blue at zenith.
// Rendered as a large inverted sphere with a simple vertex-lerp shader so it
// stays cheap and never intersects scene geometry.
function SkyBackground() {
  const material = useMemo(() => {
    return new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color("#7fb2ff") },
        horizonColor: { value: new THREE.Color("#ffffff") },
        exponent: { value: 0.75 },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        varying vec3 vWorldPos;
        uniform vec3 topColor;
        uniform vec3 horizonColor;
        uniform float exponent;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = pow(max(h, 0.0), exponent);
          gl_FragColor = vec4(mix(horizonColor, topColor, t), 1.0);
        }
      `,
    });
  }, []);
  useEffect(() => () => material.dispose(), [material]);
  return (
    <mesh scale={[5000, 5000, 5000]} raycast={NULL_RAYCAST} frustumCulled={false}>
      <sphereGeometry args={[1, 32, 16]} />
      <primitive object={material} attach="material" />
    </mesh>
  );
}

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
  isInteractive: boolean;
}
function FloorMeshImpl({ floor, color, material, tileScale, pixelsPerFoot, selected, onClick, yOffset, tint, isInteractive }: FloorMeshProps) {
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

  // Hover uses direct three.js mutation only — no React state, no memo
  // invalidation. When the mesh is rendering the shared floor material, we
  // swap `mesh.material` to the pre-cloned SHARED_HOVER_MATERIALS.floor so
  // sibling floors that also point at SHARED_MATERIALS.floor stay unlit.
  // When the mesh has its own per-instance material (tint/textured/fallback),
  // we mutate that material's emissive directly.
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const invalidate = useThree((s) => s.invalidate);
  const onOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (selected) return;
    const m = meshRef.current;
    if (!m) return;
    if (m.material === SHARED_MATERIALS.floor) {
      m.material = SHARED_HOVER_MATERIALS.floor;
    } else {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0xffb066);
        mat.emissiveIntensity = 0.18;
      }
    }
    invalidate();
  }, [selected, invalidate]);
  const onOut = useCallback(() => {
    if (selected) return;
    const m = meshRef.current;
    if (!m) return;
    if (m.material === SHARED_HOVER_MATERIALS.floor) {
      m.material = SHARED_MATERIALS.floor;
    } else {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
    invalidate();
  }, [selected, invalidate]);


  if (!geom) return null;
  const selEmissive = selected ? "#ff7a18" : "#000000";
  const selEmissiveIntensity = selected ? 0.25 : 0;
  const fallbackColor = tint ?? color;
  const useShared = !material && !tint && !selected && color === DEFAULT_FLOOR_COLOR;
  return (
    <mesh
      ref={meshRef}
      geometry={geom}
      rotation={[Math.PI / 2, 0, 0]}
      position={[0, yOffset, 0]}
      onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
      onPointerOver={isInteractive ? onOver : undefined}
      onPointerOut={isInteractive ? onOut : undefined}
      raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
      receiveShadow
    >
      {material ? (
        <Suspense fallback={<meshStandardMaterial ref={matRef} color={fallbackColor} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />}>
          <TexturedSurface material={material} repeat={repeat} offset={offset} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} hasUv2 tint={tint} />
        </Suspense>
      ) : useShared ? (
        <primitive object={SHARED_MATERIALS.floor} attach="material" />
      ) : (
        <meshStandardMaterial ref={matRef} color={fallbackColor} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} roughness={0.7} metalness={0.05} side={THREE.DoubleSide} />
      )}
    </mesh>
  );
}
const FloorMesh = memo(FloorMeshImpl, (a, b) => {
  if (a.color !== b.color) return false;
  if (a.material !== b.material) return false;
  if (a.tileScale !== b.tileScale) return false;
  if (a.pixelsPerFoot !== b.pixelsPerFoot) return false;
  if (a.selected !== b.selected) return false;
  if (a.yOffset !== b.yOffset) return false;
  if (a.tint !== b.tint) return false;
  if (a.isInteractive !== b.isInteractive) return false;
  if (a.floor === b.floor) return true;
  if (a.floor.id !== b.floor.id) return false;
  const pa = a.floor.polygon, pb = b.floor.polygon;
  if (pa.length !== pb.length) return false;
  if (pa.length > 0) {
    const f = pa[0], g = pb[0];
    const l = pa[pa.length - 1], m = pb[pb.length - 1];
    if (f.x !== g.x || f.y !== g.y) return false;
    if (l.x !== m.x || l.y !== m.y) return false;
  }
  return true;
});

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
function SweepPieceImpl({ A, B, normal, shape, color, emissive, emissiveIntensity, material, tint, pixelsPerFoot, tileScale }: SweepPieceProps) {
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
    // A/B/normal are compared elementwise below; using .join() to key deps.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [A[0], A[1], A[2], B[0], B[1], B[2], normal[0], normal[1], normal[2], shape]);

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
const SweepPiece = memo(SweepPieceImpl, (a, b) =>
  a.shape === b.shape &&
  a.color === b.color &&
  a.emissive === b.emissive &&
  a.emissiveIntensity === b.emissiveIntensity &&
  a.material === b.material &&
  a.tint === b.tint &&
  a.pixelsPerFoot === b.pixelsPerFoot &&
  a.tileScale === b.tileScale &&
  a.A[0] === b.A[0] && a.A[1] === b.A[1] && a.A[2] === b.A[2] &&
  a.B[0] === b.B[0] && a.B[1] === b.B[1] && a.B[2] === b.B[2] &&
  a.normal[0] === b.normal[0] && a.normal[1] === b.normal[1] && a.normal[2] === b.normal[2],
);

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
  isInteractive: boolean;
}
function WallMeshImpl({ wall, ceilingPx, inchToPx, doors, windows, color, material, tileScale, pixelsPerFoot, selected, onClick, adjustments, baseboardSelected, onSelectBaseboard, tint, baseboardMaterial, baseboardTint, baseboardColor, baseboardTileScale, isInteractive }: WallMeshProps) {
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

  // Hover swaps mesh.material to the shared hover reference when this wall is
  // untinted/untextured (so sibling walls sharing SHARED_MATERIALS.wall stay
  // unaffected), otherwise mutates its per-instance material emissive.
  const wallMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const wallMeshRef = useRef<THREE.Mesh>(null);

  const invalidate = useThree((s) => s.invalidate);
  const selEmissive = selected ? "#ff7a18" : "#000000";
  const selEmissiveIntensity = selected ? 0.3 : 0;
  const bbSelEmissive = baseboardSelected ? "#ff7a18" : "#000000";
  const bbSelEmissiveIntensity = baseboardSelected ? 0.3 : 0;

  const onWallOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (selected) return;
    const m = wallMeshRef.current;
    if (!m) return;
    if (m.material === SHARED_MATERIALS.wall) {
      m.material = SHARED_HOVER_MATERIALS.wall;
    } else {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0xffb066);
        mat.emissiveIntensity = 0.2;
      }
    }
    invalidate();
  }, [selected, invalidate]);
  const onWallOut = useCallback(() => {
    if (selected) return;
    const m = wallMeshRef.current;
    if (!m) return;
    if (m.material === SHARED_HOVER_MATERIALS.wall) {
      m.material = SHARED_MATERIALS.wall;
    } else {
      const mat = m.material as THREE.MeshStandardMaterial;
      if (mat && mat.emissive) {
        mat.emissive.setHex(0x000000);
        mat.emissiveIntensity = 0;
      }
    }
    invalidate();
  }, [selected, invalidate]);


  return (
    <group position={[wall.p1.x, 0, wall.p1.y]} rotation={[0, -angle, 0]}>
      <mesh
        ref={wallMeshRef}
        geometry={geom}
        onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
        onPointerOver={isInteractive ? onWallOver : undefined}
        onPointerOut={isInteractive ? onWallOut : undefined}
        raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
        castShadow
        receiveShadow
      >
        {material ? (
          <Suspense fallback={<meshStandardMaterial ref={wallMatRef} color={tint ?? color} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} roughness={0.85} metalness={0.05} />}>
            <TexturedSurface material={material} repeat={[Math.max(0.05, length / (pixelsPerFoot * 4 * tileScale)), Math.max(0.05, ceilingPx / (pixelsPerFoot * 4 * tileScale))]} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} hasUv2 tint={tint} />
          </Suspense>
        ) : !tint && !selected && color === DEFAULT_WALL_COLOR ? (
          <primitive object={SHARED_MATERIALS.wall} attach="material" />
        ) : (
          <meshStandardMaterial ref={wallMatRef} color={tint ?? color} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} roughness={0.85} metalness={0.05} />
        )}
      </mesh>


      {/* ALL TRIMS & BASEBOARDS (Mapped natively using SweepPiece). Sweep
          pieces disable their own raycast, so hover on the group is driven
          entirely by the parent wall's raycast target — the pointer events
          bubble through the group wrapper's onClick for selection. */}
      {(baseboardPieces.length > 0 || casingPieces.length > 0) && (
        <group
          onClick={isInteractive ? (e) => { e.stopPropagation(); onSelectBaseboard(); } : undefined}
        >
          {baseboardPieces.map((p) => (
            <SweepPiece key={p.key} A={p.A} B={p.B} normal={p.normal} shape={profileShape} color={baseboardColor ?? "#f4f4f0"} emissive={bbSelEmissive} emissiveIntensity={bbSelEmissiveIntensity} material={baseboardMaterial} tint={baseboardTint} pixelsPerFoot={pixelsPerFoot} tileScale={baseboardTileScale ?? 1} />
          ))}
          {casingPieces.map((p) => (
            <SweepPiece key={p.key} A={p.A} B={p.B} normal={p.normal} shape={profileShape} color={baseboardColor ?? "#f4f4f0"} emissive={bbSelEmissive} emissiveIntensity={bbSelEmissiveIntensity} material={baseboardMaterial} tint={baseboardTint} pixelsPerFoot={pixelsPerFoot} tileScale={baseboardTileScale ?? 1} />
          ))}
        </group>
      )}
    </group>
  );
}

// Compare two door arrays by the primitives that actually affect the wall
// geometry (holes) + door-casing sweep paths. Prevents reference churn (from
// per-render array construction upstream) from tripping the memo.
function sameDoorList(a: Door[], b: Door[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.id !== y.id) return false;
    if (x.width !== y.width) return false;
    if ((x.height_in ?? 80) !== (y.height_in ?? 80)) return false;
    if (!!x.is_arch !== !!y.is_arch) return false;
    if (x.hinge.x !== y.hinge.x || x.hinge.y !== y.hinge.y) return false;
    if (x.strike.x !== y.strike.x || x.strike.y !== y.strike.y) return false;
  }
  return true;
}
function sameWindowList(a: WindowItem[], b: WindowItem[]): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i], y = b[i];
    if (x.id !== y.id) return false;
    if (x.width !== y.width) return false;
    if ((x.height_in ?? 48) !== (y.height_in ?? 48)) return false;
    if ((x.sill_height_in ?? 36) !== (y.sill_height_in ?? 36)) return false;
    if (!!x.is_patio !== !!y.is_patio) return false;
    if (x.center.x !== y.center.x || x.center.y !== y.center.y) return false;
  }
  return true;
}
function sameAdjust(a: WallAdjustment, b: WallAdjustment): boolean {
  return a === b || (
    a.start.front === b.start.front && a.start.back === b.start.back &&
    a.end.front === b.end.front && a.end.back === b.end.back
  );
}

const WallMesh = memo(WallMeshImpl, (a, b) => {
  if (a.color !== b.color) return false;
  if (a.material !== b.material) return false;
  if (a.tileScale !== b.tileScale) return false;
  if (a.pixelsPerFoot !== b.pixelsPerFoot) return false;
  if (a.selected !== b.selected) return false;
  if (a.baseboardSelected !== b.baseboardSelected) return false;
  if (a.tint !== b.tint) return false;
  if (a.baseboardMaterial !== b.baseboardMaterial) return false;
  if (a.baseboardTint !== b.baseboardTint) return false;
  if (a.baseboardColor !== b.baseboardColor) return false;
  if (a.baseboardTileScale !== b.baseboardTileScale) return false;
  if (a.ceilingPx !== b.ceilingPx) return false;
  if (a.isInteractive !== b.isInteractive) return false;
  if (a.inchToPx !== b.inchToPx) return false;
  if (a.onClick !== b.onClick) return false;
  if (a.onSelectBaseboard !== b.onSelectBaseboard) return false;
  if (a.wall !== b.wall) {
    if (a.wall.id !== b.wall.id) return false;
    if (a.wall.thickness !== b.wall.thickness) return false;
    if (a.wall.p1.x !== b.wall.p1.x || a.wall.p1.y !== b.wall.p1.y) return false;
    if (a.wall.p2.x !== b.wall.p2.x || a.wall.p2.y !== b.wall.p2.y) return false;
  }
  if (!sameAdjust(a.adjustments, b.adjustments)) return false;
  if (!sameDoorList(a.doors, b.doors)) return false;
  if (!sameWindowList(a.windows, b.windows)) return false;
  return true;
});

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
  isInteractive: boolean;
}
function OpeningPlaceholderImpl({ position, rotationY, width, height, thickness, yOffset, color, selected, onClick, isInteractive }: OpeningPlaceholderProps) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  const invalidate = useThree((s) => s.invalidate);
  const selEmissive = selected ? "#ff7a18" : "#000000";
  const selEmissiveIntensity = selected ? 0.4 : 0;
  const onOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    if (selected || !matRef.current) return;
    matRef.current.emissive.setHex(0xffb066);
    matRef.current.emissiveIntensity = 0.25;
    invalidate();
  }, [selected, invalidate]);
  const onOut = useCallback(() => {
    if (selected || !matRef.current) return;
    matRef.current.emissive.setHex(0x000000);
    matRef.current.emissiveIntensity = 0;
    invalidate();
  }, [selected, invalidate]);
  return (
    <group position={position} rotation={[0, rotationY, 0]}>
      <mesh
        position={[0, yOffset + height / 2, 0]}
        onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(e); } : undefined}
        onPointerOver={isInteractive ? onOver : undefined}
        onPointerOut={isInteractive ? onOut : undefined}
        raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
      >
        <boxGeometry args={[width, height, thickness * 0.6]} />
        <meshStandardMaterial ref={matRef} color={color} transparent opacity={0.55} emissive={selEmissive} emissiveIntensity={selEmissiveIntensity} />
      </mesh>
    </group>
  );
}
const OpeningPlaceholder = memo(OpeningPlaceholderImpl, (a, b) =>
  a.position[0] === b.position[0] && a.position[1] === b.position[1] && a.position[2] === b.position[2] &&
  a.rotationY === b.rotationY &&
  a.width === b.width && a.height === b.height && a.thickness === b.thickness &&
  a.yOffset === b.yOffset && a.color === b.color && a.selected === b.selected &&
  a.isInteractive === b.isInteractive,
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

// ============================================================================
// StairMesh — procedural 3D staircase generator
// ============================================================================
//
// Local coordinate system inside the outer <group>:
//   +X  = along the initial run direction (forward)
//   +Y  = up
//   +Z  = across stair width (centered on 0)
//
// Shapes:
//   straight → one flight of `tread_count` treads.
//   L        → flight 1 (~half) + square landing + flight 2 rotated ±90°.
//   U        → flight 1 (~half) + double-wide landing + flight 2 rotated 180°.


type StairFlightPiece =
  | { kind: "tread"; x: number; y: number; z: number; depth: number; width: number; thickness: number; rotY: number }
  | { kind: "riser"; x: number; y: number; z: number; width: number; height: number; thickness: number; rotY: number }
  | { kind: "landing"; x: number; y: number; z: number; sizeX: number; sizeZ: number; thickness: number }
  | { kind: "stringer"; x: number; y: number; z: number; length: number; height: number; thickness: number; rotY: number; rotZ: number };

interface StairFlightsResult {
  pieces: StairFlightPiece[];
}

function buildStairFlights(
  stair: StairsStructure3D,
  totalHeight: number,
  widthPx: number,
  treadThickness: number,
  overhang: number,
  stringerHeight: number,
  stringerThickness: number,
  turnSign: 1 | -1,
  preferredTreadDepth: number,
): StairFlightsResult {
  const shape = stair.shape ?? "straight";
  const legs = getStairLegLengthsPx(stair as StairLike, widthPx);
  const totalRun = legs.reduce((a, b) => a + b, 0);
  // Total step count derived from real 2D leg lengths and a preferred tread
  // depth (~standard 10.5"). Landing height = f1Treads * riserHeight naturally.
  const totalTreads = Math.max(
    legs.length + 1,
    Math.round(totalRun / Math.max(1, preferredTreadDepth)),
  );
  // Proportional per-flight tread distribution.
  const raw = legs.map((l) => (l / totalRun) * totalTreads);
  const flightTreads = raw.map((v) => Math.max(1, Math.floor(v)));
  let diff = totalTreads - flightTreads.reduce((a, b) => a + b, 0);
  const fracOrder = raw
    .map((v, i) => ({ i, f: v - Math.floor(v) }))
    .sort((a, b) => b.f - a.f);
  let k = 0;
  while (diff > 0 && fracOrder.length > 0) {
    flightTreads[fracOrder[k % fracOrder.length].i]++;
    diff--;
    k++;
  }
  const treadDepth = totalRun / totalTreads;
  const riserHeight = totalHeight / totalTreads;
  const pieces: StairFlightPiece[] = [];

  const riserThickness = Math.max(0.5, treadThickness * 0.5);

  const addFlight = (
    originX: number, originY: number, originZ: number,
    rotY: number, treads: number, td: number,
  ) => {
    const cos = Math.cos(rotY);
    const sin = Math.sin(rotY);
    for (let i = 0; i < treads; i++) {
      // Nosing overhang extends toward the FRONT of the step (the leading
      // edge you step onto as you ascend — higher local X).
      const treadCenterLocalX = i * td + td / 2 - overhang / 2;
      const y = originY + (i + 1) * riserHeight - treadThickness / 2;
      const tx = originX + treadCenterLocalX * cos;
      const tz = originZ + treadCenterLocalX * sin;
      pieces.push({
        kind: "tread",
        x: tx, y, z: tz,
        depth: td + overhang,
        width: Math.max(0.1, widthPx - 2 * stringerThickness),
        thickness: treadThickness,
        rotY,
      });
      // Riser i sits at the back of tread i (behind its nosing).
      const riserLocalX = i * td + riserThickness / 2;

      const riserHeightBox = Math.max(0.1, riserHeight - treadThickness);
      const riserY = originY + i * riserHeight + riserHeightBox / 2;
      const rx = originX + riserLocalX * cos;
      const rz = originZ + riserLocalX * sin;
      pieces.push({
        kind: "riser",
        x: rx, y: riserY, z: rz,
        width: Math.max(0.1, widthPx - 2 * stringerThickness),
        height: riserHeightBox,
        thickness: riserThickness,
        rotY,
      });

    }
    const flightRun = treads * td;
    const flightRise = treads * riserHeight;
    const stringerLength = Math.hypot(flightRun, flightRise);
    const pitch = Math.atan2(flightRise, flightRun);
    const centerLocalX = flightRun / 2;
    const centerY = originY + flightRise / 2;
    for (const zSide of [-1, 1] as const) {
      const localZ = zSide * (widthPx / 2 - stringerThickness / 2);
      const wx = originX + centerLocalX * cos - localZ * sin;
      const wz = originZ + centerLocalX * sin + localZ * cos;
      pieces.push({
        kind: "stringer",
        x: wx,
        y: centerY,
        z: wz,
        length: stringerLength,
        height: stringerHeight,
        thickness: stringerThickness,
        rotY,
        rotZ: pitch,
      });
    }
    return {
      endX: originX + flightRun * cos,
      endZ: originZ + flightRun * sin,
      endY: originY + flightRise,
    };
  };

  const addLanding = (x: number, y: number, z: number, sizeX: number, sizeZ: number) => {
    pieces.push({
      kind: "landing",
      x, y: y - treadThickness / 2, z,
      sizeX, sizeZ, thickness: treadThickness,
    });
  };

  if (shape === "straight") {
    addFlight(0, 0, 0, 0, flightTreads[0], treadDepth);
  } else if (shape === "L") {
    const e1 = addFlight(0, 0, 0, 0, flightTreads[0], treadDepth);
    const landingCX = e1.endX + widthPx / 2;
    const landingY = e1.endY;
    addLanding(landingCX, landingY, 0, widthPx, widthPx);
    addFlight(
      landingCX, landingY, turnSign * (widthPx / 2),
      turnSign * (Math.PI / 2), flightTreads[1], treadDepth,
    );
  } else if (flightTreads.length === 3) {
    // True 3-flight U (middle leg > 2·widthPx): F1 → L1 → F2 across → L2 → F3.
    const e1 = addFlight(0, 0, 0, 0, flightTreads[0], treadDepth);
    const landing1Y = e1.endY;
    const landing1CX = e1.endX + widthPx / 2;
    // Landing 1 sits at end of Flight 1, aligned with its centerline (z=0).
    addLanding(landing1CX, landing1Y, 0, widthPx, widthPx);
    // Flight 2 perpendicular: starts at the side edge of landing1, runs across gap.
    const f2StartX = landing1CX;
    const f2StartZ = turnSign * (widthPx / 2);
    const f2RotY = turnSign * (Math.PI / 2);
    const e2 = addFlight(f2StartX, landing1Y, f2StartZ, f2RotY, flightTreads[1], treadDepth);
    const landing2Y = e2.endY;
    const landing2CX = e2.endX;
    const landing2CZ = e2.endZ + turnSign * (widthPx / 2);
    addLanding(landing2CX, landing2Y, landing2CZ, widthPx, widthPx);
    // Flight 3 returns in -X (rotY=π) starting on the same X axis where Flight 1 ends,
    // so it lands back at x=0 mirroring Flight 1.
    const f3StartX = e1.endX;
    const f3StartZ = landing2CZ;
    addFlight(f3StartX, landing2Y, f3StartZ, Math.PI, flightTreads[2], treadDepth);
  } else {
    // 2-flight switchback U.
    const e1 = addFlight(0, 0, 0, 0, flightTreads[0], treadDepth);
    const landingCX = e1.endX + widthPx / 2;
    const landingCZ = turnSign * (widthPx / 2);
    const landingY = e1.endY;
    addLanding(landingCX, landingY, landingCZ, widthPx, 2 * widthPx);
    const f2StartX = e1.endX;
    const f2StartZ = turnSign * widthPx;
    addFlight(f2StartX, landingY, f2StartZ, Math.PI, flightTreads[1], treadDepth);
  }

  return { pieces };
}

export type StairMaterialGroup = {
  material?: MaterialAssignment;
  tileScale?: number;
  tint?: string;
};

type StairMeshProps = {
  stair: StairsStructure3D;
  ceilingPx: number;
  floorYOffset: number;
  inchToPx: (n: number) => number;
  selected: boolean;
  onClick: () => void;
  isInteractive: boolean;
  tint?: string;
  treadGroup?: StairMaterialGroup;
  riserGroup?: StairMaterialGroup;
  stringerGroup?: StairMaterialGroup;
};

// Renders either a TexturedSurface (if the group has a picked material) or a
// plain colored MeshStandardMaterial. Repeat is derived from tile scale so
// every piece within a group writes the same repeat back to the shared
// texture cache (no per-mesh racing).
interface StairPieceMaterialProps {
  group?: StairMaterialGroup;
  fallbackColor: string;
  roughness: number;
  metalness: number;
  emissive?: string;
  emissiveIntensity?: number;
}
function StairPieceMaterial({
  group, fallbackColor, roughness, metalness, emissive = "#000000", emissiveIntensity = 0,
}: StairPieceMaterialProps) {
  const tint = group?.tint;
  const material = group?.material;
  const tileScale = group?.tileScale ?? 1;
  const repeat: [number, number] = [1 / tileScale, 1 / tileScale];
  if (material) {
    return (
      <Suspense
        fallback={
          <meshStandardMaterial
            color={tint ?? fallbackColor}
            roughness={roughness}
            metalness={metalness}
            emissive={emissive}
            emissiveIntensity={emissiveIntensity}
          />
        }
      >
        <TexturedSurface
          material={material}
          repeat={repeat}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          tint={tint}
          hasUv2={false}
        />
      </Suspense>
    );
  }
  return (
    <meshStandardMaterial
      color={tint ?? fallbackColor}
      roughness={roughness}
      metalness={metalness}
      emissive={emissive}
      emissiveIntensity={emissiveIntensity}
    />
  );
}

function StairMeshImpl({
  stair, ceilingPx, floorYOffset, inchToPx, selected, onClick, isInteractive, tint,
  treadGroup, riserGroup, stringerGroup,
}: StairMeshProps) {
  // Derive missing start/end from the polygon's open-end midpoints (matches
  // the 2D editor's `getStairOpenEnds` fallback). Without this, newly-created
  // stairs and freshly-reshaped stairs render with origin=polygon[0] — a
  // corner — which shifts Flight #1 off the entry edge (looks like it grows
  // from a centerline / wrong orientation) until the user hits Switch Start/End.
  const derivedEnds = useMemo(
    () => getStairOpenEndMids(
      stair.polygon,
      stair.shape ?? "straight",
      inchToPx(stair.width_in ?? 36),
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stair.polygon, stair.shape, stair.width_in, inchToPx],
  );
  const start = stair.start ?? derivedEnds[0] ?? stair.polygon[0] ?? { x: 0, y: 0 };
  const derivedEnd = stair.end ?? derivedEnds[1] ?? start;
  const stairForGeom = useMemo<StairLike>(
    () => (stair.start && stair.end
      ? (stair as StairLike)
      : { ...(stair as StairLike), start, end: derivedEnd }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stair, start.x, start.y, derivedEnd.x, derivedEnd.y],
  );

  const runAngle = useMemo(
    () => getStairInitialRunAngle(stairForGeom),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [start.x, start.y, derivedEnd.x, derivedEnd.y, stair.polygon],
  );

  const flights = useMemo(() => {
    const widthPx = inchToPx(stair.width_in ?? 36);
    // Floor thickness in the scene is ~0.5 px (see FloorMesh yOffset). We add
    // it so the top tread lands flush with the upper-floor surface.
    const totalHeight = ceilingPx + 0.5;
    const treadThickness = inchToPx(1.75);
    const overhang = inchToPx(1);
    const stringerHeight = inchToPx(10);
    const stringerThickness = inchToPx(1.5);
    const turnSign = getStairTurnSign(stairForGeom);
    const preferredTreadDepth = inchToPx(10.5);
    return buildStairFlights(
      stairForGeom as StairsStructure3D, totalHeight, widthPx,
      treadThickness, overhang, stringerHeight, stringerThickness,
      turnSign, preferredTreadDepth,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    stair.id, stair.shape, stair.tread_count, stair.width_in,
    stair.polygon, start.x, start.y, derivedEnd.x, derivedEnd.y,
    ceilingPx, inchToPx, stairForGeom,
  ]);

  const treadFallback = tint ?? treadGroup?.tint ?? "#c9b89c";
  const riserFallback = tint ?? riserGroup?.tint ?? "#c9b89c";
  const stringerFallback = stringerGroup?.tint ?? "#8b7355";
  const selEmissive = selected ? "#ff7a18" : "#000000";
  const selEmissiveIntensity = selected ? 0.25 : 0;

  const rotRad = stair.rotation_rad ?? 0;
  const anchor = stair.rotation_anchor ?? start;

  return (
    <group position={[anchor.x, floorYOffset, anchor.y]} rotation={[0, -rotRad, 0]}>
    <group position={[start.x - anchor.x, 0, start.y - anchor.y]} rotation={[0, -runAngle, 0]}>
      {flights.pieces.map((p, i) => {
        if (p.kind === "tread") {
          return (
            <mesh
              key={i}
              position={[p.x, p.y, p.z]}
              rotation={[0, p.rotY, 0]}
              castShadow
              receiveShadow
              raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
              onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(); } : undefined}
            >
              <boxGeometry args={[p.depth, p.thickness, p.width]} />
              <StairPieceMaterial
                group={treadGroup}
                fallbackColor={treadFallback}
                roughness={0.6}
                metalness={0.05}
                emissive={selEmissive}
                emissiveIntensity={selEmissiveIntensity}
              />
            </mesh>
          );
        }
        if (p.kind === "landing") {
          return (
            <mesh
              key={i}
              position={[p.x, p.y, p.z]}
              castShadow
              receiveShadow
              raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
              onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(); } : undefined}
            >
              <boxGeometry args={[p.sizeX, p.thickness, p.sizeZ]} />
              <StairPieceMaterial
                group={treadGroup}
                fallbackColor={treadFallback}
                roughness={0.6}
                metalness={0.05}
                emissive={selEmissive}
                emissiveIntensity={selEmissiveIntensity}
              />
            </mesh>
          );
        }
        if (p.kind === "riser") {
          return (
            <mesh
              key={i}
              position={[p.x, p.y, p.z]}
              rotation={[0, p.rotY, 0]}
              castShadow
              receiveShadow
              raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
              onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(); } : undefined}
            >
              <boxGeometry args={[p.thickness, p.height, p.width]} />
              <StairPieceMaterial
                group={riserGroup}
                fallbackColor={riserFallback}
                roughness={0.7}
                metalness={0.05}
                emissive={selEmissive}
                emissiveIntensity={selEmissiveIntensity}
              />
            </mesh>
          );
        }
        // stringer — nest rotations so the pitch (rotZ) is applied in the
        // flight's local frame *after* the Y rotation.
        const useSharedStringer = !stringerGroup?.material && !stringerGroup?.tint;
        return (
          <group key={i} position={[p.x, p.y, p.z]} rotation={[0, -p.rotY, 0]}>
            <group rotation={[0, 0, p.rotZ]}>
              <mesh
                castShadow
                receiveShadow
                raycast={isInteractive ? DEFAULT_MESH_RAYCAST : NULL_RAYCAST}
                onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(); } : undefined}
              >
                <boxGeometry args={[p.length, p.height, p.thickness]} />
                {useSharedStringer ? (
                  <primitive object={SHARED_STAIR_STRINGER_MATERIAL} attach="material" />
                ) : (
                  <StairPieceMaterial
                    group={stringerGroup}
                    fallbackColor={stringerFallback}
                    roughness={0.75}
                    metalness={0.05}
                    emissive={selEmissive}
                    emissiveIntensity={selEmissiveIntensity}
                  />
                )}
              </mesh>
            </group>
          </group>
        );
      })}
    </group>
    </group>
  );
}
const StairMesh = memo(StairMeshImpl, (a, b) => {
  if (a.selected !== b.selected) return false;
  if (a.isInteractive !== b.isInteractive) return false;
  if (a.ceilingPx !== b.ceilingPx) return false;
  if (a.floorYOffset !== b.floorYOffset) return false;
  if (a.tint !== b.tint) return false;
  if (a.treadGroup?.material !== b.treadGroup?.material) return false;
  if (a.treadGroup?.tileScale !== b.treadGroup?.tileScale) return false;
  if (a.treadGroup?.tint !== b.treadGroup?.tint) return false;
  if (a.riserGroup?.material !== b.riserGroup?.material) return false;
  if (a.riserGroup?.tileScale !== b.riserGroup?.tileScale) return false;
  if (a.riserGroup?.tint !== b.riserGroup?.tint) return false;
  if (a.stringerGroup?.material !== b.stringerGroup?.material) return false;
  if (a.stringerGroup?.tileScale !== b.stringerGroup?.tileScale) return false;
  if (a.stringerGroup?.tint !== b.stringerGroup?.tint) return false;
  if (a.inchToPx !== b.inchToPx) return false;
  const s1 = a.stair, s2 = b.stair;
  if (s1 === s2) return true;
  if (s1.id !== s2.id) return false;
  if (s1.shape !== s2.shape) return false;
  if (s1.width_in !== s2.width_in) return false;
  if (s1.tread_count !== s2.tread_count) return false;
  if (s1.rotation_rad !== s2.rotation_rad) return false;
  if ((s1.rotation_anchor?.x ?? 0) !== (s2.rotation_anchor?.x ?? 0)) return false;
  if ((s1.rotation_anchor?.y ?? 0) !== (s2.rotation_anchor?.y ?? 0)) return false;
  if ((s1.start?.x ?? 0) !== (s2.start?.x ?? 0)) return false;
  if ((s1.start?.y ?? 0) !== (s2.start?.y ?? 0)) return false;
  if ((s1.end?.x ?? 0) !== (s2.end?.x ?? 0)) return false;
  if ((s1.end?.y ?? 0) !== (s2.end?.y ?? 0)) return false;
  if (s1.polygon !== s2.polygon) return false;
  return true;
});


type SceneContentsProps = {
  floors: Floor[];
  walls: Wall[];
  doors: Door[];
  windows: WindowItem[];
  furniture?: FurnitureItem[];
  structures?: Structure3D[];
  furnitureAssets?: AssetModel[];
  ceilingHeightIn: number;
  pixelsPerFoot: number;
  visualMetadata: VisualMetadata;
  selection: Selection3D;
  onSelect: (s: Selection3D) => void;
  isInteractive: boolean;
};
function SceneContents({ floors, walls, doors, windows, furniture, structures, furnitureAssets, ceilingHeightIn, pixelsPerFoot, visualMetadata, selection, onSelect, isInteractive }: SceneContentsProps) {
  // Stable inchToPx across renders so memoized children don't invalidate.
  const inchToPx = useCallback((n: number) => (n / 12) * pixelsPerFoot, [pixelsPerFoot]);
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
        <FloorMesh key={f.id} floor={f} color={visualMetadata[f.id]?.color ?? DEFAULT_FLOOR_COLOR} material={visualMetadata[f.id]?.material} tileScale={visualMetadata[f.id]?.tile_scale ?? 1} pixelsPerFoot={pixelsPerFoot} selected={selection?.kind === "floor" && selection.id === f.id} onClick={() => onSelect({ kind: "floor", id: f.id })} yOffset={i === 0 ? -0.5 : 0} tint={visualMetadata[f.id]?.tint} isInteractive={isInteractive} />
      ))}
      {floors.map((f: Floor) => (
        <CeilingMesh key={`ceil_${f.id}`} polygon={f.polygon} yPx={ceilingPx} />
      ))}
      {walls.map((w: Wall) => {
        const grouped = openingsByWall[w.id] ?? { doors: [], windows: [] };
        return (
          <WallMesh key={w.id} wall={w} ceilingPx={ceilingPx} inchToPx={inchToPx} doors={grouped.doors} windows={grouped.windows} color={visualMetadata[w.id]?.color ?? DEFAULT_WALL_COLOR} material={visualMetadata[w.id]?.material} tileScale={visualMetadata[w.id]?.tile_scale ?? 1} pixelsPerFoot={pixelsPerFoot} selected={selection?.kind === "wall" && selection.id === w.id} onClick={() => onSelect({ kind: "wall", id: w.id })} adjustments={wallAdjustments[w.id] ?? { start: { front: 0, back: 0 }, end: { front: Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y), back: Math.hypot(w.p2.x - w.p1.x, w.p2.y - w.p1.y) } }} baseboardSelected={selection?.kind === "baseboard" && selection.id === w.id} onSelectBaseboard={() => onSelect({ kind: "baseboard", id: w.id })} tint={visualMetadata[w.id]?.tint} baseboardMaterial={visualMetadata[`baseboard_${w.id}`]?.material} baseboardTint={visualMetadata[`baseboard_${w.id}`]?.tint} baseboardColor={visualMetadata[`baseboard_${w.id}`]?.color} baseboardTileScale={visualMetadata[`baseboard_${w.id}`]?.tile_scale ?? 1} isInteractive={isInteractive} />
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
              <DoorInstance door={doorForModel} url={d.model_url} inchToPx={inchToPx} selected={selection?.kind === "door" && selection.id === d.id} onClick={() => onSelect({ kind: "door", id: d.id })} tint={visualMetadata[d.id]?.tint} isInteractive={isInteractive} />
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
          <OpeningPlaceholder key={d.id} position={[c.x, 0, c.y]} rotationY={-angle} width={d.width} height={heightPx} thickness={w.thickness} yOffset={0} color="#8b5a2b" selected={selection?.kind === "door" && selection.id === d.id} onClick={() => onSelect({ kind: "door", id: d.id })} isInteractive={isInteractive} />
        );
      })}
      {windows.map((win: WindowItem) => {
        if (win.model_url) {
          return (
            <Suspense key={win.id} fallback={null}>
              <WindowInstance win={win} walls={walls} url={win.model_url} ceilingPx={ceilingPx} inchToPx={inchToPx} selected={selection?.kind === "window" && selection.id === win.id} onClick={() => onSelect({ kind: "window", id: win.id })} tint={visualMetadata[win.id]?.tint} isInteractive={isInteractive} />
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
          <OpeningPlaceholder key={win.id} position={[win.center.x, 0, win.center.y]} rotationY={-angle} width={win.width} height={heightPx} thickness={w.thickness} yOffset={sillPx} color="#7fb3d9" selected={selection?.kind === "window" && selection.id === win.id} onClick={() => onSelect({ kind: "window", id: win.id })} isInteractive={isInteractive} />
        );
      })}
      {furniture && furniture.length > 0 && (
        <Furniture3D
          items={furniture}
          assets={furnitureAssets ?? []}
          selection={selection}
          onSelect={onSelect}
          isInteractive={isInteractive}
        />
      )}
      {structures && structures.map((s) => {
        if (s.kind !== "stairs") return null;
        const stair = s as StairsStructure3D & { __from_master_floor?: number };
        // Only the "master" stair generates 3D geometry:
        //  - skip the mirrored copy that's injected on the upper floor for editing
        //  - skip a linked DN stair (its paired UP is the master)
        if (stair.__from_master_floor) return null;
        if (stair.direction === "DN" && stair.linked_stair_id) return null;
        const treadMeta = visualMetadata[`stair_tread_${stair.id}`];
        const riserMeta = visualMetadata[`stair_riser_${stair.id}`];
        const stringerMeta = visualMetadata[`stair_stringer_${stair.id}`];
        return (
          <StairMesh
            key={stair.id}
            stair={stair}
            ceilingPx={ceilingPx}
            floorYOffset={0}
            inchToPx={inchToPx}
            selected={selection?.kind === "stairs" && selection.id === stair.id}
            onClick={() => onSelect({ kind: "stairs", id: stair.id })}
            isInteractive={isInteractive}
            tint={visualMetadata[stair.id]?.tint}
            treadGroup={{ material: treadMeta?.material, tileScale: treadMeta?.tile_scale, tint: treadMeta?.tint }}
            riserGroup={{ material: riserMeta?.material, tileScale: riserMeta?.tile_scale, tint: riserMeta?.tint }}
            stringerGroup={{ material: stringerMeta?.material, tileScale: stringerMeta?.tile_scale, tint: stringerMeta?.tint }}
          />
        );
      })}

    </Bvh>
  );
}


function CameraRig({ pixelsPerFoot }: { pixelsPerFoot: number }) {
  const dist = pixelsPerFoot * 30;
  const far = Math.max(pixelsPerFoot * 500, 5000);
  return <PerspectiveCamera makeDefault fov={45} position={[dist, dist, dist]} near={Math.max(pixelsPerFoot * 0.5, 1)} far={far} />;
}

/**
 * Snaps the camera to a top-down "plan" view whenever `nonce` changes.
 * The scene is centered around world origin (an outer <group> offsets by
 * -sceneCenter), so we can target (0,0,0) directly.
 */
function PlanViewController({
  nonce,
  sizeX,
  sizeZ,
  pixelsPerFoot,
  controlsRef,
}: {
  nonce: number;
  sizeX: number;
  sizeZ: number;
  pixelsPerFoot: number;
  controlsRef: React.MutableRefObject<any>;
}) {
  const camera = useThree((s) => s.camera);
  const invalidate = useThree((s) => s.invalidate);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const maxSize = Math.max(sizeX, sizeZ, pixelsPerFoot * 20);
    // fov=45deg → half-height on ground = h*tan(22.5deg) ≈ h*0.414
    const height = (maxSize * 0.6) / 0.414;
    camera.position.set(0, height, 0.001);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    if (controlsRef.current) {
      controlsRef.current.target.set(0, 0, 0);
      controlsRef.current.update();
    }
    invalidate();
  }, [nonce, sizeX, sizeZ, pixelsPerFoot, camera, invalidate, controlsRef]);
  return null;
}

export default function FloorPlan3D({ floorsData, visibleFloor, furnitureAssets, pixelsPerFoot, visualMetadata, selection, onSelect, ambientIntensity, directionalIntensity, windowIntensity = 4, roomLightIntensity = 0.2, nightMode = false, sunAzimuthDeg = 135, sunElevationDeg = 55, sunWarmth = 0.25, exposure = 1.0, onZoomChange, topDownNonce = 0 }: Props) {
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

  // Shared XY scene center + XY size across all floors (so alignment holds).
  const sceneBox = useMemo(() => {
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
    if (!isFinite(minX)) return { x: 0, y: 0, sizeX: 0, sizeZ: 0 };
    return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, sizeX: maxX - minX, sizeZ: maxY - minY };
  }, [floorsData]);
  const sceneCenter = sceneBox;

  // Aggregate arrays for LightingSystem so the sun bounds and window
  // portals cover the whole stack.
  const lightingInputs = useMemo(() => {
    const floors: Floor[] = [];
    const walls: Wall[] = [];
    const windowGroups: { windows: WindowItem[]; yOffsetPx: number }[] = [];
    let maxCeilingIn = 0;
    for (let i = 0; i < floorsData.length; i++) {
      const fd = floorsData[i];
      floors.push(...fd.floors);
      walls.push(...fd.walls);
      windowGroups.push({ windows: fd.windows, yOffsetPx: stackY[i] ?? 0 });
      if (fd.ceilingHeightIn > maxCeilingIn) maxCeilingIn = fd.ceilingHeightIn;
    }
    return { floors, walls, windowGroups, ceilingPx: inchToPx(maxCeilingIn || 108) };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floorsData, pixelsPerFoot, stackY]);

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
      <SkyBackground />
      <Grid
        infiniteGrid
        fadeDistance={pixelsPerFoot * 200}
        fadeStrength={1.5}
        sectionColor="#e1cbcb"
        cellColor="#e2e8f0"
        cellSize={pixelsPerFoot}
        sectionSize={pixelsPerFoot * 5}
        cellThickness={0.6}
        sectionThickness={1}
        position={[0, -2, 0]}
        raycast={NULL_RAYCAST}
      />
      <CameraRig pixelsPerFoot={pixelsPerFoot} />
      <PlanViewController nonce={topDownNonce} sizeX={sceneBox.sizeX} sizeZ={sceneBox.sizeZ} pixelsPerFoot={pixelsPerFoot} controlsRef={controlsRef} />
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
          windowGroups={lightingInputs.windowGroups}
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
            const ceilPx = inchToPx(fd.ceilingHeightIn);
            const roomScale = ceilPx * ceilPx * 0.25;
            const roomEffective = nightMode
              ? Math.max(roomLightIntensity, 0.6) * roomScale * 1.5
              : roomLightIntensity * roomScale;
            const roomColor = nightMode ? "#ffd9a8" : "#ffffff";
            return (
              // Hidden floors stay mounted (geometry stays in VRAM, no rebuild
              // when toggled back on) but `visible={false}` skips their draws
              // AND we prop-drill `isInteractive={false}` so every child mesh
              // installs `raycast={() => null}` — hidden objects don't block
              // hover/click on the visible floor beneath them.
              <group key={`floor_${i}`} position={[0, stackY[i], 0]} visible={isVisible}>
                {/* Per-floor ceiling fixture lights (one per room, skipping the building footprint at index 0) */}
                {isVisible && fd.floors.slice(1).map((room) => {
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
                  structures={fd.structures}
                  furnitureAssets={furnitureAssets}
                  ceilingHeightIn={fd.ceilingHeightIn}
                  pixelsPerFoot={pixelsPerFoot}
                  visualMetadata={visualMetadata}
                  selection={selection}
                  onSelect={onSelect}
                  isInteractive={isVisible}
                />
              </group>
            );
          })}
        </Suspense>
      </group>
      <Suspense fallback={null}>
        <Environment files="/environments/noon_grass_1k.hdr" background={false} environmentIntensity={0.3} />
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
