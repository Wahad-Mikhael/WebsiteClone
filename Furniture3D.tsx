import { memo, useEffect, useMemo, useRef, Suspense } from "react";
import { useGLTF, Line } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";
import type { FurnitureItem, Selection3D } from "./FloorPlan3D";
import type { AssetModel, AssetCategory } from "@/lib/assets";
import { applyGlassSwap, SHARED_GLASS_MATERIAL } from "@/lib/sharedMaterials";

// 2D furniture type → asset category. Identity for the spec'd 19 types, plus
// legacy aliases used by the current catalog (sink).
export const FURNITURE_TYPE_TO_CATEGORY: Record<string, AssetCategory> = {
  king_bed: "king_bed",
  queen_bed: "queen_bed",
  double_bed: "double_bed",
  single_bed: "single_bed",
  bathtub: "bathtub",
  small_shower: "small_shower",
  large_shower: "large_shower",
  toilet: "toilet",
  bath_sink: "bath_sink",
  sink: "bath_sink",
  single_vanity: "single_vanity",
  double_vanity: "double_vanity",
  triple_couch: "triple_couch",
  double_couch: "double_couch",
  single_couch: "single_couch",
  stove: "stove",
  fridge: "fridge",
  single_cabinet: "single_counter",
  double_cabinet: "double_counter",
  single_counter: "single_counter",
  double_counter: "double_counter",
  kitchen_island: "kitchen_island",
};

export function defaultFurnitureModelUrl(
  type: string,
  assets: AssetModel[],
): string | undefined {
  const cat = FURNITURE_TYPE_TO_CATEGORY[type];
  if (!cat) return undefined;
  const def = assets.find((a) => a.category === cat && a.is_default);
  return (def ?? assets.find((a) => a.category === cat))?.model_url;
}

// Per-instance scene clone that reuses cached geometries, with a per-instance
// glass material clone to avoid shader cache mismatches across model types.
// Per-instance scene clone that reuses cached geometries, with a per-instance
// glass material clone to avoid shader cache mismatches across model types.
// Also sets every mesh material to DoubleSide so a `scale.x = -1` flip
// (which inverts winding) still renders correctly without cloning materials
// on every flip toggle.
function useInstanceClone(scene: THREE.Object3D) {
  return useMemo(() => {
    const cloned = SkeletonUtils.clone(scene);
    const glassMaterial = SHARED_GLASS_MATERIAL.clone();
    glassMaterial.needsUpdate = true;
    applyGlassSwap(cloned, glassMaterial);
    cloned.traverse((c) => {
      const mesh = c as THREE.Mesh;
      if (!(mesh as THREE.Mesh).isMesh) return;
      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      for (const m of mats) {
        if (m && (m as THREE.Material).side !== THREE.DoubleSide) {
          (m as THREE.Material).side = THREE.DoubleSide;
        }
      }
    });
    return { cloned, glassMaterial };
  }, [scene]);
}

// Tint the cloned subtree by swapping in per-instance cloned materials whose
// color is set to `tint`. Glass meshes keep their per-instance glass material.
function useTintedMaterials(root: THREE.Object3D, tint?: string) {
  const disposablesRef = useRef<THREE.Material[]>([]);
  const originalsRef = useRef<{ mesh: THREE.Mesh; mat: THREE.Material | THREE.Material[] }[]>([]);
  useEffect(() => {
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
        if (mat === SHARED_GLASS_MATERIAL) return mat;
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

const FurnitureInstance = memo(FurnitureInstanceImpl, (a, b) =>
  a.item === b.item && a.url === b.url && a.selected === b.selected &&
  a.tint === b.tint && a.isInteractive === b.isInteractive &&
  a.item.flipLR === b.item.flipLR,
);
function FurnitureInstanceImpl({
  item,
  url,
  selected,
  onClick,
  tint,
  isInteractive,
}: {
  item: FurnitureItem;
  url: string;
  selected: boolean;
  onClick: () => void;
  tint?: string;
  isInteractive: boolean;
}) {
  const { scene } = useGLTF(url);

  const { cloned, glassMaterial } = useInstanceClone(scene);
  useTintedMaterials(cloned, tint);
  useEffect(() => () => {
    glassMaterial.dispose();
  }, [glassMaterial]);
  const bboxRef = useRef<THREE.Object3D>(null);
  const invalidate = useThree((s) => s.invalidate);

  const { nativeSize, nativeCenter } = useMemo(() => {
    const box = new THREE.Box3().setFromObject(scene);
    const s = new THREE.Vector3();
    const c = new THREE.Vector3();
    box.getSize(s);
    box.getCenter(c);
    return {
      nativeSize: {
        x: Math.max(s.x, 1e-3),
        y: Math.max(s.y, 1e-3),
        z: Math.max(s.z, 1e-3),
      },
      nativeCenter: { x: c.x, y: c.y, z: c.z },
    };
  }, [scene]);

  // Derive width/length/orientation from the 2D back_edge + corners.
  const placement = useMemo(() => {
    const corners = item.corners ?? [];
    const back = item.back_edge;
    if (!back || corners.length < 3) return null;
    const { p1, p2 } = back;
    let ux = p2.x - p1.x;
    let uy = p2.y - p1.y;
    const widthPx = Math.hypot(ux, uy);
    if (widthPx < 1e-6) return null;
    ux /= widthPx;
    uy /= widthPx;
    const ax = (p1.x + p2.x) / 2;
    const ay = (p1.y + p2.y) / 2;
    const cgx = corners.reduce((s: number, c) => s + c.x, 0) / corners.length;
    const cgy = corners.reduce((s: number, c) => s + c.y, 0) / corners.length;
    let nx = -uy;
    let ny = ux;
    if ((cgx - ax) * nx + (cgy - ay) * ny < 0) {
      ux = -ux;
      uy = -uy;
      nx = -nx;
      ny = -ny;
    }
    let lengthPx = 0;
    for (const c of corners) {
      const d = (c.x - ax) * nx + (c.y - ay) * ny;
      if (d > lengthPx) lengthPx = d;
    }
    if (lengthPx < 1e-6) lengthPx = widthPx;
    const rotY = Math.atan2(-uy, ux) + Math.PI;
    return { ax, ay, rotY, widthPx, lengthPx };
  }, [item.back_edge, item.corners]);

  const edgePoints = useMemo(() => {
    const box = new THREE.BoxGeometry(nativeSize.x, nativeSize.y, nativeSize.z);
    const edges = new THREE.EdgesGeometry(box);
    const pos = edges.attributes.position as THREE.BufferAttribute;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < pos.count; i++) {
      pts.push([pos.getX(i), pos.getY(i), pos.getZ(i)]);
    }
    box.dispose();
    edges.dispose();
    return pts;
  }, [nativeSize.x, nativeSize.y, nativeSize.z]);

  if (!placement) return null;

  const scaleX = placement.widthPx / nativeSize.x;
  const scaleZ = placement.lengthPx / nativeSize.z;
  const scaleY = (scaleX + scaleZ) / 2;

  return (
    <group
      position={[placement.ax, 0, placement.ay]}
      rotation={[0, placement.rotY, 0]}
      scale={[scaleX, scaleY, scaleZ]}
      onClick={isInteractive ? (e) => { e.stopPropagation(); onClick(); } : undefined}
      onPointerOver={isInteractive ? (e) => {
        e.stopPropagation();
        document.body.style.cursor = "pointer";
        if (bboxRef.current) bboxRef.current.visible = true;
        invalidate();
      } : undefined}
      onPointerOut={isInteractive ? () => {
        document.body.style.cursor = "";
        if (bboxRef.current) bboxRef.current.visible = false;
        invalidate();
      } : undefined}
      raycast={isInteractive ? undefined : () => null}
    >
      <group scale={[item.flipLR ? -1 : 1, 1, 1]}>
        <primitive object={cloned} />
      </group>
      <Line
        ref={bboxRef as never}
        visible={false}
        points={edgePoints}
        segments
        color="#ffb066"
        lineWidth={3}
        depthTest={false}
        renderOrder={999}
        position={[nativeCenter.x, nativeCenter.y, nativeCenter.z]}
        toneMapped={false}
      />

      {selected && (
        <Line
          points={edgePoints}
          segments
          color="#ff7a18"
          lineWidth={4}
          position={[nativeCenter.x, nativeCenter.y, nativeCenter.z]}
          toneMapped={false}
        />
      )}
    </group>
  );
}

export function Furniture3D({
  items,
  assets,
  selection,
  onSelect,
  isInteractive,
}: {
  items: FurnitureItem[];
  assets: AssetModel[];
  selection: Selection3D;
  onSelect: (s: Selection3D) => void;
  isInteractive: boolean;
}) {
  return (
    <>
      {items.map((f) => {
        const url = f.model_url ?? defaultFurnitureModelUrl(f.type, assets);
        if (!url) return null;
        const selected = selection?.kind === "furniture" && selection.id === f.id;
        return (
          <Suspense key={f.id} fallback={null}>
            <FurnitureInstance
              item={f}
              url={url}
              selected={selected}
              onClick={() => onSelect({ kind: "furniture", id: f.id })}
              isInteractive={isInteractive}
            />
          </Suspense>
        );
      })}
    </>
  );
}
