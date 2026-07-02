import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useGLTF, Line } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { Door, WindowItem, Wall, Selection3D } from "./FloorPlan3D";

// ---------- helpers ----------

function projectOntoWall(center: { x: number; y: number }, w: Wall) {
  const dx = w.p2.x - w.p1.x;
  const dy = w.p2.y - w.p1.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-6) return { along: 0, perp: Infinity, len: 0 };
  const ux = dx / len, uy = dy / len;
  const vx = center.x - w.p1.x, vy = center.y - w.p1.y;
  return {
    along: vx * ux + vy * uy,
    perp: Math.abs(vx * -uy + vy * ux),
    len,
  };
}

function findWallForOpening(center: { x: number; y: number }, walls: Wall[]) {
  let best: { wall: Wall; score: number } | null = null;
  for (const w of walls) {
    const { along, perp, len } = projectOntoWall(center, w);
    if (along < -2 || along > len + 2) continue;
    const tol = w.thickness / 2 + 8;
    if (perp > tol) continue;
    if (!best || perp < best.score) best = { wall: w, score: perp };
  }
  return best?.wall ?? null;
}

// Mutate materials on the source scene so all clones share the treatment.
// Glass materials become transparent; everything else is left at full opacity.
function applyGlassMaterials(obj: THREE.Object3D) {
  obj.traverse((c) => {
    const mesh = c as THREE.Mesh;
    if (!(mesh as THREE.Mesh).isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    let isGlass = false;
    mats.forEach((mat) => {
      if (!mat) return;
      const name = (mat.name ?? "").toLowerCase();
      const std = mat as THREE.MeshStandardMaterial;
      if (name.includes("glass")) {
        isGlass = true;
        std.transparent = true;
        std.opacity = 0.25;
        std.roughness = 0.05;
        std.metalness = 0.0;
        std.depthWrite = false;
        if ("transmission" in std) {
          (std as unknown as { transmission: number }).transmission = 0.9;
        }
        std.needsUpdate = true;
      }
    });
    mesh.castShadow = !isGlass;
    mesh.receiveShadow = !isGlass;
  });
}

// Native bounds + center of a GLTF scene. Used to position/scale instances
// and to render the selection wireframe overlay.
function useNativeBox(scene: THREE.Object3D) {
  return useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    return {
      size: {
        x: Math.max(size.x, 1e-3),
        y: Math.max(size.y, 1e-3),
        z: Math.max(size.z, 1e-3),
      },
      center: { x: center.x, y: center.y, z: center.z },
    };
  }, [scene]);
}

// 12-edge wireframe points for a unit box scaled to the model's native size.
// Rendered via drei's <Line> so we get real pixel thickness; cheap and shared
// across renders since it only depends on the source scene.
function useEdgePoints(size: { x: number; y: number; z: number }) {
  return useMemo(() => {
    const box = new THREE.BoxGeometry(size.x, size.y, size.z);
    const edges = new THREE.EdgesGeometry(box);
    const pos = edges.attributes.position as THREE.BufferAttribute;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < pos.count; i++) {
      pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
    box.dispose();
    edges.dispose();
    return pts;
  }, [size.x, size.y, size.z]);
}

// Per-instance scene-graph clone WITHOUT cloning materials/geometries. This
// is the leak-free version: each instance gets its own Object3D tree (so
// per-door rotations don't bleed) while geometries and materials remain the
// shared, cached references owned by useGLTF.
function useInstanceClone(scene: THREE.Object3D) {
  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  useEffect(() => {
    return () => {
      clone.traverse((c) => {
        const m = c as THREE.Mesh;
        if (!(m as THREE.Mesh).isMesh) return;
        // Only dispose if this geometry/material is NOT the source's instance
        // (i.e. something genuinely cloned for this tree).
        // Materials/geometries from useGLTF are shared and must be left alone.
      });
    };
  }, [clone]);
  return clone;
}

// Apply a tint to the cloned subtree by replacing each mesh's material with
// a per-instance clone whose `color` is multiplied by the tint. Restores and
// disposes when tint or root changes. Glass materials are left untouched so
// their transparency/transmission isn't visually overridden.
function useTintedMaterials(root: THREE.Object3D, tint?: string) {
  const disposablesRef = useRef<THREE.Material[]>([]);
  const originalsRef = useRef<{ mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[]>([]);
  useEffect(() => {
    // Restore previous originals and dispose previously cloned materials
    for (const { mesh, mat } of originalsRef.current) mesh.material = mat;
    originalsRef.current = [];
    for (const m of disposablesRef.current) m.dispose();
    disposablesRef.current = [];
    if (!tint) return;
    const color = new THREE.Color(tint);
    root.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!(mesh as THREE.Mesh).isMesh) return;
      const isArr = Array.isArray(mesh.material);
      const mats = (isArr ? mesh.material : [mesh.material]) as THREE.Material[];
      const newMats = mats.map((mat) => {
        if (!mat) return mat;
        const name = (mat.name ?? "").toLowerCase();
        if (name.includes("glass")) return mat;
        const cloned = (mat as THREE.MeshStandardMaterial).clone();
        const std = cloned as THREE.MeshStandardMaterial;
        if (std.color) std.color.copy(color);
        std.needsUpdate = true;
        disposablesRef.current.push(cloned);
        return cloned;
      });
      originalsRef.current.push({ mesh, mat: mesh.material });
      mesh.material = isArr ? newMats : newMats[0]!;
    });
    return () => {
      for (const { mesh, mat } of originalsRef.current) mesh.material = mat;
      originalsRef.current = [];
      for (const m of disposablesRef.current) m.dispose();
      disposablesRef.current = [];
    };
  }, [root, tint]);
}

// ---------- Door ----------

export function DoorInstance({
  door,
  url,
  inchToPx,
  selected,
  onClick,
  tint,
}: {
  door: Door;
  url: string;
  inchToPx: (n: number) => number;
  selected: boolean;
  onClick: () => void;
  tint?: string;
}) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    applyGlassMaterials(scene);
  }, [scene]);

  const { size: baseSize } = useNativeBox(scene);
  const cloned = useInstanceClone(scene);
  useTintedMaterials(cloned, tint);

  const [hovered, setHovered] = useState(false);

  // Double-door swing animation: rotate Left_Door/Right_Door meshes if present.
  // Falls back gracefully for single-door models lacking these named objects.
  useEffect(() => {
    const leftDoor = cloned.getObjectByName("Left_Door");
    const rightDoor = cloned.getObjectByName("Right_Door");
    if (!leftDoor || !rightDoor) return;

    const swingDir = door.flipY ? 1 : -1;
    const isOpen = door.open === true;
    const rotationAmount = isOpen ? (Math.PI / 2) : 0;
    leftDoor.rotation.y = rotationAmount * swingDir;
    rightDoor.rotation.y = -rotationAmount * swingDir;
  }, [cloned, door.open, door.flipY]);

  const cx = (door.hinge.x + door.strike.x) / 2;
  const cy = (door.hinge.y + door.strike.y) / 2;
  const sx = door.strike.x - door.hinge.x;
  const sy = door.strike.y - door.hinge.y;
  const wlen = Math.hypot(sx, sy) || 1;
  const ux = sx / wlen;
  const uy = sy / wlen;
  const nx = -uy;
  const ny = ux;
  const isDouble = door.is_double === true;
  const fX = !isDouble && door.flipX ? -1 : 1;
  const fY = !isDouble && door.flipY ? -1 : 1;
  const mirror = (p: { x: number; y: number }) => {
    const dx = p.x - cx;
    const dy = p.y - cy;
    const a = dx * ux + dy * uy;
    const b = dx * nx + dy * ny;
    return { x: cx + a * fX * ux + b * fY * nx, y: cy + a * fX * uy + b * fY * ny };
  };
  const hinge = mirror(door.hinge);
  const strike = mirror(door.strike);
  const leaf = mirror(door.leaf);

  const isOpen = door.open !== false;
  const targetAngle = isOpen && !isDouble
    ? Math.atan2(leaf.y - hinge.y, leaf.x - hinge.x)
    : Math.atan2(strike.y - hinge.y, strike.x - hinge.x);
  const rotationY = -targetAngle;

  const widthPx = door.width;
  const heightPx = inchToPx(door.height_in ?? 80);
  const scaleX = widthPx / baseSize.x;
  const scaleY = heightPx / baseSize.y;
  const scaleZ = scaleX;

  // Highlight wireframe uses the source scene's native bbox so it stays
  // aligned regardless of per-instance rotations on the cloned subtree.
  const highlightSize = useMemo(() => {
    const b = new THREE.Box3().setFromObject(scene);
    const s = new THREE.Vector3();
    const c = new THREE.Vector3();
    b.getSize(s);
    b.getCenter(c);
    return {
      size: { x: Math.max(s.x, 1e-3), y: Math.max(s.y, 1e-3), z: Math.max(s.z, 1e-3) },
      center: { x: c.x, y: c.y, z: c.z },
    };
  }, [scene]);
  const edgePoints = useEdgePoints(highlightSize.size);
  const highlight = selected ? "#ff7a18" : hovered ? "#ffc56b" : null;

  return (
    <group
      position={[hinge.x, 0, hinge.y]}
      rotation={[0, rotationY, 0]}
      scale={[scaleX, scaleY, scaleZ]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      <primitive object={cloned} />
      {highlight && (
        <Line
          points={edgePoints}
          segments
          color={highlight}
          lineWidth={4}
          position={[highlightSize.center.x, highlightSize.center.y, highlightSize.center.z]}
          toneMapped={false}
        />
      )}
    </group>
  );
}

// ---------- Window ----------

export function WindowInstance({
  win,
  walls,
  url,
  ceilingPx,
  inchToPx,
  selected,
  onClick,
  tint,
}: {
  win: WindowItem;
  walls: Wall[];
  url: string;
  ceilingPx: number;
  inchToPx: (n: number) => number;
  selected: boolean;
  onClick: () => void;
  tint?: string;
}) {
  const { scene } = useGLTF(url);
  useEffect(() => {
    applyGlassMaterials(scene);
  }, [scene]);

  const { size: baseSize, center: baseCenter } = useNativeBox(scene);
  const cloned = useInstanceClone(scene);
  useTintedMaterials(cloned, tint);

  const sillPx = inchToPx(win.sill_height_in ?? 36);
  const heightPxForTop = inchToPx(win.height_in ?? 48);
  const topY = sillPx + heightPxForTop;
  void ceilingPx;

  const [hovered, setHovered] = useState(false);

  const wall = findWallForOpening(win.center, walls);
  const wallAngle = wall
    ? Math.atan2(wall.p2.y - wall.p1.y, wall.p2.x - wall.p1.x)
    : win.rotation_rad ?? 0;

  const widthPx = win.width;
  const heightPx = inchToPx(win.height_in ?? 48);
  const scaleX = widthPx / baseSize.x;
  const scaleY = heightPx / baseSize.y;
  const wallThickness = wall?.thickness ?? baseSize.z;
  const scaleZ = (wallThickness / baseSize.z) * 0.8;

  const edgePoints = useEdgePoints(baseSize);
  const highlight = selected ? "#ff7a18" : hovered ? "#ffc56b" : null;
  // Counter-scale the highlight in local Z so it pokes ~3" past each wall
  // face instead of being buried inside the wall (model only occupies 80%
  // of wall thickness, and the wireframe would otherwise scale with it).
  const padInPx = inchToPx(3);
  const desiredWorldZ = wallThickness + padInPx * 2;
  const highlightZMul = desiredWorldZ / Math.max(baseSize.z * scaleZ, 1e-3);

  return (
    <group
      position={[win.center.x, topY, win.center.y]}
      rotation={[0, -wallAngle, 0]}
      scale={[scaleX, scaleY, scaleZ]}
      onClick={(e) => { e.stopPropagation(); onClick(); }}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); }}
      onPointerOut={(e) => { e.stopPropagation(); setHovered(false); }}
    >
      <primitive object={cloned} />
      {highlight && (
        <group scale={[1, 1, highlightZMul]} position={[0, 0, 0]}>
          <Line
            points={edgePoints}
            segments
            color={highlight}
            lineWidth={4}
            position={[baseCenter.x, baseCenter.y, baseCenter.z / highlightZMul]}
            toneMapped={false}
            renderOrder={999}
          />
        </group>
      )}
    </group>
  );
}

// Keep `Selection3D` re-exported for callers that import via this module.
export type { Selection3D };

// ---------- Preload helper ----------

export function useModelPreload(urls: (string | undefined)[]) {
  const key = urls.filter(Boolean).join("|");
  useEffect(() => {
    for (const u of urls) {
      if (u) useGLTF.preload(u);
    }
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}

export { Suspense };
