import { useEffect, useMemo, useState, Suspense } from "react";
import { useGLTF, Clone, Line } from "@react-three/drei";
import * as THREE from "three";
import type { FurnitureItem, Selection3D } from "./FloorPlan3D";
import type { AssetModel, AssetCategory } from "@/lib/assets";

// Mark any material whose name contains "glass" (case-insensitive) as a
// transparent, light-passing surface — mirrors the window/door treatment.
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

// 2D furniture type → asset category. Identity for the spec'd 19 types, plus
// legacy aliases used by the current catalog (sink, single_counter, double_counter).
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
  single_cabinet: "single_cabinet",
  single_counter: "single_cabinet",
  double_cabinet: "double_cabinet",
  double_counter: "double_cabinet",
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

function FurnitureInstance({
  item,
  url,
  selected,
  onClick,
}: {
  item: FurnitureItem;
  url: string;
  selected: boolean;
  onClick: () => void;
}) {
  const { scene } = useGLTF(url);
  // Apply glass transparency to any material named "glass" (matches windows).
  useEffect(() => {
    applyGlassMaterials(scene);
  }, [scene]);

  // Native bounds — recomputed ONLY when the source GLTF scene changes, never
  // on per-frame drag updates. Also captures the bbox center so the highlight
  // wireframe sits over the model rather than sinking through the floor.
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

  const [hovered, setHovered] = useState(false);

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
    // Models face +Z by convention; our inward normal is (nx, ny), so add PI
    // to flip the model so its front faces away from the back wall (into the room).
    const rotY = Math.atan2(-uy, ux) + Math.PI;
    return { ax, ay, rotY, widthPx, lengthPx };
  }, [item.back_edge, item.corners]);

  if (!placement) return null;

  const scaleX = placement.widthPx / nativeSize.x;
  const scaleZ = placement.lengthPx / nativeSize.z;
  const scaleY = (scaleX + scaleZ) / 2;

  const highlight = selected ? "#ff7a18" : hovered ? "#ffc56b" : null;

  // True wireframe edges (12 cube edges, no face diagonals). Extract endpoint
  // pairs so drei's <Line> can render them with a real pixel thickness — plain
  // <lineSegments> ignores linewidth on most platforms.
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

  return (
    <group
      position={[placement.ax, 0, placement.ay]}
      rotation={[0, placement.rotY, 0]}
      scale={[scaleX, scaleY, scaleZ]}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        setHovered(false);
      }}
    >
      <Clone object={scene} castShadow receiveShadow />
      {highlight && (
        <Line
          points={edgePoints}
          segments
          color={highlight}
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
}: {
  items: FurnitureItem[];
  assets: AssetModel[];
  selection: Selection3D;
  onSelect: (s: Selection3D) => void;
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
            />
          </Suspense>
        );
      })}
    </>
  );
}
