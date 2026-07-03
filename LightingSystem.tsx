/* =============================================================================
 * LightingSystem.tsx
 * -----------------------------------------------------------------------------
 * Self-contained ArchViz lighting rig for the FloorPlan3D scene.
 *
 * Strategy (keep this in sync with the plan):
 *
 *   1. SunLight       — single directional light. Hard, crisp shadows.
 *   2. AmbientFill    — very low hemisphere light. The "closet fix": stops
 *                       windowless rooms from being pitch black without
 *                       flattening the scene the way IBL/ambient does.
 *   3. WindowPortals  — a rectAreaLight at every window, facing into the
 *                       building. Soft natural sky diffusion.
 *   4. RoomFixtures   — a pointLight at the centroid of every room polygon
 *                       (skipping floors[0], which is the building footprint).
 *                       Off by default, ramped up only in night mode.
 *
 * No <ambientLight>, no IBL contribution. Those belong to FloorPlan3D, which
 * keeps the HDRI as background/reflections only (environmentIntensity=0).
 * ============================================================================= */

import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { RectAreaLightUniformsLib } from "three/examples/jsm/lights/RectAreaLightUniformsLib.js";
import type { Floor, Pt, Wall, WindowItem } from "./FloorPlan3D";

/* -----------------------------------------------------------------------------
 * One-time init for rectAreaLight. Without this, rect area lights render black.
 * Module-scoped guard so React strict-mode double-invokes don't matter.
 * --------------------------------------------------------------------------- */
// Initialize at module load — must run before any materials compile, otherwise
// rect area lights render black and can crash the PBR shader.
RectAreaLightUniformsLib.init();

/* -----------------------------------------------------------------------------
 * Geometry helpers
 * --------------------------------------------------------------------------- */

function polygonCentroid(poly: Pt[]): Pt {
  let sx = 0;
  let sy = 0;
  for (const p of poly) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / poly.length, y: sy / poly.length };
}

function sceneBounds(floors: Floor[], walls: Wall[]) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const all: Pt[] = [
    ...floors.flatMap((f) => f.polygon),
    ...walls.flatMap((w) => [w.p1, w.p2]),
  ];
  for (const p of all) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  if (!isFinite(minX)) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, cx: 0, cy: 0, radius: 1000 };
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const radius = Math.hypot(maxX - minX, maxY - minY) / 2;
  return { minX, minY, maxX, maxY, cx, cy, radius };
}

/* =============================================================================
 * 1. SunLight — the hard directional shadow caster
 * ============================================================================= */
function SunLight({
  intensity,
  bounds,
  ceilingPx,
  azimuthDeg,
  elevationDeg,
  warmth,
}: {
  intensity: number;
  bounds: ReturnType<typeof sceneBounds>;
  ceilingPx: number;
  azimuthDeg: number;
  elevationDeg: number;
  warmth: number;
}) {
  const r = Math.max(bounds.radius, 500);
  const dist = Math.max(ceilingPx * 6, r * 2.5);
  const az = (azimuthDeg * Math.PI) / 180;
  const el = (Math.max(1, Math.min(89, elevationDeg)) * Math.PI) / 180;
  const horiz = Math.cos(el) * dist;
  const sunPos: [number, number, number] = [
    bounds.cx + Math.sin(az) * horiz,
    Math.sin(el) * dist,
    bounds.cy + Math.cos(az) * horiz,
  ];

  const half = r * 1.4;
  const top = Math.max(ceilingPx * 4, r * 2);

  // Warmth: 0 = cool noon white, 1 = warm golden hour
  const warmHex = useMemo(
    () => new THREE.Color().lerpColors(
      new THREE.Color("#ffffff"),
      new THREE.Color("#ffb060"),
      Math.max(0, Math.min(1, warmth)),
    ),
    [warmth],
  );

  return (
    <directionalLight
      position={sunPos}
      target-position={[bounds.cx, 0, bounds.cy]}
      intensity={intensity}
      color={warmHex}
      castShadow
      shadow-mapSize-width={2048}
      shadow-mapSize-height={2048}
      shadow-bias={-0.0005}
      shadow-normalBias={0.5}
      shadow-radius={5}
      shadow-camera-near={1}
      shadow-camera-far={top * 4}
      shadow-camera-left={-half}
      shadow-camera-right={half}
      shadow-camera-top={half}
      shadow-camera-bottom={-half}
    />
  );
}

/* =============================================================================
 * 2. AmbientFill — the closet fix
 * Hemisphere light only, intentionally weak. Sky tinted blue, ground warm.
 * ============================================================================= */
function AmbientFill({ intensity }: { intensity: number }) {
  return (
    <hemisphereLight
      args={["#cbd9ff", "#3a2e22", intensity]}
    />
  );
}

/* =============================================================================
 * 3. WindowPortals — soft area light per window
 * Uses each window's own rotation_rad so we don't need wall lookup. Inward
 * direction is resolved by pointing toward the building centroid (the average
 * of the first floor polygon).
 * ============================================================================= */
function WindowPortals({
  windowGroups,
  floors,
  pixelsPerFoot,
  intensity,
}: {
  windowGroups: { windows: WindowItem[]; yOffsetPx: number }[];
  floors: Floor[];
  pixelsPerFoot: number;
  intensity: number;
}) {

  const interior = useMemo<Pt>(() => {
    if (floors[0]) return polygonCentroid(floors[0].polygon);
    return { x: 0, y: 0 };
  }, [floors]);

  const inchToPx = (n: number) => (n / 12) * pixelsPerFoot;

  return (
    <>
      {windowGroups.map((group, gi) => (
        <group key={`wpg_${gi}`} position={[0, group.yOffsetPx, 0]}>
          {group.windows.map((w) => {
            const INSET = 0.9;
            const widthPx = w.width * INSET;
            const heightPx = inchToPx(w.height_in ?? 48) * INSET;
            const sillPx = inchToPx(w.sill_height_in ?? 36);

            const wx = Math.cos(w.rotation_rad);
            const wz = Math.sin(w.rotation_rad);
            const nA = { x: -wz, z: wx };
            const nB = { x: wz, z: -wx };
            const toInteriorX = interior.x - w.center.x;
            const toInteriorZ = interior.y - w.center.y;
            const dotA = nA.x * toInteriorX + nA.z * toInteriorZ;
            const inward = dotA >= 0 ? nA : nB;

            const cy = sillPx + inchToPx(w.height_in ?? 48) / 2;
            const offset = pixelsPerFoot;
            const px = w.center.x + inward.x * offset;
            const pz = w.center.y + inward.z * offset;

            const yaw = Math.atan2(inward.x, inward.z) + Math.PI;

            return (
              <rectAreaLight
                key={w.id}
                position={[px, cy, pz]}
                rotation={[0, yaw, 0, "YXZ"]}
                width={widthPx}
                height={heightPx}
                intensity={intensity}
                color="#cfe3ff"
              />
            );
          })}
        </group>
      ))}
    </>
  );
}

/* =============================================================================
 * 4. RoomFixtures — per-room ceiling point light
 * Skips floors[0] (the overall building footprint). Each remaining floor
 * polygon is treated as a room and gets one point light at its centroid,
 * mounted just under the ceiling.
 * ============================================================================= */
function RoomFixtures({
  floors,
  ceilingPx,
  intensity,
  nightMode,
}: {
  floors: Floor[];
  ceilingPx: number;
  intensity: number;
  nightMode: boolean;
}) {
  const rooms = useMemo(() => floors.slice(1), [floors]);
  if (rooms.length === 0) return null;

  const color = nightMode ? "#ffd9a8" : "#ffffff";
  // Point lights use physically-correct units (candela) and our world is in
  // pixels, so a "useful" intensity scales with ceilingPx². Without this the
  // slider has no visible effect even at max.
  const scale = ceilingPx * ceilingPx * 0.25;
  const dayMultiplier = intensity * scale;
  const nightMultiplier = Math.max(intensity, 0.6) * scale * 1.5;
  const effective = nightMode ? nightMultiplier : dayMultiplier;

  return (
    <>
      {rooms.map((room) => {
        const c = polygonCentroid(room.polygon);
        return (
          <pointLight
            key={room.id}
            position={[c.x, ceilingPx - 4, c.y]}
            intensity={effective}
            color={color}
            distance={ceilingPx * 6}
            decay={2}
          />
        );
      })}
    </>
  );
}

/* =============================================================================
 * Top-level component
 * ============================================================================= */
export interface LightingSystemProps {
  floors: Floor[];
  walls: Wall[];
  /** Windows grouped per floor with their Y offset in world px. */
  windowGroups: { windows: WindowItem[]; yOffsetPx: number }[];
  ceilingPx: number;
  pixelsPerFoot: number;
  sunIntensity?: number;
  ambientIntensity?: number;
  windowIntensity?: number;
  roomLightIntensity?: number;
  nightMode?: boolean;
  sunAzimuthDeg?: number;
  sunElevationDeg?: number;
  sunWarmth?: number;
}

export default function LightingSystem({
  floors,
  walls,
  windowGroups,
  ceilingPx,
  pixelsPerFoot,
  sunIntensity = 1,
  ambientIntensity = 1,
  windowIntensity = 8,
  roomLightIntensity = 0.5,
  nightMode = false,
  sunAzimuthDeg = 135,
  sunElevationDeg = 55,
  sunWarmth = 0.25,
}: LightingSystemProps) {
  const bounds = useMemo(() => sceneBounds(floors, walls), [floors, walls]);

  const SUN_BASE = 3.0;
  const AMBIENT_BASE = 0.5;

  return (
    <>
      <SunLight
        intensity={SUN_BASE * sunIntensity}
        bounds={bounds}
        ceilingPx={ceilingPx}
        azimuthDeg={sunAzimuthDeg}
        elevationDeg={sunElevationDeg}
        warmth={sunWarmth}
      />
      <AmbientFill intensity={AMBIENT_BASE * ambientIntensity} />
      <WindowPortals
        windowGroups={windowGroups}
        floors={floors}
        pixelsPerFoot={pixelsPerFoot}
        intensity={windowIntensity}
      />
      <RoomFixtures
        floors={floors}
        ceilingPx={ceilingPx}
        intensity={roomLightIntensity}
        nightMode={nightMode}
      />
    </>
  );
}
