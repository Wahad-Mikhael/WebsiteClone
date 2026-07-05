import { startTransition, useState, useRef, useEffect, useCallback, useMemo, type DragEvent } from "react";
import {
  Upload,
  RulerDimensionLine,
  Trash2,
  ZoomIn,
  ZoomOut,
  Maximize2,
  FlipHorizontal,
  FlipVertical,
  MousePointer2,
  Layers,
  FileJson,
  Square,
  DoorOpen,
  DoorClosed,
  AppWindow,
  Home,
  PanelLeftOpen,
  Slash,
  Hand,
  Crosshair,
  Undo2,
  Redo2,
  Plus,
  Minus,
  PencilLine,
  X,
  Bed,
  Sofa,
  Bath,
  Toilet,
  ShowerHead,
  Armchair,
  Refrigerator,
  CookingPot,
  Type,
  RotateCw,
  ChevronRight,
  ChevronsUp,
  ArrowLeftRight,
  Grip,
  type LucideIcon,
} from "lucide-react";

import { Custom_Rotate, Custom_Window, Custom_SlidingDoor, Custom_Polygon, Custom_Toilet, Custom_King_Bed, Custom_Queen_Bed, Custom_Double_Bed, Custom_Single_Bed, Custom_Bathtub, Custom_Small_Shower, Custom_Large_Shower, Custom_Stove, Custom_Fridge, Custom_Single_Sink, Custom_Single_Vanity, Custom_Double_Vanity, Custom_Single_Couch, Custom_Double_Couch, Custom_Triple_Couch, Custom_Single_Cabinet, Custom_Double_Cabinet, Custom_Kitchen_Island } from "./CustomIcons";

const ArchIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 21 V10 a8 8 0 0 1 16 0 V21" />
    <line x1="3" y1="21" x2="21" y2="21" />
  </svg>
);

import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import samplePlan from "@/data/sample-plan";
import FloorPlan3D, { type Selection3D, type VisualMetadata } from "@/components/FloorPlan3D";
import { FURNITURE_TYPE_TO_CATEGORY } from "@/components/Furniture3D";
import { useMaterials } from "@/lib/materials";
import { useAssets, type AssetModel, type AssetCategory } from "@/lib/assets";
import polygonClipping from "polygon-clipping";
import {
  shiftFloorCoordinates,
  buildMasterStairs,
  type StairLike,
} from "@/lib/stairLogic";
import { FloorAlignmentDialog } from "@/components/FloorAlignmentDialog";

// ============================================================================
// CONFIG
// ============================================================================
const CONFIG = {
  zoomSpeed: 0.15,
  defaultWallThickness: 4,
  hitboxBuffer: 2,
  handleRadiusMult: 0.5,
  handleStrokeWidth: 2.5,
  snapDistancePx: 14, // screen pixels
  alignmentRadiusFt: 8, // only show alignment guides for objects within this radius of the cursor
  grid: { size: 20, dotRadius: 1 },
  doorStyles: { panelThickness: 6, panelStrokeWidth: 1.5, arcStrokeWidth: 1.25, arcDashArray: "5,5" },
  windowStyles: { frameStrokeWidth: 2, paneStrokeWidth: 1 },
  calibrationStyles: { strokeWidth: 2, dashArray: "4,4" },
};

const COLORS = {
  canvas: "oklch(0.99 0.005 45)",
  gridDot: "oklch(0.88 0.012 45)",
  floor: "oklch(0.96 0.015 45)",
  floorSelected: "oklch(0.88 0.1 45)",
  wall: "oklch(0.24 0.03 45)",
  itemHover: "oklch(0.92 0.07 45)",
  strokeHover: "oklch(0.65 0.18 45)",
  itemSelected: "oklch(0.58 0.17 45)",
  door: "oklch(0.3 0.03 45)",
  doorArc: "oklch(0.62 0.04 45)",
  window: "oklch(0.3 0.03 45)",
  white: "oklch(1 0 0)",
  calibrationLine: "oklch(0.58 0.17 45)",
  handleFill: "oklch(1 0 0)",
  snapGuide: "oklch(0.65 0.2 30)",
};

type Pt = { x: number; y: number };
type Floor = { id: string; polygon: Pt[] };
type Wall = { id: string; thickness: number; p1: Pt; p2: Pt };
type Door = {
  id: string;
  thickness: number;
  width: number;
  hinge: Pt;
  strike: Pt;
  leaf: Pt;
  flipX?: boolean;
  flipY?: boolean;
  height_in?: number;
  open?: boolean;
  model_url?: string;
  is_double?: boolean;
  is_arch?: boolean;
};
type TextItem = { id: string; type: string; text: string; x: number; y: number; fontSize?: number };
type FurnitureItem = {
  id: string;
  type: string;
  is_L_shaped: boolean;
  corners: Pt[];
  back_edge?: { p1: Pt; p2: Pt };
  angle_deg: number;
  model_url?: string;
  flipLR?: boolean;
};
type WindowItem = {
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
// Stairs are stored as an axis-aligned rectilinear polygon (4/6/8 vertices for
// Straight/L/U). Railings behave like a wall element: a centerline with
// thickness.
type StairsStructure = {
  id: string;
  kind: "stairs";
  polygon: Pt[];
  shape?: "straight" | "L" | "U";
  width_in?: number; // fitted standard width (36/42/48)
  rotation_rad?: number; // visual rotation around rotation_anchor (default 0)
  rotation_anchor?: Pt; // stable pivot in world space (defaults to centroid at creation)
  // Multi-floor linking (populated from JSON / auto-linker)
  direction?: "UP" | "DN";
  start?: Pt; // bottom of run
  end?: Pt;   // top of run
  linked_stair_id?: string;
  /** When set, this stair on Floor 1 projects a read-only hole onto Floor 2. */
  spans_to_floor?: 2;
  /** Number of treads (steps) used by the procedural 3D staircase generator. */
  tread_count?: number;
};
type RailingStructure = {
  id: string;
  kind: "railing";
  p1: Pt;
  p2: Pt;
  thickness: number; // px (visual thickness of the rail body)
};
type Structure = StairsStructure | RailingStructure;

// Standard stair widths (inches)
const STAIR_STANDARD_WIDTHS_IN = [36, 42, 48];
const DEFAULT_RAILING_THICKNESS_IN = 4;
const DEFAULT_STAIR_WIDTH_IN = 36;

const generateId = (prefix: string) =>
  `${prefix}_${Math.random().toString(36).slice(2, 11)}`;

// ---------- World-space constants (post-calibration coordinate system) ----------
// After scale calibration, all geometry is rescaled so that 1 ft = PIXELS_PER_WORLD_FOOT
// world units. The canvas viewport is fit to a CANVAS_WORLD_WIDTH_FT x
// CANVAS_WORLD_HEIGHT_FT bounding box and the plan is re-centered inside it.
const PIXELS_PER_WORLD_FOOT = 20;
const PIXELS_PER_WORLD_INCH = PIXELS_PER_WORLD_FOOT / 12;
const CANVAS_WORLD_WIDTH_FT = 50;
const CANVAS_WORLD_HEIGHT_FT = 100;
const DEFAULT_WALL_THICKNESS_IN = 4;
const DOOR_SIZES_IN = [28, 30, 32, 36];
const DOUBLE_DOOR_SIZES_IN = [48, 60, 72];
const WINDOW_SIZES_IN = [24, 36, 48, 60, 72, 84, 96, 108, 120];
const PATIO_SIZES_IN = [60, 72, 96];

const nearestSize = (target: number, sizes: number[]) =>
  sizes.reduce((best, s) => (Math.abs(s - target) < Math.abs(best - target) ? s : best));

const closestByWidth = <C extends { w: number }>(targetWidthIn: number, cands: C[]): C =>
  cands.reduce((best, c) =>
    Math.abs(c.w - targetWidthIn) < Math.abs(best.w - targetWidthIn) ? c : best,
  );

const parseDimensionInput = (input: string | null): number | null => {
  if (!input) return null;
  const cleaned = input.toLowerCase().replace(/[-–—]/g, " ");
  const match = cleaned.match(
    /(?:(\d+(?:\.\d+)?)\s*(?:'|ft|feet))?\s*(?:(\d+(?:\.\d+)?)\s*(?:"|in|inches))?/,
  );
  if (match && (match[1] || match[2])) {
    const ft = parseFloat(match[1] || "0");
    const inches = parseFloat(match[2] || "0");
    return ft + inches / 12;
  }
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
};

const formatFtIn = (totalIn: number) => {
  const rounded = Math.round(totalIn);
  const sign = rounded < 0 ? "-" : "";
  const abs = Math.abs(rounded);
  const ft = Math.floor(abs / 12);
  const inch = abs - ft * 12;
  return `${sign}${ft}'-${inch}"`;
};

// ============ Stair polygon helpers ============
type StairRect = { x: number; y: number; w: number; h: number; isLanding: boolean };

const polygonBbox = (poly: Pt[]) => {
  const xs = poly.map((p) => p.x);
  const ys = poly.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
};

const pointInPolygon = (pt: Pt, poly: Pt[]) => {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x, yi = poly[i].y;
    const xj = poly[j].x, yj = poly[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
};

// Decompose an axis-aligned rectilinear polygon into a grid of rectangles.
// Cells whose centroid lies inside the polygon are returned. A cell is marked
// as a "landing" if it has at least one neighbor cell in BOTH axes (i.e. sits
// at the inside corner of an L or U) — landings get no treads.
const decomposeStairPolygon = (poly: Pt[]): StairRect[] => {
  if (poly.length < 4) return [];
  const xs = Array.from(new Set(poly.map((p) => p.x))).sort((a, b) => a - b);
  const ys = Array.from(new Set(poly.map((p) => p.y))).sort((a, b) => a - b);
  const cells: Array<{ i: number; j: number; rect: { x: number; y: number; w: number; h: number } }> = [];
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const cx = (xs[i] + xs[i + 1]) / 2;
      const cy = (ys[j] + ys[j + 1]) / 2;
      if (pointInPolygon({ x: cx, y: cy }, poly)) {
        cells.push({
          i, j,
          rect: { x: xs[i], y: ys[j], w: xs[i + 1] - xs[i], h: ys[j + 1] - ys[j] },
        });
      }
    }
  }
  const key = (i: number, j: number) => `${i},${j}`;
  const occupied = new Set(cells.map((c) => key(c.i, c.j)));
  return cells.map((c) => {
    const hasX = occupied.has(key(c.i - 1, c.j)) || occupied.has(key(c.i + 1, c.j));
    const hasY = occupied.has(key(c.i, c.j - 1)) || occupied.has(key(c.i, c.j + 1));
    return { ...c.rect, isLanding: hasX && hasY };
  });
};

const detectStairShape = (poly: Pt[]): "straight" | "L" | "U" => {
  if (poly.length <= 4) return "straight";
  if (poly.length === 6) return "L";
  return "U";
};

const snapStairWidth = (widthIn: number): number => {
  let best = STAIR_STANDARD_WIDTHS_IN[0];
  let bestDiff = Math.abs(widthIn - best);
  for (const w of STAIR_STANDARD_WIDTHS_IN) {
    const d = Math.abs(widthIn - w);
    if (d < bestDiff) { best = w; bestDiff = d; }
  }
  return best;
};

// Detect the standard fitted width (inches) from a stair polygon. Uses the
// short dimension of the longest "run" rect.
const detectStairWidthIn = (poly: Pt[], pxPerFoot: number): number => {
  const rects = decomposeStairPolygon(poly);
  const runs = rects.filter((r) => !r.isLanding);
  const source = runs.length ? runs : rects;
  if (!source.length) return 36;
  // Use the shortest "short side" across runs (stair width is consistent across runs).
  const shortSides = source.map((r) => Math.min(r.w, r.h));
  const minShortPx = Math.min(...shortSides);
  const widthIn = (minShortPx / pxPerFoot) * 12;
  return snapStairWidth(widthIn);
};

// Convert two opposite corners of an axis-aligned rect into a CCW polygon.
const rectToPolygon = (p1: Pt, p2: Pt): Pt[] => {
  const x0 = Math.min(p1.x, p2.x), y0 = Math.min(p1.y, p2.y);
  const x1 = Math.max(p1.x, p2.x), y1 = Math.max(p1.y, p2.y);
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
};

// Snap a detected furniture item's raw dimensions to the nearest "real-world"
// catalog size (and update its type). The polygon is rebuilt around the back-
// edge midpoint anchor so the shape stays centered on its back wall and keeps
// its original rotation.
const snapFurnitureDimensions = <
  T extends {
    type: string;
    corners: Pt[];
    back_edge?: { p1: Pt; p2: Pt };
    [k: string]: any;
  },
>(
  f: T,
  pxPerFoot: number,
): T => {
  if (!f.back_edge || !f.corners || f.corners.length < 4) return f;
  const pxPerInch = pxPerFoot / 12;
  const inPerPx = 12 / pxPerFoot;

  const { p1, p2 } = f.back_edge;
  let dx = p2.x - p1.x, dy = p2.y - p1.y;
  let widthPx = Math.hypot(dx, dy);
  if (widthPx < 1e-6) return f;
  let ux = dx / widthPx, uy = dy / widthPx;
  let ax = (p1.x + p2.x) / 2, ay = (p1.y + p2.y) / 2;
  // Pick perpendicular pointing into the room (toward polygon centroid)
  const cgx = f.corners.reduce((s, c) => s + c.x, 0) / f.corners.length;
  const cgy = f.corners.reduce((s, c) => s + c.y, 0) / f.corners.length;
  let nx = -uy, ny = ux;
  if ((cgx - ax) * nx + (cgy - ay) * ny < 0) { nx = -nx; ny = -ny; }
  let lengthPx = 0;
  for (const c of f.corners) {
    const d = (c.x - ax) * nx + (c.y - ay) * ny;
    if (d > lengthPx) lengthPx = d;
  }
  if (lengthPx < 1e-6) lengthPx = widthPx;

  let currentWidthIn = widthPx * inPerPx;
  let currentLengthIn = lengthPx * inPerPx;

  const t = String(f.type ?? "").toLowerCase();

  // The catalog "width" is always the top/back side of the furniture, matching
  // the SVG's horizontal axis. Never promote the perpendicular depth axis into
  // width, even if the detected raw polygon is elongated.

  const pickByWidth = <C extends { w: number }>(cands: C[]): C =>
    closestByWidth(currentWidthIn, cands);
  const pickByLongestAxis = <C extends { w: number }>(cands: C[]): C =>
    closestByWidth(Math.max(currentWidthIn, currentLengthIn), cands);

  let targetWidthIn = currentWidthIn;
  let targetLengthIn = currentLengthIn;
  let newType = f.type;

  if (
    t.startsWith("bed") ||
    ["king_bed", "queen_bed", "double_bed", "single_bed"].includes(t)
  ) {
    const c = pickByWidth([
      { w: 76, l: 80, type: "king_bed" },
      { w: 60, l: 80, type: "queen_bed" },
      { w: 53, l: 75, type: "double_bed" },
      { w: 38, l: 75, type: "single_bed" },
    ]);
    targetWidthIn = c.w; targetLengthIn = c.l; newType = c.type;
  } else if (["bathtub", "tub", "bath", "shower"].includes(t)) {
    const c =
      t === "shower"
        ? { w: 36, l: 36, type: "shower" }
        : pickByLongestAxis([
            { w: 60, l: 30, type: "bathtub" },
            { w: 36, l: 36, type: "shower" },
          ]);
    targetWidthIn = c.w; targetLengthIn = c.l; newType = c.type;
  } else if (t === "toilet") {
    const ratio = currentLengthIn > 0 ? 28 / currentLengthIn : 1;
    targetLengthIn = 28;
    targetWidthIn = currentWidthIn * ratio;
    newType = "toilet";
  } else if (["vanity", "sink", "single_vanity", "double_vanity"].includes(t)) {
    const c =
      t === "double_vanity"
        ? { w: 60, l: 24, type: "double_vanity" }
        : t === "single_vanity"
          ? { w: 36, l: 24, type: "single_vanity" }
          : pickByLongestAxis([
              { w: 36, l: 24, type: "single_vanity" },
              { w: 60, l: 24, type: "double_vanity" },
            ]);
    targetWidthIn = c.w;
    targetLengthIn = c.l;
    newType = c.type;
  } else if (
    ["couch", "sofa", "single_couch", "double_couch", "triple_couch"].includes(t)
  ) {
    const specificCouch =
      t === "single_couch"
        ? { w: 36, l: 36, type: "single_couch" }
        : t === "double_couch"
          ? { w: 60, l: 36, type: "double_couch" }
          : t === "triple_couch"
            ? { w: 84, l: 36, type: "triple_couch" }
            : null;
    const c = specificCouch ?? pickByLongestAxis([
      { w: 36, l: 36, type: "single_couch" },
      { w: 60, l: 36, type: "double_couch" },
      { w: 84, l: 36, type: "triple_couch" },
    ]);
    targetWidthIn = c.w; targetLengthIn = c.l; newType = c.type;
  } else if (["stove", "oven"].includes(t)) {
    const ratio = 30 / currentWidthIn;
    targetWidthIn = 30;
    targetLengthIn = currentLengthIn * ratio;
    newType = t;
  } else if (["fridge", "refrigerator"].includes(t)) {
    const ratio = 36 / currentWidthIn;
    targetWidthIn = 36;
    targetLengthIn = currentLengthIn * ratio;
    newType = "fridge";
  } else if (t === "counter" || t === "single_counter" || t === "double_counter") {
    const c = pickByWidth([
      { w: 36, type: "single_counter" },
      { w: 42, type: "double_counter" },
    ]);
    const ratio = c.w / currentWidthIn;
    targetWidthIn = c.w;
    targetLengthIn = currentLengthIn * ratio;
    newType = c.type;
  } else {
    return f;
  }

  const tw = targetWidthIn * pxPerInch;
  const tl = targetLengthIn * pxPerInch;
  const bl = { x: ax - (ux * tw) / 2, y: ay - (uy * tw) / 2 };
  const br = { x: ax + (ux * tw) / 2, y: ay + (uy * tw) / 2 };
  const fr = { x: br.x + nx * tl, y: br.y + ny * tl };
  const fl = { x: bl.x + nx * tl, y: bl.y + ny * tl };
  return {
    ...f,
    type: newType,
    corners: [bl, br, fr, fl],
    back_edge: { p1: bl, p2: br },
  };
};

// For a straight stair (4-vertex rect), keep the long-edge length and snap
// the short side to widthPx (anchored to its current center on the short axis).
const enforceStraightStairWidth = (poly: Pt[], widthPx: number): Pt[] => {
  if (poly.length !== 4) return poly;
  const { x, y, w, h } = polygonBbox(poly);
  if (w >= h) {
    // Horizontal long edge → short side is vertical (height)
    const cy = y + h / 2;
    const y0 = cy - widthPx / 2, y1 = cy + widthPx / 2;
    return [
      { x, y: y0 },
      { x: x + w, y: y0 },
      { x: x + w, y: y1 },
      { x, y: y1 },
    ];
  } else {
    const cx = x + w / 2;
    const x0 = cx - widthPx / 2, x1 = cx + widthPx / 2;
    return [
      { x: x0, y },
      { x: x1, y },
      { x: x1, y: y + h },
      { x: x0, y: y + h },
    ];
  }
};

// Build a default polygon for a stair shape inside a bbox, with a given short-side width.
const buildStairPolygonForShape = (
  shape: "straight" | "L" | "U",
  bbox: { x: number; y: number; w: number; h: number },
  widthPx: number,
): Pt[] => {
  const { x, y, w, h } = bbox;
  if (shape === "straight") {
    // Use the longer axis as the run.
    if (w >= h) {
      const cy = y + h / 2;
      return [
        { x, y: cy - widthPx / 2 },
        { x: x + w, y: cy - widthPx / 2 },
        { x: x + w, y: cy + widthPx / 2 },
        { x, y: cy + widthPx / 2 },
      ];
    }
    const cx = x + w / 2;
    return [
      { x: cx - widthPx / 2, y },
      { x: cx + widthPx / 2, y },
      { x: cx + widthPx / 2, y: y + h },
      { x: cx - widthPx / 2, y: y + h },
    ];
  }
  if (shape === "L") {
    // L-shaped: two runs meeting at a corner, each of `widthPx` short side.
    // Layout: horizontal run along the top, vertical run on the right.
    const tw = Math.max(w, widthPx * 2);
    const th = Math.max(h, widthPx * 2);
    const x0 = x, y0 = y;
    return [
      { x: x0, y: y0 },
      { x: x0 + tw, y: y0 },
      { x: x0 + tw, y: y0 + th },
      { x: x0 + tw - widthPx, y: y0 + th },
      { x: x0 + tw - widthPx, y: y0 + widthPx },
      { x: x0, y: y0 + widthPx },
    ];
  }
  // U-shaped: three runs forming a U opening downward.
  const tw = Math.max(w, widthPx * 3);
  const th = Math.max(h, widthPx * 2);
  const x0 = x, y0 = y;
  return [
    { x: x0, y: y0 },
    { x: x0 + tw, y: y0 },
    { x: x0 + tw, y: y0 + th },
    { x: x0 + tw - widthPx, y: y0 + th },
    { x: x0 + tw - widthPx, y: y0 + widthPx },
    { x: x0 + widthPx, y: y0 + widthPx },
    { x: x0 + widthPx, y: y0 + th },
    { x: x0, y: y0 + th },
  ];
};

// Resize an existing stair polygon to a new short-side width, preserving overall bbox.
const resizeStairPolygonWidth = (
  poly: Pt[],
  shape: "straight" | "L" | "U",
  newWidthPx: number,
): Pt[] => {
  const bbox = polygonBbox(poly);
  if (shape === "straight") return enforceStraightStairWidth(poly, newWidthPx);
  return buildStairPolygonForShape(shape, bbox, newWidthPx);
};

// ============ Stair rotation / handle helpers ============
const polygonCentroid = (poly: Pt[]): Pt => ({
  x: poly.reduce((s, p) => s + p.x, 0) / Math.max(1, poly.length),
  y: poly.reduce((s, p) => s + p.y, 0) / Math.max(1, poly.length),
});

const polygonBboxCenter = (poly: Pt[]): Pt => {
  const b = polygonBbox(poly);
  return { x: b.x + b.w / 2, y: b.y + b.h / 2 };
};


// Concrete orientation derived from a JSON-loaded polygon's vertices.
type StairOrientation =
  | { shape: "straight"; runAxis: "x" | "y" }
  | { shape: "L"; corner: "TL" | "TR" | "BL" | "BR" }
  | { shape: "U"; gap: "top" | "bottom" | "left" | "right" };

// Build an oriented stair polygon directly in world coordinates. Vertex
// ordering is chosen so getStairOpenEnds (which is geometry-based) can
// always recover the handles regardless of orientation.
const buildStairPolygonOriented = (
  o: StairOrientation,
  bbox: { x: number; y: number; w: number; h: number },
  widthPx: number,
): Pt[] => {
  const { x, y, w, h } = bbox;
  const x0 = x, x1 = x + w, y0 = y, y1 = y + h;
  if (o.shape === "straight") {
    if (o.runAxis === "x") {
      const cy = y + h / 2;
      return [
        { x: x0, y: cy - widthPx / 2 },
        { x: x1, y: cy - widthPx / 2 },
        { x: x1, y: cy + widthPx / 2 },
        { x: x0, y: cy + widthPx / 2 },
      ];
    }
    const cx = x + w / 2;
    return [
      { x: cx - widthPx / 2, y: y0 },
      { x: cx + widthPx / 2, y: y0 },
      { x: cx + widthPx / 2, y: y1 },
      { x: cx - widthPx / 2, y: y1 },
    ];
  }
  if (o.shape === "L") {
    const wp = Math.max(2, Math.min(widthPx, w - 1, h - 1));
    // Missing corner = inner-elbow of the L. The L is the union of two strips
    // of thickness `wp` along the two bbox sides NOT touching the missing corner.
    if (o.corner === "BL") {
      // strips: top + right
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x1 - wp, y: y1 },
        { x: x1 - wp, y: y0 + wp },
        { x: x0, y: y0 + wp },
      ];
    }
    if (o.corner === "BR") {
      // strips: top + left
      return [
        { x: x0, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y0 + wp },
        { x: x0 + wp, y: y0 + wp },
        { x: x0 + wp, y: y1 },
        { x: x0, y: y1 },
      ];
    }
    if (o.corner === "TL") {
      // strips: bottom + right
      return [
        { x: x1 - wp, y: y0 },
        { x: x1, y: y0 },
        { x: x1, y: y1 },
        { x: x0, y: y1 },
        { x: x0, y: y1 - wp },
        { x: x1 - wp, y: y1 - wp },
      ];
    }
    // TR: strips bottom + left
    return [
      { x: x0, y: y0 },
      { x: x0 + wp, y: y0 },
      { x: x0 + wp, y: y1 - wp },
      { x: x1, y: y1 - wp },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }
  // U
  const wp = Math.max(2, Math.min(widthPx, w / 2 - 0.5, h / 2 - 0.5));
  if (o.gap === "top") {
    return [
      { x: x0, y: y0 },
      { x: x0 + wp, y: y0 },
      { x: x0 + wp, y: y1 - wp },
      { x: x1 - wp, y: y1 - wp },
      { x: x1 - wp, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
    ];
  }
  if (o.gap === "bottom") {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x1 - wp, y: y1 },
      { x: x1 - wp, y: y0 + wp },
      { x: x0 + wp, y: y0 + wp },
      { x: x0 + wp, y: y1 },
      { x: x0, y: y1 },
    ];
  }
  if (o.gap === "left") {
    return [
      { x: x0, y: y0 },
      { x: x1, y: y0 },
      { x: x1, y: y1 },
      { x: x0, y: y1 },
      { x: x0, y: y1 - wp },
      { x: x1 - wp, y: y1 - wp },
      { x: x1 - wp, y: y0 + wp },
      { x: x0, y: y0 + wp },
    ];
  }
  // gap right
  return [
    { x: x0, y: y0 },
    { x: x1, y: y0 },
    { x: x1, y: y0 + wp },
    { x: x0 + wp, y: y0 + wp },
    { x: x0 + wp, y: y1 - wp },
    { x: x1, y: y1 - wp },
    { x: x1, y: y1 },
    { x: x0, y: y1 },
  ];
};

// Analyze the AI-detected polygon vertices to determine the concrete
// orientation. Uses spatial binning (quadrant counts) instead of strict
// vertex-equality so it tolerates noisy / non-axis-aligned input.
const analyzeStairOrientationFromJson = (
  poly: Pt[],
  shape: "straight" | "L" | "U",
  widthPx: number,
): StairOrientation => {
  const bbox = polygonBbox(poly);
  if (shape === "straight") {
    const wDiff = Math.abs(bbox.w - widthPx);
    const hDiff = Math.abs(bbox.h - widthPx);
    return { shape: "straight", runAxis: wDiff < hDiff ? "y" : "x" };
  }
  // Sample points are insets from the bbox corners/edges by enough to avoid
  // landing on a boundary. Inset proportional to bbox so we always sit
  // safely inside (or outside) the L/U arms.
  const insetX = Math.max(2, Math.min(bbox.w * 0.15, widthPx * 0.4));
  const insetY = Math.max(2, Math.min(bbox.h * 0.15, widthPx * 0.4));
  const x0 = bbox.x, x1 = bbox.x + bbox.w, y0 = bbox.y, y1 = bbox.y + bbox.h;
  const cornerProbe: Record<"TL" | "TR" | "BL" | "BR", Pt> = {
    TL: { x: x0 + insetX, y: y0 + insetY },
    TR: { x: x1 - insetX, y: y0 + insetY },
    BL: { x: x0 + insetX, y: y1 - insetY },
    BR: { x: x1 - insetX, y: y1 - insetY },
  };
  const corners: Array<"TL" | "TR" | "BL" | "BR"> = ["TL", "TR", "BL", "BR"];
  if (shape === "L") {
    // The missing corner of an L is the bbox corner NOT covered by the polygon.
    // Use point-in-polygon on inset corner probes — robust to mirroring & noise.
    let missing: "TL" | "TR" | "BL" | "BR" | null = null;
    for (const c of corners) {
      if (!pointInPolygon(cornerProbe[c], poly)) { missing = c; break; }
    }
    if (!missing) {
      // Fallback to vertex-quadrant count if probes are ambiguous.
      const cx = bbox.x + bbox.w / 2, cy = bbox.y + bbox.h / 2;
      const counts: Record<string, number> = { TL: 0, TR: 0, BL: 0, BR: 0 };
      for (const p of poly) {
        const q = (p.y < cy ? "T" : "B") + (p.x < cx ? "L" : "R");
        counts[q]++;
      }
      missing = corners.reduce((a, b) => (counts[a] <= counts[b] ? a : b));
    }
    return { shape: "L", corner: missing };
  }
  // U: gap is the bbox edge whose midpoint (inset inward) is OUTSIDE the polygon.
  const edgeProbe: Record<"top" | "bottom" | "left" | "right", Pt> = {
    top: { x: bbox.x + bbox.w / 2, y: y0 + insetY },
    bottom: { x: bbox.x + bbox.w / 2, y: y1 - insetY },
    left: { x: x0 + insetX, y: bbox.y + bbox.h / 2 },
    right: { x: x1 - insetX, y: bbox.y + bbox.h / 2 },
  };
  const edges: Array<"top" | "bottom" | "left" | "right"> = ["top", "bottom", "left", "right"];
  for (const e of edges) {
    if (!pointInPolygon(edgeProbe[e], poly)) return { shape: "U", gap: e };
  }
  // Fallback: vertex-binning.
  const cx2 = bbox.x + bbox.w / 2, cy2 = bbox.y + bbox.h / 2;
  const counts: Record<string, number> = { TL: 0, TR: 0, BL: 0, BR: 0 };
  for (const p of poly) {
    const q = (p.y < cy2 ? "T" : "B") + (p.x < cx2 ? "L" : "R");
    counts[q]++;
  }
  const sorted = corners.slice().sort((a, b) => counts[a] - counts[b]);
  const set = new Set([sorted[0], sorted[1]]);
  if (set.has("TL") && set.has("TR")) return { shape: "U", gap: "top" };
  if (set.has("BL") && set.has("BR")) return { shape: "U", gap: "bottom" };
  if (set.has("TL") && set.has("BL")) return { shape: "U", gap: "left" };
  return { shape: "U", gap: "right" };
};

// Normalize a JSON-loaded stair polygon: snap to the exact bbox, build the
// canonical oriented polygon (preserving location, orientation and chirality
// of the source). No rotation is applied — the returned polygon is already
// in world space, so rotation_rad is always 0.
const normalizeStairPolygonFromJson = (
  poly: Pt[],
  shape: "straight" | "L" | "U",
  widthPx: number,
): { polygon: Pt[]; rotation_rad: number; anchor: Pt } => {
  const bbox = polygonBbox(poly);
  const anchor = { x: bbox.x + bbox.w / 2, y: bbox.y + bbox.h / 2 };
  const o = analyzeStairOrientationFromJson(poly, shape, widthPx);
  const polygon = buildStairPolygonOriented(o, bbox, widthPx);
  return { polygon, rotation_rad: 0, anchor };
};

const recenterPolygon = (poly: Pt[], target: Pt): Pt[] => {
  const c = polygonCentroid(poly);
  const dx = target.x - c.x, dy = target.y - c.y;
  return poly.map((p) => ({ x: p.x + dx, y: p.y + dy }));
};

type StairOpenEnd = {
  mid: Pt;
  axis: "x" | "y";
  sign: -1 | 1;
  vertexIndices: number[];
  cursor: "ew-resize" | "ns-resize";
  // If set, the drag is clamped against only these vertices (instead of all
  // non-moving vertices). Useful for U-shape where the two legs are disjoint
  // and the clamp must only consider one side.
  clampAgainstIndices?: number[];
};

// Returns the draggable short-end handles for a stair polygon. Derives handles
// from polygon geometry (edge lengths + bbox-boundary membership) so it works
// for any concrete orientation produced by buildStairPolygonOriented, not just
// a fixed canonical layout.
const getStairOpenEnds = (
  poly: Pt[],
  shape: "straight" | "L" | "U",
  widthPx?: number,
): StairOpenEnd[] => {
  if (shape === "straight" && poly.length === 4) {
    const { x, y, w, h } = polygonBbox(poly);
    if (w >= h) {
      return [
        { mid: { x, y: y + h / 2 }, axis: "x", sign: -1, vertexIndices: [0, 3], cursor: "ew-resize" },
        { mid: { x: x + w, y: y + h / 2 }, axis: "x", sign: 1, vertexIndices: [1, 2], cursor: "ew-resize" },
      ];
    }
    return [
      { mid: { x: x + w / 2, y }, axis: "y", sign: -1, vertexIndices: [0, 1], cursor: "ns-resize" },
      { mid: { x: x + w / 2, y: y + h }, axis: "y", sign: 1, vertexIndices: [2, 3], cursor: "ns-resize" },
    ];
  }
  if (shape !== "L" && shape !== "U") return [];
  if (shape === "L" && poly.length !== 6) return [];
  if (shape === "U" && poly.length !== 8) return [];

  const bbox = polygonBbox(poly);
  const eps = 0.5;
  const onMinX = (p: Pt) => Math.abs(p.x - bbox.x) < eps;
  const onMaxX = (p: Pt) => Math.abs(p.x - (bbox.x + bbox.w)) < eps;
  const onMinY = (p: Pt) => Math.abs(p.y - bbox.y) < eps;
  const onMaxY = (p: Pt) => Math.abs(p.y - (bbox.y + bbox.h)) < eps;

  const n = poly.length;
  type Edge = {
    i: number; j: number; p: Pt; q: Pt; len: number;
    horiz: boolean; vert: boolean;
  };
  const edges: Edge[] = poly.map((p, i) => {
    const q = poly[(i + 1) % n];
    return {
      i, j: (i + 1) % n, p, q,
      len: Math.hypot(q.x - p.x, q.y - p.y),
      horiz: Math.abs(p.y - q.y) < eps,
      vert: Math.abs(p.x - q.x) < eps,
    };
  });
  const wp = widthPx ?? Math.min(...edges.filter((e) => e.len > 0).map((e) => e.len));
  const isShort = (e: Edge) => Math.abs(e.len - wp) < Math.max(wp * 0.5, 4);
  const onBboxBoundary = (e: Edge) =>
    (onMinX(e.p) && onMinX(e.q)) ||
    (onMaxX(e.p) && onMaxX(e.q)) ||
    (onMinY(e.p) && onMinY(e.q)) ||
    (onMaxY(e.p) && onMaxY(e.q));

  if (shape === "L") {
    const shortEnds = edges.filter((e) => isShort(e) && onBboxBoundary(e));
    return shortEnds.map<StairOpenEnd>((e) => {
      const mid = { x: (e.p.x + e.q.x) / 2, y: (e.p.y + e.q.y) / 2 };
      if (e.vert) {
        const sign: -1 | 1 = onMinX(e.p) ? -1 : 1;
        return { mid, axis: "x", sign, vertexIndices: [e.i, e.j], cursor: "ew-resize" };
      }
      const sign: -1 | 1 = onMinY(e.p) ? -1 : 1;
      return { mid, axis: "y", sign, vertexIndices: [e.i, e.j], cursor: "ns-resize" };
    });
  }

  // U
  // Inner-landing corner vertices = those NOT on any bbox boundary.
  const innerCornerIdx: number[] = [];
  poly.forEach((p, idx) => {
    if (!onMinX(p) && !onMaxX(p) && !onMinY(p) && !onMaxY(p)) innerCornerIdx.push(idx);
  });

  // Detect gap from any short edge fully on a bbox boundary. Even with
  // unequal-leg U-shapes (JSON imports), the LONGER leg's run-end edge
  // always touches the gap-side bbox boundary, so this still resolves gap.
  let gap: "top" | "bottom" | "left" | "right" = "top";
  const boundaryShort = edges.find((e) => isShort(e) && onBboxBoundary(e));
  if (boundaryShort) {
    if (boundaryShort.horiz) gap = onMinY(boundaryShort.p) ? "top" : "bottom";
    else gap = onMinX(boundaryShort.p) ? "left" : "right";
  }
  const horizGap = gap === "top" || gap === "bottom";
  const prevIdx = (i: number) => (i - 1 + n) % n;
  const nextIdx = (i: number) => (i + 1) % n;

  // Run-end edges: short, perpendicular to leg axis, AND either
  //   (a) lie on the gap-side bbox boundary (standard / longer-leg run-end), OR
  //   (b) have exactly one endpoint on a side bbox boundary (shorter-leg
  //       run-end in unequal-leg U where the top doesn't reach the bbox edge).
  // The interior landing edge is excluded (both endpoints are inner corners,
  // so neither sits on a side bbox boundary).
  const sideBboxHit = (p: Pt) =>
    horizGap ? (onMinX(p) || onMaxX(p)) : (onMinY(p) || onMaxY(p));
  const onGapSide = (e: Edge) => {
    if (gap === "top") return onMinY(e.p) && onMinY(e.q);
    if (gap === "bottom") return onMaxY(e.p) && onMaxY(e.q);
    if (gap === "left") return onMinX(e.p) && onMinX(e.q);
    return onMaxX(e.p) && onMaxX(e.q);
  };
  const shortEnds = edges.filter((e) => {
    if (!isShort(e)) return false;
    if (horizGap ? !e.horiz : !e.vert) return false;
    if (onGapSide(e)) return true;
    const sideCount = (sideBboxHit(e.p) ? 1 : 0) + (sideBboxHit(e.q) ? 1 : 0);
    return sideCount === 1;
  });

  const runEnds: StairOpenEnd[] = shortEnds.map((e) => {
    const mid = { x: (e.p.x + e.q.x) / 2, y: (e.p.y + e.q.y) / 2 };
    const clamp = [prevIdx(e.i), nextIdx(e.j)].filter((k) => k !== e.i && k !== e.j);
    if (e.horiz) {
      const sign: -1 | 1 = gap === "top" ? -1 : 1;
      return {
        mid, axis: "y", sign,
        vertexIndices: [e.i, e.j],
        cursor: "ns-resize",
        clampAgainstIndices: clamp,
      };
    }
    const sign: -1 | 1 = gap === "left" ? -1 : 1;
    return {
      mid, axis: "x", sign,
      vertexIndices: [e.i, e.j],
      cursor: "ew-resize",
      clampAgainstIndices: clamp,
    };
  });

  // Exterior side handles: long edges on the bbox boundary perpendicular to gap.
  const extEdges = edges.filter((e) => {
    if (isShort(e)) return false;
    if (!onBboxBoundary(e)) return false;
    if (gap === "top" || gap === "bottom") return e.vert; // left/right exteriors
    return e.horiz; // top/bottom exteriors
  });

  const extHandles: StairOpenEnd[] = extEdges.map((e) => {
    const mid = { x: (e.p.x + e.q.x) / 2, y: (e.p.y + e.q.y) / 2 };
    // A "leg" includes every polygon vertex within ~wp of the exterior bbox
    // side along the perpendicular axis — i.e. the outer corners on that side
    // PLUS the inner-vertical/horizontal edge of the leg.
    const legTol = wp + Math.max(2, wp * 0.25);
    if (gap === "top" || gap === "bottom") {
      const sign: -1 | 1 = onMinX(e.p) ? -1 : 1;
      const refX = sign === -1 ? bbox.x : bbox.x + bbox.w;
      const verts: number[] = [];
      poly.forEach((p, idx) => {
        if (Math.abs(p.x - refX) <= legTol) verts.push(idx);
      });
      // Clamp = the inner corner on the OPPOSITE leg.
      const clamp = innerCornerIdx.filter((idx) => !verts.includes(idx));
      return {
        mid, axis: "x", sign,
        vertexIndices: Array.from(new Set(verts)),
        cursor: "ew-resize",
        clampAgainstIndices: clamp,
      };
    }
    const sign: -1 | 1 = onMinY(e.p) ? -1 : 1;
    const refY = sign === -1 ? bbox.y : bbox.y + bbox.h;
    const verts: number[] = [];
    poly.forEach((p, idx) => {
      if (Math.abs(p.y - refY) <= legTol) verts.push(idx);
    });
    const clamp = innerCornerIdx.filter((idx) => !verts.includes(idx));
    return {
      mid, axis: "y", sign,
      vertexIndices: Array.from(new Set(verts)),
      cursor: "ns-resize",
      clampAgainstIndices: clamp,
    };
  });


  return [...runEnds, ...extHandles];
};




const noSpinnerCls =
  "[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none";

function FtInStepper({
  totalIn,
  onChange,
  min = 0,
  max,
}: {
  totalIn: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  const [text, setText] = useState(formatFtIn(totalIn));
  const [editing, setEditing] = useState(false);
  const valRef = useRef(totalIn);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    valRef.current = totalIn;
    if (!editing) setText(formatFtIn(totalIn));
  }, [totalIn, editing]);

  const clamp = (v: number) => {
    let r = v;
    if (min != null) r = Math.max(min, r);
    if (max != null) r = Math.min(max, r);
    return Math.round(r);
  };

  const stopPress = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const startPress = useCallback(
    (step: number) => {
      onChange(clamp(valRef.current + step)); // Fire once immediately
      timerRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => {
          onChange(clamp(valRef.current + step));
        }, 75); // Rapid fire speed
      }, 400); // Initial delay before rapid fire starts
    },
    [onChange, clamp]
  );

  useEffect(() => stopPress, [stopPress]); // Cleanup on unmount

  const commit = (s: string) => {
    const ft = parseDimensionInput(s);
    if (ft != null) onChange(clamp(ft * 12));
    setEditing(false);
    setText(formatFtIn(totalIn));
  };

  return (
    <div className="flex items-center h-8 rounded-md border border-input bg-background overflow-hidden bg-white">
      <button
        type="button"
        className="h-full w-7 flex items-center justify-center hover:bg-accent text-muted-foreground select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          startPress(-1);
        }}
        onPointerUp={stopPress}
        onPointerLeave={stopPress}
      >
        <Minus className="h-3 w-3 pointer-events-none" />
      </button>
      <input
        type="text"
        value={text}
        onFocus={(e) => {
          setEditing(true);
          e.currentTarget.select();
        }}
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          if (e.key === "Escape") {
            setEditing(false);
            setText(formatFtIn(totalIn));
            (e.target as HTMLInputElement).blur();
          }
        }}
        className={cn(
          "flex-1 w-0 h-full text-center text-xs bg-transparent outline-none font-mono",
          noSpinnerCls,
        )}
      />
      <button
        type="button"
        className="h-full w-7 flex items-center justify-center hover:bg-accent text-muted-foreground select-none"
        onPointerDown={(e) => {
          e.preventDefault();
          startPress(1);
        }}
        onPointerUp={stopPress}
        onPointerLeave={stopPress}
      >
        <Plus className="h-3 w-3 pointer-events-none" />
      </button>
    </div>
  );
}

type TintPreset = { name: string; value: string };

const MATERIAL_TINT_PRESETS: TintPreset[] = [
  { name: "White", value: "#ffffff" },
  { name: "Cream", value: "#f5ecd9" },
  { name: "Beige", value: "#d9c9a8" },
  { name: "Greige", value: "#a9a194" },
  { name: "Sage", value: "#9caf88" },
  { name: "Dark Green", value: "#2f4a3a" },
  { name: "Navy", value: "#1f3550" },
  { name: "Charcoal", value: "#2b2b2b" },
];

const MODEL_TINT_PRESETS: TintPreset[] = [
  { name: "White", value: "#ffffff" },
  { name: "Silver", value: "#c8ccd0" },
  { name: "Brushed", value: "#8a8f95" },
  { name: "Graphite", value: "#4a4d52" },
  { name: "Black", value: "#1a1a1a" },
  { name: "Bronze", value: "#7a5a3a" },
  { name: "Light Oak", value: "#c9a878" },
  { name: "Walnut", value: "#5a3a26" },
];

function TintPicker({
  presets,
  currentTint,
  setTint,
  clearTint,
}: {
  presets: TintPreset[];
  currentTint: string | undefined;
  setTint: (t: string) => void;
  clearTint: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Tint
        </span>
        {currentTint && (
          <button
            type="button"
            onClick={clearTint}
            className="text-[10px] text-muted-foreground hover:text-foreground underline"
          >
            No tint
          </button>
        )}
      </div>
      <div className="grid grid-cols-4 gap-2">
        {presets.map((p) => {
          const active = currentTint?.toLowerCase() === p.value.toLowerCase();
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setTint(p.value)}
              className="flex flex-col items-center gap-1 group"
              title={p.name}
            >
              <span
                className={cn(
                  "h-7 w-7 rounded-full border transition-all",
                  active
                    ? "border-primary ring-2 ring-primary/40 scale-110"
                    : "border-border group-hover:border-foreground/40",
                )}
                style={{ backgroundColor: p.value }}
              />
              <span className="text-[9px] leading-tight text-muted-foreground truncate w-full text-center">
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <input
          type="color"
          value={currentTint ?? "#ffffff"}
          onChange={(e) => setTint(e.target.value)}
          className="h-7 w-10 rounded border border-border bg-background cursor-pointer"
        />
        <span className="text-[10px] font-mono text-muted-foreground">
          {currentTint ?? "Custom"}
        </span>
      </div>
    </div>
  );
}

// ---------- Furniture catalog (categories → items with real-world dimensions) ----------
type FurnitureCatalogItem = {
  key: string;
  label: string;
  type: string;
  widthIn: number;   // top/back side of the SVG/polygon
  lengthIn: number;  // depth from the top/back side
};
const FURNITURE_CATALOG: { category: string; items: FurnitureCatalogItem[] }[] = [
  {
    category: "Bed",
    items: [
      { key: "king_bed",   label: "King",   type: "king_bed",   widthIn: 76, lengthIn: 80 },
      { key: "queen_bed",  label: "Queen",  type: "queen_bed",  widthIn: 60, lengthIn: 80 },
      { key: "double_bed", label: "Double", type: "double_bed", widthIn: 54, lengthIn: 75 },
      { key: "single_bed", label: "Single", type: "single_bed", widthIn: 38, lengthIn: 75 },
    ],
  },
  {
    category: "Bathroom",
    items: [
      { key: "bathtub",        label: "Bathtub",        type: "bathtub",        widthIn: 60, lengthIn: 30 },
      { key: "small_shower",   label: "Small Shower",   type: "small_shower",   widthIn: 36, lengthIn: 36 },
      { key: "large_shower",   label: "Large Shower",   type: "large_shower",   widthIn: 60, lengthIn: 32 },
      { key: "toilet",         label: "Toilet",         type: "toilet",         widthIn: 20, lengthIn: 28 },
      { key: "sink",           label: "Sink",           type: "sink",           widthIn: 20, lengthIn: 18 },
      { key: "single_vanity",  label: "Single Vanity",  type: "single_vanity",  widthIn: 36, lengthIn: 24 },
      { key: "double_vanity",  label: "Double Vanity",  type: "double_vanity",  widthIn: 60, lengthIn: 24 },
    ],
  },
  {
    category: "Living Room",
    items: [
      { key: "l_couch",      label: "L-Couch",       type: "l_couch",      widthIn: 96, lengthIn: 36 },
      { key: "triple_couch", label: "Triple Couch",  type: "triple_couch", widthIn: 84, lengthIn: 36 },
      { key: "double_couch", label: "Double Couch",  type: "double_couch", widthIn: 60, lengthIn: 36 },
      { key: "single_couch", label: "Single Couch",  type: "single_couch", widthIn: 36, lengthIn: 36 },
    ],
  },
  {
    category: "Kitchen",
    items: [
      { key: "stove",          label: "Stove",          type: "stove",          widthIn: 30, lengthIn: 25 },
      { key: "fridge",         label: "Fridge",         type: "fridge",         widthIn: 30, lengthIn: 33 },
      { key: "single_counter", label: "Single Counter", type: "single_counter", widthIn: 30, lengthIn: 24 },
      { key: "double_counter", label: "Double Counter", type: "double_counter", widthIn: 60, lengthIn: 24 },
      { key: "kitchen_island", label: "Kitchen Island", type: "kitchen_island", widthIn: 60, lengthIn: 36 },
    ],
  },
];


type UploadDefaults = { ceilingHeightIn: number; defaultDoorHeightIn: number };
type UploadConfirmPayload = {
  count: 1 | 2;
  files: File[];
  defaults: [UploadDefaults, UploadDefaults];
};

function UploadDropZone({
  label,
  file,
  onFile,
}: {
  label: string;
  file: File | null;
  onFile: (f: File | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [hover, setHover] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setHover(true);
      }}
      onDragLeave={() => setHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.name.endsWith(".json")) onFile(f);
      }}
      onClick={() => inputRef.current?.click()}
      className={cn(
        "flex-1 min-h-[120px] rounded-md border-2 border-dashed flex flex-col items-center justify-center px-3 py-4 text-center cursor-pointer transition-colors",
        hover ? "border-primary bg-primary/5" : "border-border hover:border-primary/60",
      )}
    >
      <Upload className="h-6 w-6 text-muted-foreground mb-2" />
      <p className="text-xs font-medium mb-1">{label}</p>
      {file ? (
        <div className="flex items-center gap-2 text-[11px] text-foreground">
          <FileJson className="h-3.5 w-3.5 text-primary" />
          <span className="truncate max-w-[140px]">{file.name}</span>
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              onFile(null);
            }}
          >
            ✕
          </button>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Drop .json or click to browse</p>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}

function UploadPlansDialog({
  open,
  onOpenChange,
  initialCeilingIn,
  initialDoorHeightIn,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  initialCeilingIn: number;
  initialDoorHeightIn: number;
  onConfirm: (p: UploadConfirmPayload) => void;
}) {
  const [count, setCount] = useState<1 | 2>(1);
  const [file1, setFile1] = useState<File | null>(null);
  const [file2, setFile2] = useState<File | null>(null);
  const [defaults1, setDefaults1] = useState<UploadDefaults>({
    ceilingHeightIn: initialCeilingIn,
    defaultDoorHeightIn: initialDoorHeightIn,
  });
  const [defaults2, setDefaults2] = useState<UploadDefaults>({
    ceilingHeightIn: initialCeilingIn,
    defaultDoorHeightIn: initialDoorHeightIn,
  });

  useEffect(() => {
    if (open) {
      setCount(1);
      setFile1(null);
      setFile2(null);
      setDefaults1({ ceilingHeightIn: initialCeilingIn, defaultDoorHeightIn: initialDoorHeightIn });
      setDefaults2({ ceilingHeightIn: initialCeilingIn, defaultDoorHeightIn: initialDoorHeightIn });
    }
  }, [open, initialCeilingIn, initialDoorHeightIn]);

  const canConfirm = count === 1 ? !!file1 : !!file1 && !!file2;

  const DefaultsBlock = ({
    value,
    onChange,
    title,
  }: {
    value: UploadDefaults;
    onChange: (v: UploadDefaults) => void;
    title?: string;
  }) => (
    <div className="flex-1 space-y-2">
      {title && <p className="text-xs font-semibold text-muted-foreground">{title}</p>}
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">Default Ceiling Height</label>
        <FtInStepper
          totalIn={value.ceilingHeightIn}
          onChange={(v) => onChange({ ...value, ceilingHeightIn: v })}
          min={1}
        />
      </div>
      <div className="space-y-1">
        <label className="text-[11px] text-muted-foreground">Default Door Height</label>
        <Select
          value={String(value.defaultDoorHeightIn)}
          onValueChange={(v) => onChange({ ...value, defaultDoorHeightIn: Number(v) })}
        >
          <SelectTrigger className="h-8 text-xs w-full [&>span]:flex-1 [&>span]:text-center">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={"80"} className="text-xs">6'-8"</SelectItem>
            <SelectItem value={"96"} className="text-xs">8'-0"</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Plan(s)</DialogTitle>
          <DialogDescription>
            How many floors do you want to upload?
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2">
          <Button
            variant={count === 1 ? "default" : "outline"}
            className="flex-1"
            onClick={() => setCount(1)}
          >
            1 Floor
          </Button>
          <Button
            variant={count === 2 ? "default" : "outline"}
            className="flex-1"
            onClick={() => setCount(2)}
          >
            2 Floors
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Default Settings
          </p>
          <div className="flex gap-4">
            <DefaultsBlock
              value={defaults1}
              onChange={setDefaults1}
              title={count === 2 ? "Floor 1" : undefined}
            />
            {count === 2 && (
              <DefaultsBlock value={defaults2} onChange={setDefaults2} title="Floor 2" />
            )}
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
            Plan File{count === 2 ? "s" : ""}
          </p>
          <div className="flex gap-3">
            <UploadDropZone
              label={count === 2 ? "Floor 1 Plan" : "Floor Plan"}
              file={file1}
              onFile={setFile1}
            />
            {count === 2 && (
              <UploadDropZone label="Floor 2 Plan" file={file2} onFile={setFile2} />
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!canConfirm}
            onClick={() =>
              onConfirm({
                count,
                files: count === 1 ? [file1!] : [file1!, file2!],
                defaults: [defaults1, defaults2],
              })
            }
          >
            Confirm & Load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export default function FloorPlanEditor() {
  const [planName, setPlanName] = useState<string>("Sample Plan");
  const [pixelsPerFoot, setPixelsPerFoot] = useState<number>(
    samplePlan.metadata?.px_per_foot || 24.5,
  );
  const [floors, setFloors] = useState<Floor[]>([]);
  const [walls, setWalls] = useState<Wall[]>([]);
  const [doors, setDoors] = useState<Door[]>([]);
  const [windows, setWindows] = useState<WindowItem[]>([]);
  const [furniture, setFurniture] = useState<FurnitureItem[]>([]);
  const [texts, setTexts] = useState<TextItem[]>([]);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [structureDraftStart, setStructureDraftStart] = useState<Pt | null>(null);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [showAllWallDims, setShowAllWallDims] = useState(false);
  const [ceilingHeightIn, setCeilingHeightIn] = useState<number>(108);
  const [defaultDoorHeightIn, setDefaultDoorHeightIn] = useState<number>(80);

  // Multi-floor support
  type FloorSnapshot = {
    planName: string;
    pixelsPerFoot: number;
    ceilingHeightIn: number;
    defaultDoorHeightIn: number;
    floors: Floor[];
    walls: Wall[];
    doors: Door[];
    windows: WindowItem[];
    furniture: FurnitureItem[];
    texts: TextItem[];
    structures: Structure[];
    visualMetadata: VisualMetadata;
    history: { past: Snapshot[]; future: Snapshot[] };
  };
  // Inactive floor data lives here as a ref to avoid re-render loops.
  // Exports must read the active floor from live React state and the
  // inactive floor from floorSnapshotsRef.current[inactiveFloor].
  const floorSnapshotsRef = useRef<Record<1 | 2, FloorSnapshot | null>>({
    1: null,
    2: null,
  });
  const [activeFloor, setActiveFloor] = useState<1 | 2>(1);
  const [uploadedFloorCount, setUploadedFloorCount] = useState<0 | 1 | 2>(0);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  // Tracks whether we still owe the user the auto stair-link / alignment
  // pass — set true on a 2-floor upload, cleared after both floors have
  // been scale-calibrated and `runAutoLinkAndAlign` has executed.
  const pendingMultiFloorLinkRef = useRef<boolean>(false);
  const calibratedFloorsRef = useRef<Set<1 | 2>>(new Set());
  // Floor alignment manual override dialog state.
  const [alignDialogOpen, setAlignDialogOpen] = useState(false);


  // 3D view state
  const [viewMode, setViewMode] = useState<"2D" | "3D">("2D");
  const [visualMetadata, setVisualMetadata] = useState<VisualMetadata>({});
  const { materials: allMaterials, loading: materialsLoading, error: materialsError } = useMaterials();
  const { assets: allAssets, loading: assetsLoading, error: assetsError } = useAssets();
  const [selection3D, setSelection3D] = useState<Selection3D>(null);

  // Default material/model lookups (driven by `is_default` column from Supabase)
  const defaultMaterials = useMemo(() => ({
    floor: allMaterials.find((m) => m.category === "floor" && m.is_default),
    wall: allMaterials.find((m) => m.category === "wall" && m.is_default),
    baseboard: allMaterials.find((m) => m.category === "baseboard" && m.is_default),
  }), [allMaterials]);
  const defaultAssets = useMemo(() => ({
    door: allAssets.find((a) => a.category === "door" && a.is_default),
    window: allAssets.find((a) => a.category === "window" && a.is_default),
    patio: allAssets.find((a) => a.category === "patio" && a.is_default),
    double_door: allAssets.find((a) => a.category === "double_door" && a.is_default),
  }), [allAssets]);
  const matToAssignment = useCallback((mat: { color_url: string; roughness_url: string; normal_url: string; ao_url: string; metallic_url: string }) => ({
    color_url: mat.color_url,
    roughness_url: mat.roughness_url,
    normal_url: mat.normal_url,
    ao_url: mat.ao_url,
    metallic_url: mat.metallic_url,
  }), []);
  const [ambientIntensity, setAmbientIntensity] = useState<number>(0.7);

  // DEFAULT 3D VIEW LIGHTING VARIABLES
  const [directionalIntensity, setDirectionalIntensity] = useState<number>(2.0);
  const [windowIntensity, setWindowIntensity] = useState<number>(8);
  const [roomLightIntensity, setRoomLightIntensity] = useState<number>(0.7);
  const [sunAzimuthDeg, setSunAzimuthDeg] = useState<number>(135);
  const [sunElevationDeg, setSunElevationDeg] = useState<number>(55);
  const [sunWarmth, setSunWarmth] = useState<number>(0.75);
  const [exposure, setExposure] = useState<number>(1.0);
  const [nightMode, setNightMode] = useState<boolean>(false);
  const [scene3DKey, setScene3DKey] = useState(0); // bump to reset camera
  const [visibleFloor, setVisibleFloor] = useState<"ALL" | 1 | 2>("ALL");
  const [floorSnapshotTick, setFloorSnapshotTick] = useState(0);

  
  // Variable to save the current sun brightness and daylight window light so when nightmode is turned on
  const savedDaylightRef = useRef({ sun: 2.0, window: 8.0, azimuth: 135, elevation: 55, warmth: 0.75 });

  const [activeDrag, setActiveDrag] = useState<
    | { id: string; pointIndex: "p1" | "p2" | number; type: "wall" | "floor" | "railing" }
    | { id: string; type: "wall-body"; startSvg: Pt; origP1: Pt; origP2: Pt }
    | { id: string; type: "railing-body"; startSvg: Pt; origP1: Pt; origP2: Pt }
    | { id: string; type: "stair-end"; axis: "x" | "y"; sign: -1 | 1; vertexIndices: number[]; clampAgainstIndices?: number[]; origPolygon: Pt[]; startSvg: Pt; rotation: number; origStart?: Pt; origEnd?: Pt }
    | { id: string; type: "stair-rotate"; cx: number; cy: number; startAngle: number; origRotationDeg: number }
    | { id: string; type: "stair-body"; startSvg: Pt; origPolygon: Pt[]; origAnchor?: Pt; origStart?: Pt; origEnd?: Pt }

    | { id: string; type: "window" }
    | { id: string; type: "door" }
    | { id: string; type: "furniture-body"; startSvg: Pt; origCorners: Pt[]; origBackEdge?: { p1: Pt; p2: Pt } }
    | { id: string; type: "furniture-rotate"; cx: number; cy: number; startAngle: number; origItemAngle: number; origCorners: Pt[]; origBackEdge?: { p1: Pt; p2: Pt } }
    | { id: string; type: "text-body"; startSvg: Pt; origX: number; origY: number }
    | { id: string; type: "text-resize"; origFontSize: number; origDist: number; cx: number; cy: number }
    | null
  >(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [viewport, setViewport] = useState({ x: 0, y: 0, zoom: 1 });
  const [zoom3D, setZoom3D] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  

  const [calibrationState, setCalibrationState] = useState<{
    active: boolean;
    point1: Pt | null;
  }>({ active: false, point1: null });
  const [mousePos, setMousePos] = useState<Pt>({ x: 0, y: 0 });
  const [snapIndicator, setSnapIndicator] = useState<Pt | null>(null);
  const [clipboardItem, setClipboardItem] = useState<{ kind: "wall"; data: Wall } | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<Array<{ axis: "x" | "y"; coord: number }>>([]);

  // Drawing tool state
  const [drawMode, setDrawMode] = useState<null | "wall" | "door" | "window" | "patio" | "double_door" | "arch" | "room" | "text" | "furniture" | "stairs" | "railing">(null);
  const [drawMenuOpen, setDrawMenuOpen] = useState(false);
  const [furnitureMenuOpen, setFurnitureMenuOpen] = useState(false);
  const [furnitureSubmenu, setFurnitureSubmenu] = useState<string | null>(null);
  const furnitureBtnRef = useRef<HTMLButtonElement>(null);
  const catBtnRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [pendingFurniture, setPendingFurniture] = useState<FurnitureCatalogItem | null>(null);
  const [stairsSubmenuOpen, setStairsSubmenuOpen] = useState(false);
  const stairsBtnRef = useRef<HTMLButtonElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [pendingStairShape, setPendingStairShape] = useState<"straight" | "L" | "U" | null>(null);
  const [wallDraftStart, setWallDraftStart] = useState<Pt | null>(null);
  const [roomDraft, setRoomDraft] = useState<Pt[]>([]);
  const [drawPreview, setDrawPreview] = useState<
    | { kind: "wall"; pt: Pt }
    | { kind: "door" | "window" | "patio" | "double_door" | "arch"; pt: Pt; angle: number; thickness: number }
    | null
  >(null);

  // Undo/redo history
  
  type Snapshot = {
    floors: Floor[];
    walls: Wall[];
    doors: Door[];
    windows: WindowItem[];
    furniture: FurnitureItem[];
    texts: TextItem[];
    structures: Structure[];
  };
  const historyRef = useRef<{ past: Snapshot[]; future: Snapshot[] }>({ past: [], future: [] });
  const skipNextHistoryRef = useRef(false);
  const [, forceHistoryUpdate] = useState(0);
  const HISTORY_LIMIT = 30;

  const pushHistory = useCallback(() => {
    const snap: Snapshot = {
      floors: JSON.parse(JSON.stringify(floors)),
      walls: JSON.parse(JSON.stringify(walls)),
      doors: JSON.parse(JSON.stringify(doors)),
      windows: JSON.parse(JSON.stringify(windows)),
      furniture: JSON.parse(JSON.stringify(furniture)),
      texts: JSON.parse(JSON.stringify(texts)),
      structures: JSON.parse(JSON.stringify(structures)),
    };
    historyRef.current.past.push(snap);
    if (historyRef.current.past.length > HISTORY_LIMIT) historyRef.current.past.shift();
    historyRef.current.future = [];
    forceHistoryUpdate((n) => n + 1);
  }, [floors, walls, doors, windows, furniture, texts, structures]);

  const applySnapshot = (s: Snapshot) => {
    skipNextHistoryRef.current = true;
    setFloors(s.floors);
    setWalls(s.walls);
    setDoors(s.doors);
    setWindows(s.windows);
    setFurniture(s.furniture ?? []);
    setTexts(s.texts ?? []);
    setStructures(s.structures ?? []);
    setSelectedId(null);
  };

  const undo = useCallback(() => {
    const h = historyRef.current;
    if (!h.past.length) return;
    const prev = h.past.pop()!;
    h.future.push({
      floors: JSON.parse(JSON.stringify(floors)),
      walls: JSON.parse(JSON.stringify(walls)),
      doors: JSON.parse(JSON.stringify(doors)),
      windows: JSON.parse(JSON.stringify(windows)),
      furniture: JSON.parse(JSON.stringify(furniture)),
      texts: JSON.parse(JSON.stringify(texts)),
      structures: JSON.parse(JSON.stringify(structures)),
    });
    applySnapshot(prev);
    forceHistoryUpdate((n) => n + 1);
  }, [floors, walls, doors, windows, furniture, texts, structures]);

  const redo = useCallback(() => {
    const h = historyRef.current;
    if (!h.future.length) return;
    const next = h.future.pop()!;
    h.past.push({
      floors: JSON.parse(JSON.stringify(floors)),
      walls: JSON.parse(JSON.stringify(walls)),
      doors: JSON.parse(JSON.stringify(doors)),
      windows: JSON.parse(JSON.stringify(windows)),
      furniture: JSON.parse(JSON.stringify(furniture)),
      texts: JSON.parse(JSON.stringify(texts)),
      structures: JSON.parse(JSON.stringify(structures)),
    });
    applySnapshot(next);
    forceHistoryUpdate((n) => n + 1);
  }, [floors, walls, doors, windows, furniture, texts, structures]);



  // Calibration dialog state
  const [calibDialog, setCalibDialog] = useState<{
    open: boolean;
    title: string;
    distancePx: number; // pixel distance, used to compute new px/foot
    placeholder: string;
    value: string;
  }>({ open: false, title: "", distancePx: 0, placeholder: "", value: "" });

  // Prompt user to calibrate scale immediately after uploading a plan
  const [scalePromptOpen, setScalePromptOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const innerGRef = useRef<SVGGElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pxToInches = (px: number) =>
    Math.round((px / (pixelsPerFoot / 12)) * 10) / 10;
  const inchesToPx = (inches: number) => inches * (pixelsPerFoot / 12);

  // Snap a point to the nearest 45° angle (0/45/90/...) relative to an anchor.
  const snapAngle45 = (anchor: Pt, x: number, y: number): Pt => {
    const dx = x - anchor.x, dy = y - anchor.y;
    if (dx === 0 && dy === 0) return { x, y };
    const step = Math.PI / 4;
    const snapped = Math.round(Math.atan2(dy, dx) / step) * step;
    const ux = Math.cos(snapped), uy = Math.sin(snapped);
    const proj = dx * ux + dy * uy;
    return { x: anchor.x + ux * proj, y: anchor.y + uy * proj };
  };

  // Smart alignment: snap mouse to X/Y axes of existing wall endpoints + centers.
  // Returns possibly-adjusted point and the guides that should render.
  const computeAlignmentSnap = (
    x: number,
    y: number,
    excludeWallId?: string,
  ): { x: number; y: number; guides: Array<{ axis: "x" | "y"; coord: number }> } => {
    const tol = CONFIG.snapDistancePx / viewport.zoom;
    const radius = CONFIG.alignmentRadiusFt * PIXELS_PER_WORLD_FOOT;
    const radiusSq = radius * radius;
    const inRange = (sx: number, sy: number) => {
      const dx = sx - x, dy = sy - y;
      return dx * dx + dy * dy <= radiusSq;
    };
    type Cand = { coord: number };
    const xs: Cand[] = [];
    const ys: Cand[] = [];
    for (const w of walls) {
      if (w.id === excludeWallId) continue;
      const dx = w.p2.x - w.p1.x;
      const dy = w.p2.y - w.p1.y;
      const half = (w.thickness || 0) / 2;
      const cx = (w.p1.x + w.p2.x) / 2;
      const cy = (w.p1.y + w.p2.y) / 2;
      // For walls, the proximity bubble qualifies the wall by its object midpoint.
      // Once qualified, its midpoint/centerline and endpoint guide candidates are available.
      if (!inRange(cx, cy)) continue;
      // Endpoints — each contributes both an x and y axis candidate from its own position.
      xs.push({ coord: w.p1.x }); ys.push({ coord: w.p1.y });
      xs.push({ coord: w.p2.x }); ys.push({ coord: w.p2.y });
      // Midpoint — contributes both axes so wall midpoint guides can appear when applicable.
      xs.push({ coord: cx }); ys.push({ coord: cy });
      if (Math.abs(dx) >= Math.abs(dy)) {
        // Mostly horizontal: outer-edge Ys. The centerline Y is supplied by the midpoint above.
        ys.push({ coord: cy + half });
        ys.push({ coord: cy - half });
      } else {
        // Mostly vertical: outer-edge Xs. The centerline X is supplied by the midpoint above.
        xs.push({ coord: cx + half });
        xs.push({ coord: cx - half });
      }
    }
    for (const s of structures) {
      if (s.kind !== "railing") continue;
      if (s.id === excludeWallId) continue;
      const dx = s.p2.x - s.p1.x;
      const dy = s.p2.y - s.p1.y;
      const half = (s.thickness || 0) / 2;
      const cx = (s.p1.x + s.p2.x) / 2;
      const cy = (s.p1.y + s.p2.y) / 2;
      if (!inRange(cx, cy)) continue;
      xs.push({ coord: s.p1.x }); ys.push({ coord: s.p1.y });
      xs.push({ coord: s.p2.x }); ys.push({ coord: s.p2.y });
      xs.push({ coord: cx }); ys.push({ coord: cy });
      if (Math.abs(dx) >= Math.abs(dy)) {
        ys.push({ coord: cy + half });
        ys.push({ coord: cy - half });
      } else {
        xs.push({ coord: cx + half });
        xs.push({ coord: cx - half });
      }
    }
    for (const d of doors) {
      const cx = (d.hinge.x + d.strike.x) / 2;
      const cy = (d.hinge.y + d.strike.y) / 2;
      if (inRange(cx, cy)) { xs.push({ coord: cx }); ys.push({ coord: cy }); }
    }
    for (const w of windows) {
      if (inRange(w.center.x, w.center.y)) { xs.push({ coord: w.center.x }); ys.push({ coord: w.center.y }); }
    }
    let outX = x, outY = y;
    const guides: Array<{ axis: "x" | "y"; coord: number }> = [];
    let bestDx = tol, bestCx: number | null = null;
    for (const c of xs) {
      const d = Math.abs(x - c.coord);
      if (d < bestDx) { bestDx = d; bestCx = c.coord; }
    }
    if (bestCx !== null) { outX = bestCx; guides.push({ axis: "x", coord: bestCx }); }
    let bestDy = tol, bestCy: number | null = null;
    for (const c of ys) {
      const d = Math.abs(y - c.coord);
      if (d < bestDy) { bestDy = d; bestCy = c.coord; }
    }
    if (bestCy !== null) { outY = bestCy; guides.push({ axis: "y", coord: bestCy }); }
    return { x: outX, y: outY, guides };
  };

  // Merge AI-detected door pairs that meet in the middle into a single double door.
  // Pairs share a near-identical strike point with roughly opposite hinge→strike vectors.
  const mergeDoubleDoors = useCallback((rawDoors: Door[], pixelsPerFoot: number): Door[] => {
    const mergePx = (12 / 12) * pixelsPerFoot; // 12 inches
    const used = new Set<number>();
    const out: Door[] = [];
    for (let i = 0; i < rawDoors.length; i++) {
      if (used.has(i)) continue;
      const a = rawDoors[i];

      // Safety check so app does not crash in case door is missing hinge or strike location
      if (!a.hinge || !a.strike || !a.leaf) {
          out.push(a);
          continue;
        }
      
      const aVec = { x: a.strike.x - a.hinge.x, y: a.strike.y - a.hinge.y };
      const aLen = Math.hypot(aVec.x, aVec.y) || 1;
      const aUx = aVec.x / aLen, aUy = aVec.y / aLen;
      let matchIdx = -1;
      for (let j = i + 1; j < rawDoors.length; j++) {
        if (used.has(j)) continue;
        const b = rawDoors[j];
        const dStrike = Math.hypot(a.strike.x - b.strike.x, a.strike.y - b.strike.y);
        if (dStrike > mergePx) continue;
        const bVec = { x: b.strike.x - b.hinge.x, y: b.strike.y - b.hinge.y };
        const bLen = Math.hypot(bVec.x, bVec.y) || 1;
        const bUx = bVec.x / bLen, bUy = bVec.y / bLen;
        const dot = aUx * bUx + aUy * bUy;
        if (dot < -0.95) { matchIdx = j; break; }
      }
      if (matchIdx === -1) { out.push(a); continue; }
      const b = rawDoors[matchIdx];
      used.add(matchIdx);
      // Build merged door: hinge=A.hinge, strike=B.hinge.
      const hinge = a.hinge;
      const strike = b.hinge;
      const dx = strike.x - hinge.x;
      const dy = strike.y - hinge.y;
      const width = Math.hypot(dx, dy);
      const len = width || 1;
      const ux = dx / len, uy = dy / len;
      // Determine swing side from A's original leaf (cross product sign).
      const aCross = (a.strike.x - a.hinge.x) * (a.leaf.y - a.hinge.y)
        - (a.strike.y - a.hinge.y) * (a.leaf.x - a.hinge.x);
      const side = aCross >= 0 ? 1 : -1;
      const nx = -uy * side, ny = ux * side;
      const leafDist = a.width || width / 2;
      const leaf = { x: hinge.x + nx * leafDist, y: hinge.y + ny * leafDist };
      out.push({
        id: generateId("door"),
        thickness: a.thickness,
        width,
        hinge,
        strike,
        leaf,
        height_in: a.height_in ?? 80,
        flipX: false,
        flipY: false,
        open: a.open ?? true,
        is_double: true,
      });
    }
    return out;
  }, []);

  // Load data
  const buildSnapshotFromPlan = useCallback(
    (
      data: any,
      name?: string,
      defaults?: { ceilingHeightIn?: number; defaultDoorHeightIn?: number },
      floorIndex?: 1 | 2,
    ): FloorSnapshot => {
      const planPxPerFoot = data.metadata?.px_per_foot ?? pixelsPerFoot;
      const floorIdPrefix = floorIndex ? `f${floorIndex}_` : "";
      const snapFloors: Floor[] = (data.floors || []).map((f: any) => ({
        ...f,
        id: `${floorIdPrefix}${f.id || generateId("floor")}`,
      }));

      const snapWalls: Wall[] = (data.walls || []).map((w: any) => ({
        ...w,
        id: w.id || generateId("wall"),
      }));
      const mappedDoors = (data.doors || []).map((d: any) => ({
        ...d,
        id: d.id || generateId("door"),
        flipX: d.flipX ?? false,
        flipY: d.flipY ?? false,
        open: d.open ?? true,
        height_in:
          defaults?.defaultDoorHeightIn ?? d.height_in ?? defaultDoorHeightIn,
      }));
      const snapDoors: Door[] = mergeDoubleDoors(mappedDoors, planPxPerFoot);
      const snapWindows: WindowItem[] = (data.windows || []).map((w: any) => ({
        ...w,
        id: w.id || generateId("window"),
      }));
      const loadedFurniture = Array.isArray(data?.furniture)
        ? data.furniture.map((f: any, i: number) => ({
            id: f.id || generateId(`furn_${i}`),
            type: String(f.type ?? "furniture"),
            is_L_shaped: !!f.is_L_shaped,
            corners: Array.isArray(f.corners)
              ? f.corners.map((c: any) => ({ x: +c.x, y: +c.y }))
              : [],
            back_edge: f.back_edge
              ? {
                  p1: { x: +f.back_edge.p1.x, y: +f.back_edge.p1.y },
                  p2: { x: +f.back_edge.p2.x, y: +f.back_edge.p2.y },
                }
              : undefined,
            angle_deg: Number(f.angle_deg ?? 0),
            model_url: typeof f.model_url === "string" ? f.model_url : undefined,
          }))
        : [];
      const snapFurniture: FurnitureItem[] = data?.metadata?.px_per_foot
        ? loadedFurniture.map((f: any) =>
            snapFurnitureDimensions(f, +data.metadata.px_per_foot),
          )
        : loadedFurniture;
      const snapTexts: TextItem[] = Array.isArray(data?.text)
        ? data.text.map((t: any, i: number) => ({
            id: t.id || generateId(`text_${i}`),
            type: String(t.type ?? "label"),
            text: String(t.text ?? ""),
            x: +t.x,
            y: +t.y,
            fontSize: t.fontSize != null ? Number(t.fontSize) : undefined,
          }))
        : [];

      const loadedStructures: Structure[] = [];
      if (Array.isArray(data?.stairs)) {
        data.stairs.forEach((s: any, i: number) => {
          const id = s.id || generateId(`stairs_${i}`);
          let polygon: Pt[] = [];
          if (Array.isArray(s.polygon) && s.polygon.length >= 4) {
            polygon = s.polygon.map((p: any) => ({ x: +p.x, y: +p.y }));
          } else if (s.p1 && s.p2) {
            polygon = rectToPolygon(
              { x: +s.p1.x, y: +s.p1.y },
              { x: +s.p2.x, y: +s.p2.y },
            );
          }
          if (polygon.length >= 4) {
            const shape = detectStairShape(polygon);
            const width_in =
              s.width_in != null
                ? snapStairWidth(+s.width_in)
                : detectStairWidthIn(polygon, planPxPerFoot);
            {
              const widthPx = (width_in / 12) * planPxPerFoot;
              const norm = normalizeStairPolygonFromJson(polygon, shape, widthPx);
              const dirRaw = typeof s.direction === "string" ? s.direction.toUpperCase() : undefined;
              const direction = dirRaw === "UP" || dirRaw === "DN" ? (dirRaw as "UP" | "DN") : undefined;
              const sp = s.start_point ?? s.start;
              const ep = s.end_point ?? s.end;
              const start = sp && sp.x != null && sp.y != null ? { x: +sp.x, y: +sp.y } : undefined;
              const end = ep && ep.x != null && ep.y != null ? { x: +ep.x, y: +ep.y } : undefined;
              loadedStructures.push({ id, kind: "stairs", polygon: norm.polygon, shape, width_in, rotation_rad: norm.rotation_rad, rotation_anchor: norm.anchor, direction, start, end });
            }
          }
        });
      }
      if (Array.isArray(data?.railings)) {
        data.railings.forEach((r: any, i: number) => {
          const id = r.id || generateId(`railing_${i}`);
          if (r.p1 && r.p2) {
            const thickness =
              r.thickness != null
                ? +r.thickness
                : DEFAULT_RAILING_THICKNESS_IN * (planPxPerFoot / 12);
            loadedStructures.push({
              id,
              kind: "railing",
              p1: { x: +r.p1.x, y: +r.p1.y },
              p2: { x: +r.p2.x, y: +r.p2.y },
              thickness,
            });
          }
        });
      }
      if (Array.isArray(data?.structures)) {
        data.structures.forEach((s: any, i: number) => {
          const id = s.id || generateId(`struct_${i}`);
          const kind = s.kind === "railing" ? "railing" : "stairs";
          if (kind === "railing" && s.p1 && s.p2) {
            loadedStructures.push({
              id,
              kind: "railing",
              p1: { x: +s.p1.x, y: +s.p1.y },
              p2: { x: +s.p2.x, y: +s.p2.y },
              thickness:
                s.thickness != null
                  ? +s.thickness
                  : DEFAULT_RAILING_THICKNESS_IN * (planPxPerFoot / 12),
            });
          } else if (
            kind === "stairs" &&
            Array.isArray(s.polygon) &&
            s.polygon.length >= 4
          ) {
            const polygon = s.polygon.map((p: any) => ({ x: +p.x, y: +p.y }));
            const shape = detectStairShape(polygon);
            const width_in =
              s.width_in != null
                ? snapStairWidth(+s.width_in)
                : detectStairWidthIn(polygon, planPxPerFoot);
            {
              const widthPx = (width_in / 12) * planPxPerFoot;
              const norm = normalizeStairPolygonFromJson(polygon, shape, widthPx);
              const dirRaw = typeof s.direction === "string" ? s.direction.toUpperCase() : undefined;
              const direction = dirRaw === "UP" || dirRaw === "DN" ? (dirRaw as "UP" | "DN") : undefined;
              const sp = s.start_point ?? s.start;
              const ep = s.end_point ?? s.end;
              const start = sp && sp.x != null && sp.y != null ? { x: +sp.x, y: +sp.y } : undefined;
              const end = ep && ep.x != null && ep.y != null ? { x: +ep.x, y: +ep.y } : undefined;
              loadedStructures.push({ id, kind: "stairs", polygon: norm.polygon, shape, width_in, rotation_rad: norm.rotation_rad, rotation_anchor: norm.anchor, direction, start, end });
            }
          }
        });
      }

      return {
        planName: name ?? "Untitled Plan",
        pixelsPerFoot: data.metadata?.px_per_foot ?? pixelsPerFoot,
        ceilingHeightIn: defaults?.ceilingHeightIn ?? ceilingHeightIn,
        defaultDoorHeightIn: defaults?.defaultDoorHeightIn ?? defaultDoorHeightIn,
        floors: snapFloors,
        walls: snapWalls,
        doors: snapDoors,
        windows: snapWindows,
        furniture: snapFurniture,
        texts: snapTexts,
        structures: loadedStructures,
        visualMetadata: {},
        history: { past: [], future: [] },
      };

    },
    [mergeDoubleDoors, pixelsPerFoot, ceilingHeightIn, defaultDoorHeightIn],
  );

  const hydrateFromSnapshot = useCallback((s: FloorSnapshot) => {
    setPlanName(s.planName);
    setPixelsPerFoot(s.pixelsPerFoot);
    setCeilingHeightIn(s.ceilingHeightIn);
    setDefaultDoorHeightIn(s.defaultDoorHeightIn);
    setFloors(s.floors);
    setWalls(s.walls);
    setDoors(s.doors);
    setWindows(s.windows);
    setFurniture(s.furniture);
    setTexts(s.texts);
    setStructures(s.structures);
    setVisualMetadata(s.visualMetadata);
    setSelectedId(null);
    historyRef.current = s.history
      ? { past: [...s.history.past], future: [...s.history.future] }
      : { past: [], future: [] };
    forceHistoryUpdate((n) => n + 1);
  }, []);

  const loadPlan = useCallback(
    (data: any, name?: string) => {
      const snap = buildSnapshotFromPlan(data, name);
      hydrateFromSnapshot(snap);
    },
    [buildSnapshotFromPlan, hydrateFromSnapshot],
  );

  // Persist current live React state into the active floor's snapshot slot.
  // Used both by floor switching and after scale calibration completes so
  // the calibrated geometry survives subsequent floor swaps.
  const saveActiveFloorSnapshot = useCallback(() => {
    // On Floor 2, the master stairs from Floor 1 have been injected into
    // `structures` (tagged with `__from_master_floor`) so the user can
    // edit them in place. Split them back out on save: the tagged entries
    // are merged into Floor 1's snapshot; only the untagged own-floor
    // structures are persisted into Floor 2's slot.
    let ownStructures: any[] = structures;
    if (activeFloor === 2) {
      const own: any[] = [];
      const editedMasters: any[] = [];
      for (const s of structures as any[]) {
        if (s?.__from_master_floor) {
          const { __from_master_floor, ...clean } = s;
          editedMasters.push(clean);
        } else {
          own.push(s);
        }
      }
      ownStructures = own;
      const s1 = floorSnapshotsRef.current[1];
      if (s1 && editedMasters.length) {
        const byId = new Map(editedMasters.map((m: any) => [m.id, m]));
        floorSnapshotsRef.current[1] = {
          ...s1,
          structures: (s1.structures as any[]).map((s: any) =>
            s?.kind === "stairs" && byId.has(s.id) ? { ...s, ...byId.get(s.id) } : s,
          ),
        };
      }
    }
    floorSnapshotsRef.current[activeFloor] = {
      planName,
      pixelsPerFoot,
      ceilingHeightIn,
      defaultDoorHeightIn,
      floors,
      walls,
      doors,
      windows,
      furniture,
      texts,
      structures: ownStructures,
      visualMetadata,
      history: {
        past: [...historyRef.current.past],
        future: [...historyRef.current.future],
      },
    };
  }, [
    activeFloor,
    planName,
    pixelsPerFoot,
    ceilingHeightIn,
    defaultDoorHeightIn,
    floors,
    walls,
    doors,
    windows,
    furniture,
    texts,
    structures,
    visualMetadata,
  ]);

  // Inject Floor 1's master stairs into the currently-rendered Floor 2
  // `structures` array so they can be selected/edited like normal stairs.
  // The tag lets `saveActiveFloorSnapshot` route edits back to Floor 1.
  const injectMastersForFloor2 = useCallback(() => {
    const s1 = floorSnapshotsRef.current[1];
    if (!s1) return;
    const masters = (s1.structures as any[]).filter(
      (s: any) => s?.kind === "stairs" && s.spans_to_floor === 2,
    );
    setStructures((cur: any[]) => [
      ...cur.filter((s: any) => !s?.__from_master_floor),
      ...masters.map((m: any) => ({ ...m, __from_master_floor: 1 })),
    ]);
  }, []);

  const switchActiveFloor = useCallback(
    (next: 1 | 2) => {
      if (next === activeFloor) return;
      saveActiveFloorSnapshot();
      const snap = floorSnapshotsRef.current[next];
      if (!snap) return;
      hydrateFromSnapshot(snap);
      setActiveFloor(next);
      if (next === 2) injectMastersForFloor2();
    },
    [activeFloor, saveActiveFloorSnapshot, hydrateFromSnapshot, injectMastersForFloor2],
  );


  // Runs the existing automatic stair link / floor align / footprint
  // normalization pass against the snapshots in `floorSnapshotsRef`.
  // Both floors must already be scale-calibrated to world units.
  const runAutoLinkAndAlign = useCallback(() => {
    const snap1 = floorSnapshotsRef.current[1];
    const snap2 = floorSnapshotsRef.current[2];
    if (!snap1 || !snap2) return;
    try {
      const { snap1: s1Raw, snap2: s2 } = buildMasterStairs(snap1 as any, snap2 as any);
      // With a 2-floor model, any F1 "DN" stair points to a non-existent
      // basement — strip them so we don't render orphan runs on Floor 1.
      const s1 = {
        ...s1Raw,
        structures: (s1Raw.structures as any[]).filter(
          (s: any) => !(s?.kind === "stairs" && s.direction === "DN"),
        ),
      };
      floorSnapshotsRef.current = { 1: s1 as any, 2: s2 as any };
      const visible = activeFloor === 2 ? s2 : s1;
      if (visible) hydrateFromSnapshot(visible as any);
      if (activeFloor === 2) injectMastersForFloor2();
    } catch (linkErr) {
      console.error("[stairLogic] Master Stair merge failed:", linkErr);
    } finally {
      pendingMultiFloorLinkRef.current = false;
    }
  }, [activeFloor, hydrateFromSnapshot, injectMastersForFloor2]);

  // Debounced sync: keep `floorSnapshotsRef` fresh on every edit. On Floor 2
  // this also propagates edits to injected master stairs back to Floor 1.
  useEffect(() => {
    const t = window.setTimeout(() => saveActiveFloorSnapshot(), 150);
    return () => window.clearTimeout(t);
  }, [activeFloor, structures, walls, saveActiveFloorSnapshot]);

  // Deprecated: master stairs are now injected as real editable structures
  // on Floor 2. Kept as an empty array so downstream render code is a no-op.
  const projectedMasterStairs = useMemo(() => [] as any[], []);

  // When entering 3D, capture the active floor's live edits into the snapshot
  // ref so the multi-floor 3D renderer sees the freshest state.
  useEffect(() => {
    if (viewMode !== "3D") return;
    saveActiveFloorSnapshot();
    setFloorSnapshotTick((t) => t + 1);
  }, [viewMode, saveActiveFloorSnapshot]);

  // Per-floor slices consumed by <FloorPlan3D />. The active floor is read
  // from live React state; the inactive floor comes from floorSnapshotsRef.
  const floorsData3D = useMemo(() => {
    const list: import("@/components/FloorPlan3D").FloorData[] = [];
    for (const idx of [1, 2] as const) {
      let snap: FloorSnapshot | null;
      if (idx === activeFloor) {
        snap = {
          planName,
          pixelsPerFoot,
          ceilingHeightIn,
          defaultDoorHeightIn,
          floors,
          walls,
          doors,
          windows,
          furniture,
          texts,
          structures,
          visualMetadata,
          history: { past: [], future: [] },
        };
      } else {
        snap = floorSnapshotsRef.current[idx];
      }
      if (!snap) continue;
      if (!snap.floors?.length && !snap.walls?.length) continue;
      list.push({
        floors: snap.floors,
        walls: snap.walls,
        doors: snap.doors,
        windows: snap.windows,
        furniture: snap.furniture,
        structures: snap.structures,
        ceilingHeightIn: snap.ceilingHeightIn ?? ceilingHeightIn,
      });
    }
    return list;
  }, [
    activeFloor,
    floorSnapshotTick,
    planName,
    pixelsPerFoot,
    ceilingHeightIn,
    defaultDoorHeightIn,
    floors,
    walls,
    doors,
    windows,
    furniture,
    texts,
    structures,
    visualMetadata,
  ]);

  // Merge visualMetadata from BOTH floors so the inactive floor's tints,
  // materials, and model assignments stay visible in 3D. IDs are floor-
  // prefixed so there's no conflict; the active floor's live state takes
  // precedence if any collision occurs.
  const mergedVisualMetadata3D = useMemo(() => {
    const inactive: 1 | 2 = activeFloor === 1 ? 2 : 1;
    const other = floorSnapshotsRef.current[inactive]?.visualMetadata ?? {};
    return { ...other, ...visualMetadata };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFloor, visualMetadata, floorSnapshotTick]);





  useEffect(() => {
    loadPlan(samplePlan, "Sample Plan");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // <-- Empty array forces this to only run once on page load

  // Auto-inject default materials/models for any item that's missing them.
  // Re-runs ONLY when defaults catalogs change or a new plan is loaded.
  // Live arrays are read via refs to prevent re-trigger loops if state updates
  // cause new array references each render.
  const floorsRef = useRef(floors);
  const wallsRef = useRef(walls);
  floorsRef.current = floors;
  wallsRef.current = walls;
  useEffect(() => {
    if (materialsLoading || assetsLoading) return;
    const currentFloors = floorsRef.current;
    const currentWalls = wallsRef.current;

    setVisualMetadata((m) => {
      const next = { ...m };
      let changed = false;
      if (defaultMaterials.floor) {
        const assignment = matToAssignment(defaultMaterials.floor);
        for (const f of currentFloors) {
          if (!next[f.id]?.material) {
            next[f.id] = { ...next[f.id], material: assignment };
            changed = true;
          }
        }
      }
      if (defaultMaterials.wall) {
        const assignment = matToAssignment(defaultMaterials.wall);
        for (const w of currentWalls) {
          if (!next[w.id]?.material) {
            next[w.id] = { ...next[w.id], material: assignment };
            changed = true;
          }
        }
      }
      if (defaultMaterials.baseboard) {
        const assignment = matToAssignment(defaultMaterials.baseboard);
        for (const w of currentWalls) {
          const key = `baseboard_${w.id}`;
          if (!next[key]?.material) {
            next[key] = { ...next[key], material: assignment };
            changed = true;
          }
        }
      }
      return changed ? next : m;
    });

    if (defaultAssets.door || defaultAssets.double_door) {
      setDoors((prev) => {
        let changed = false;
        const out = prev.map((d) => {
          if (d.is_arch) return d; // Arches never get a door model.
          if (d.model_url) return d;
          const url = d.is_double ? defaultAssets.double_door?.model_url : defaultAssets.door?.model_url;
          if (!url) return d;
          changed = true;
          return { ...d, model_url: url };
        });
        return changed ? out : prev;
      });
    }
    if (defaultAssets.window || defaultAssets.patio) {
      setWindows((prev) => {
        let changed = false;
        const out = prev.map((w) => {
          if (w.model_url) return w;
          const url = w.is_patio ? defaultAssets.patio?.model_url : defaultAssets.window?.model_url;
          if (!url) return w;
          changed = true;
          return { ...w, model_url: url };
        });
        return changed ? out : prev;
      });
    }
    // Intentionally exclude floors/walls/doors/windows: those refs flip on
    // every state update and would cause this effect to fire after each of
    // its own setDoors/setWindows calls. Defaults are also injected at
    // creation time and on plan load (planName dep), so this set of deps
    // covers every legitimate trigger without risking a feedback loop.
  }, [planName, defaultMaterials, defaultAssets, materialsLoading, assetsLoading, matToAssignment]);


  // Auto-fit on load
  useEffect(() => {
    if (!svgRef.current || floors.length + walls.length === 0) return;
    const pts: Pt[] = [
      ...floors.flatMap((f) => f.polygon),
      ...walls.flatMap((w) => [w.p1, w.p2]),
    ];
    if (!pts.length) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 80;
    const zoom = Math.min(
      (rect.width - padding * 2) / w,
      (rect.height - padding * 2) / h,
      2,
    );
    setViewport({
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
      zoom,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [planName]);

  const fitToView = () => {
    const pts: Pt[] = [
      ...floors.flatMap((f) => f.polygon),
      ...walls.flatMap((w) => [w.p1, w.p2]),
    ];
    if (!pts.length || !svgRef.current) return;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    const minX = Math.min(...xs),
      maxX = Math.max(...xs),
      minY = Math.min(...ys),
      maxY = Math.max(...ys);
    const w = maxX - minX,
      h = maxY - minY;
    const rect = svgRef.current.getBoundingClientRect();
    const padding = 80;
    const zoom = Math.min(
      (rect.width - padding * 2) / w,
      (rect.height - padding * 2) / h,
      2,
    );
    setViewport({
      x: rect.width / 2 - ((minX + maxX) / 2) * zoom,
      y: rect.height / 2 - ((minY + maxY) / 2) * zoom,
      zoom,
    });
  };

  const deleteSelectedItem = () => {
    if (!selectedId) return;
    pushHistory();
    // Non-blocking: React can interrupt the 3D-tree reconciliation for pointer
    // events while the deletion propagates through the memoized mesh graph.
    startTransition(() => {
      setFloors((p) => p.filter((f) => f.id !== selectedId));
      setWalls((p) => p.filter((w) => w.id !== selectedId));
      setDoors((p) => p.filter((d) => d.id !== selectedId));
      setWindows((p) => p.filter((w) => w.id !== selectedId));
      setFurniture((p) => p.filter((f) => f.id !== selectedId));
      setTexts((p) => p.filter((t) => t.id !== selectedId));
      setStructures((p) => p.filter((s) => s.id !== selectedId));
      setSelectedId(null);
    });
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const inInput = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement).tagName);
      if (e.key === "Escape" && calibrationState.active) {
        setCalibrationState({ active: false, point1: null });
        return;
      }
      if (e.key === "Escape" && drawMode) {
        setDrawMode(null);
        setDrawMenuOpen(false);
        setFurnitureMenuOpen(false);
        setFurnitureSubmenu(null);
        setStairsSubmenuOpen(false);
        setPendingStairShape(null);
        setPendingFurniture(null);
        setWallDraftStart(null);
        setRoomDraft([]);
        setStructureDraftStart(null);
        setDrawPreview(null);
        setSnapIndicator(null);
        return;
      }
      if (e.key === "Escape" && (drawMenuOpen || furnitureMenuOpen || stairsSubmenuOpen)) {
        setDrawMenuOpen(false);
        setFurnitureMenuOpen(false);
        setFurnitureSubmenu(null);
        setStairsSubmenuOpen(false);
        return;
      }
      if (e.key === "Escape" && !inInput && (selectedId || selection3D)) {
        setSelectedId(null);
        setSelection3D(null);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        redo();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c" && !inInput) {
        const w = walls.find((x) => x.id === selectedId);
        if (w) {
          e.preventDefault();
          setClipboardItem({ kind: "wall", data: JSON.parse(JSON.stringify(w)) });
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "v" && !inInput) {
        if (clipboardItem && clipboardItem.kind === "wall") {
          e.preventDefault();
          const src = clipboardItem.data;
          const cx = (src.p1.x + src.p2.x) / 2;
          const cy = (src.p1.y + src.p2.y) / 2;
          const dx = mousePos.x - cx;
          const dy = mousePos.y - cy;
          const newId = generateId("wall");
          pushHistory();
          setWalls((prev) => [
            ...prev,
            {
              ...src,
              id: newId,
              p1: { x: src.p1.x + dx, y: src.p1.y + dy },
              p2: { x: src.p2.x + dx, y: src.p2.y + dy },
            },
          ]);
          setSelectedId(newId);
        }
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !inInput) {
        deleteSelectedItem();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedId, selection3D, calibrationState.active, drawMode, drawMenuOpen, undo, redo, walls, clipboardItem, mousePos]);

  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (toolbarRef.current && !toolbarRef.current.contains(e.target as Node)) {
        setDrawMenuOpen(false);
        setStairsSubmenuOpen(false);
        setFurnitureMenuOpen(false);
        setFurnitureSubmenu(null);
      }
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, []);

  useEffect(() => {
    const svgElement = svgRef.current;
    if (!svgElement) return;
    const handleNativeWheel = (e: WheelEvent) => {
      if (e.cancelable) e.preventDefault();
      const rect = svgElement.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const zoomDirection = e.deltaY > 0 ? -1 : 1;
      setViewport((prev) => {
        const newZoom = Math.max(0.05, prev.zoom + zoomDirection * CONFIG.zoomSpeed * prev.zoom);
        const scaleRatio = newZoom / prev.zoom;
        return {
          x: mouseX - (mouseX - prev.x) * scaleRatio,
          y: mouseY - (mouseY - prev.y) * scaleRatio,
          zoom: newZoom,
        };
      });
    };
    svgElement.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => svgElement.removeEventListener("wheel", handleNativeWheel);
  }, [viewMode]);

  const zoomIn = () =>
    setViewport((p) => ({ ...p, zoom: Math.min(p.zoom * 1.25, 20) }));
  const zoomOut = () =>
    setViewport((p) => ({ ...p, zoom: Math.max(p.zoom / 1.25, 0.05) }));

  const openCalibDialog = (title: string, distancePx: number, placeholder: string) => {
    setCalibDialog({ open: true, title, distancePx, placeholder, value: "" });
  };

  const confirmCalibDialog = () => {
    const distFt = parseDimensionInput(calibDialog.value);
    if (distFt && calibDialog.distancePx > 0) {
      pushHistory();

      // --- 1) Compute scale: image px → world px ---
      const measuredPpf = calibDialog.distancePx / distFt;
      const scaleFactor = PIXELS_PER_WORLD_FOOT / measuredPpf;
      const wallThickWorld = DEFAULT_WALL_THICKNESS_IN * PIXELS_PER_WORLD_INCH;

      // --- 2) First pass: rescale all coordinates into world units ---
      const sFloors = floors.map((f) => ({
        ...f,
        polygon: f.polygon.map((p) => ({ x: p.x * scaleFactor, y: p.y * scaleFactor })),
      }));
      const sWalls = walls.map((w) => ({
        ...w,
        p1: { x: w.p1.x * scaleFactor, y: w.p1.y * scaleFactor },
        p2: { x: w.p2.x * scaleFactor, y: w.p2.y * scaleFactor },
        thickness: wallThickWorld,
      }));

      // Snap windows/patios to nearest nominal width in world units
      const sWindows = windows.map((win) => {
        const sCenter = { x: win.center.x * scaleFactor, y: win.center.y * scaleFactor };
        const widthIn = (win.width * scaleFactor) / PIXELS_PER_WORLD_INCH;
        const sizes = win.is_patio ? PATIO_SIZES_IN : WINDOW_SIZES_IN;
        const nearestIn = nearestSize(widthIn, sizes);
        return {
          ...win,
          center: sCenter,
          width: nearestIn * PIXELS_PER_WORLD_INCH,
          thickness: wallThickWorld,
        };
      });

      // Snap doors / double doors to nearest nominal width in world units
      const sDoors = doors.map((door) => {
        const hinge = { x: door.hinge.x * scaleFactor, y: door.hinge.y * scaleFactor };
        const strike = { x: door.strike.x * scaleFactor, y: door.strike.y * scaleFactor };
        const leaf = { x: door.leaf.x * scaleFactor, y: door.leaf.y * scaleFactor };
        const dx = strike.x - hinge.x;
        const dy = strike.y - hinge.y;
        const strikeDist = Math.hypot(dx, dy) || door.width * scaleFactor || 1;
        const rawIn = strikeDist / PIXELS_PER_WORLD_INCH;
        const sizes = door.is_double ? DOUBLE_DOOR_SIZES_IN : DOOR_SIZES_IN;
        const newWidthPx = nearestSize(rawIn, sizes) * PIXELS_PER_WORLD_INCH;
        const ux = dx / strikeDist;
        const uy = dy / strikeDist;
        const cross = dx * (leaf.y - hinge.y) - dy * (leaf.x - hinge.x);
        const side = cross >= 0 ? 1 : -1;
        const nx = -uy * side;
        const ny = ux * side;
        return {
          ...door,
          width: newWidthPx,
          hinge,
          strike: { x: hinge.x + ux * newWidthPx, y: hinge.y + uy * newWidthPx },
          leaf: { x: hinge.x + nx * newWidthPx, y: hinge.y + ny * newWidthPx },
        };
      });

      const sFurniture = furniture
        .map((f) => ({
          ...f,
          corners: f.corners.map((c) => ({ x: c.x * scaleFactor, y: c.y * scaleFactor })),
          back_edge: f.back_edge
            ? {
                p1: { x: f.back_edge.p1.x * scaleFactor, y: f.back_edge.p1.y * scaleFactor },
                p2: { x: f.back_edge.p2.x * scaleFactor, y: f.back_edge.p2.y * scaleFactor },
              }
            : undefined,
        }))
        .map((f) => snapFurnitureDimensions(f, PIXELS_PER_WORLD_FOOT));
      const sTexts = texts.map((t) => ({
        ...t,
        x: t.x * scaleFactor,
        y: t.y * scaleFactor,
      }));

      const sStructures = structures.map((s) => {
        if (s.kind === "railing") {
          return {
            ...s,
            p1: { x: s.p1.x * scaleFactor, y: s.p1.y * scaleFactor },
            p2: { x: s.p2.x * scaleFactor, y: s.p2.y * scaleFactor },
            thickness: DEFAULT_RAILING_THICKNESS_IN * PIXELS_PER_WORLD_INCH,
          };
        }
        return {
          ...s,
          polygon: s.polygon.map((p) => ({ x: p.x * scaleFactor, y: p.y * scaleFactor })),
          rotation_anchor: s.rotation_anchor
            ? { x: s.rotation_anchor.x * scaleFactor, y: s.rotation_anchor.y * scaleFactor }
            : undefined,
        };
      });

      // --- 3) Center the plan in the world viewport ---
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      const acc = (p: Pt) => {
        if (p.x < minX) minX = p.x;
        if (p.y < minY) minY = p.y;
        if (p.x > maxX) maxX = p.x;
        if (p.y > maxY) maxY = p.y;
      };
      sFloors.forEach((f) => f.polygon.forEach(acc));
      sWalls.forEach((w) => { acc(w.p1); acc(w.p2); });
      sFurniture.forEach((f) => f.corners.forEach(acc));
      sTexts.forEach((t) => acc({ x: t.x, y: t.y }));

      // ADDED THIS: Include structures in bounding box
      sStructures.forEach((s) => {
        if (s.kind === "railing") { acc(s.p1); acc(s.p2); }
        else { s.polygon.forEach(acc); }
      });


      if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 0; maxY = 0; }

      const worldW = CANVAS_WORLD_WIDTH_FT * PIXELS_PER_WORLD_FOOT;
      const worldH = CANVAS_WORLD_HEIGHT_FT * PIXELS_PER_WORLD_FOOT;
      const offX = (worldW - (maxX - minX)) / 2 - minX;
      const offY = (worldH - (maxY - minY)) / 2 - minY;
      const shift = (p: Pt): Pt => ({ x: p.x + offX, y: p.y + offY });

      const finalFloors = sFloors.map((f) => ({ ...f, polygon: f.polygon.map(shift) }));
      const finalWalls = sWalls.map((w) => ({ ...w, p1: shift(w.p1), p2: shift(w.p2) }));
      const finalWindows = sWindows.map((w) => ({ ...w, center: shift(w.center) }));
      const finalDoors = sDoors.map((d) => ({
        ...d,
        hinge: shift(d.hinge),
        strike: shift(d.strike),
        leaf: shift(d.leaf),
      }));
      const finalFurniture = sFurniture.map((f) => ({
        ...f,
        corners: f.corners.map(shift),
        back_edge: f.back_edge
          ? { p1: shift(f.back_edge.p1), p2: shift(f.back_edge.p2) }
          : undefined,
      }));
      const finalTexts = sTexts.map((t) => ({ ...t, ...shift({ x: t.x, y: t.y }) }));
      const finalStructures = sStructures.map((s) => {
        if (s.kind === "railing") {
          return { ...s, p1: shift(s.p1), p2: shift(s.p2) };
        }
        return {
          ...s,
          polygon: s.polygon.map(shift),
          rotation_anchor: s.rotation_anchor ? shift(s.rotation_anchor) : undefined,
        };
      });

      setFloors(finalFloors);
      setWalls(finalWalls);
      setWindows(finalWindows);
      setDoors(finalDoors);
      setFurniture(finalFurniture);
      setTexts(finalTexts);
      setStructures(finalStructures);
      setPixelsPerFoot(PIXELS_PER_WORLD_FOOT);

      // --- 4) Fit the canvas viewport to the world bounding box ---
      const rect = svgRef.current?.getBoundingClientRect();
      if (rect && rect.width > 0 && rect.height > 0) {
        const zoom = Math.min(rect.width / worldW, rect.height / worldH) * 0.95;
        setViewport({
          zoom,
          x: (rect.width - worldW * zoom) / 2,
          y: (rect.height - worldH * zoom) / 2,
        });
      }

      // --- 5) Persist the calibrated snapshot for the active floor ---
      floorSnapshotsRef.current[activeFloor] = {
        planName,
        pixelsPerFoot: PIXELS_PER_WORLD_FOOT,
        ceilingHeightIn,
        defaultDoorHeightIn,
        floors: finalFloors,
        walls: finalWalls,
        doors: finalDoors,
        windows: finalWindows,
        furniture: finalFurniture,
        texts: finalTexts,
        structures: finalStructures,
        visualMetadata,
        history: {
          past: [...historyRef.current.past],
          future: [...historyRef.current.future],
        },
      };
      calibratedFloorsRef.current.add(activeFloor);

      // --- 6) Sequence multi-floor calibration: F1 → F2 → auto-math ---
      if (
        uploadedFloorCount === 2 &&
        activeFloor === 1 &&
        !calibratedFloorsRef.current.has(2)
      ) {
        // Switch to Floor 2 and prompt for its calibration.
        const snap2 = floorSnapshotsRef.current[2];
        if (snap2) {
          hydrateFromSnapshot(snap2);
          setActiveFloor(2);
          // Defer prompt so the dialog close animation can settle.
          setTimeout(() => setScalePromptOpen(true), 0);
        }
      } else if (
        uploadedFloorCount === 2 &&
        activeFloor === 2 &&
        pendingMultiFloorLinkRef.current &&
        calibratedFloorsRef.current.has(1) &&
        calibratedFloorsRef.current.has(2)
      ) {
        // Both floors calibrated — run the deferred auto-link / align pass.
        setTimeout(() => runAutoLinkAndAlign(), 0);
      }
    }
    setCalibDialog((c) => ({ ...c, open: false }));
    setCalibrationState({ active: false, point1: null });
  };

  const handleItemClick = (e: React.PointerEvent, id: string, type: string) => {
    if (drawMode) return;
    e.stopPropagation();
    if (calibrationState.active) {
      if (type === "window") {
        const win = windows.find((w) => w.id === id);
        if (win) openCalibDialog("Set window width", win.width, "e.g. 4' 0\"");
      }
      return;
    }
    setSelectedId(id);
  };

  const handleHandleDown = (
    e: React.PointerEvent,
    id: string,
    pointIndex: "p1" | "p2" | number,
    type: "wall" | "floor" | "railing",
  ) => {
    if (drawMode) return;
    e.stopPropagation();
    if (calibrationState.active && type === "wall") {
      const wall = walls.find((w) => w.id === id);
      if (!wall) return;
      const pt = pointIndex === "p1" ? wall.p1 : wall.p2;
      if (!calibrationState.point1) {
        setCalibrationState({ active: true, point1: pt });
      } else {
        const distPx = Math.hypot(
          pt.x - calibrationState.point1.x,
          pt.y - calibrationState.point1.y,
        );
        openCalibDialog("Set scale by known dimension", distPx, "e.g. 10' 6\"");
      }
      return;
    }
    pushHistory();
    setActiveDrag({ id, pointIndex, type });
    setSelectedId(id);
  };

  const handleWallBodyDown = (e: React.PointerEvent, wall: Wall) => {
    if (drawMode) return;
    e.stopPropagation();
    if (calibrationState.active) {
      setSelectedId(wall.id);
      return;
    }
    const sp = getSvgPoint(e.clientX, e.clientY);
    if (!sp) {
      setSelectedId(wall.id);
      return;
    }
    pushHistory();
    setSelectedId(wall.id);
    setActiveDrag({
      id: wall.id,
      type: "wall-body",
      startSvg: sp,
      origP1: { ...wall.p1 },
      origP2: { ...wall.p2 },
    });
  };



  const handlePointerUp = () => {
    setActiveDrag(null);
    setIsPanning(false);
    setSnapIndicator(null);
    setAlignmentGuides([]);
  };

  const getSvgPoint = (clientX: number, clientY: number): Pt | null => {
    const svg = svgRef.current;
    if (!svg || !innerGRef.current) return null;
    const point = svg.createSVGPoint();
    point.x = clientX;
    point.y = clientY;
    const ctm = innerGRef.current.getScreenCTM();
    if (!ctm) return null;
    const sp = point.matrixTransform(ctm.inverse());
    return { x: sp.x, y: sp.y };
  };

  // Snap to wall/railing endpoints + along segments (used for free wall & railing drawing)
  const snapWallEndpoint = (x: number, y: number, excludeId?: string): Pt | null => {
    const snapWorld = CONFIG.snapDistancePx / viewport.zoom;
    // Endpoints get a larger gravitational radius so they win over along-segment snap.
    const endpointSnapWorld = snapWorld * 2.5;
    type Hit = { pt: Pt; d: number };
    let bestEndpoint: Hit | null = null;
    let bestSegment: Hit | null = null;
    const consider = (p1: Pt, p2: Pt, id: string) => {
      if (excludeId && id === excludeId) return;
      for (const pt of [p1, p2]) {
        const d = Math.hypot(pt.x - x, pt.y - y);
        if (d < endpointSnapWorld && (!bestEndpoint || d < bestEndpoint.d)) bestEndpoint = { pt, d };
      }
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) return;
      let t = ((x - p1.x) * dx + (y - p1.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = p1.x + t * dx;
      const py = p1.y + t * dy;
      const d = Math.hypot(px - x, py - y);
      if (d < snapWorld && (!bestSegment || d < bestSegment.d)) bestSegment = { pt: { x: px, y: py }, d };
    };
    for (const w of walls) consider(w.p1, w.p2, w.id);
    for (const s of structures) {
      if (s.kind === "railing") consider(s.p1, s.p2, s.id);
    }
    if (bestEndpoint) return (bestEndpoint as Hit).pt;
    return bestSegment ? (bestSegment as Hit).pt : null;
  };

  // Project (x,y) onto nearest wall — for door/window placement
  const nearestWallProjection = (x: number, y: number) => {
    let best: { pt: Pt; angle: number; thickness: number; d: number; wall: Wall } | null = null;
    for (const w of walls) {
      const dx = w.p2.x - w.p1.x;
      const dy = w.p2.y - w.p1.y;
      const len2 = dx * dx + dy * dy;
      if (len2 === 0) continue;
      let t = ((x - w.p1.x) * dx + (y - w.p1.y) * dy) / len2;
      t = Math.max(0, Math.min(1, t));
      const px = w.p1.x + t * dx;
      const py = w.p1.y + t * dy;
      const d = Math.hypot(px - x, py - y);
      if (!best || d < best.d) {
        best = { pt: { x: px, y: py }, angle: Math.atan2(dy, dx), thickness: w.thickness, d, wall: w };
      }
    }
    return best;
  };

  // Snap with midpoint of nearest wall (for door/window placement)
  const projectForPlacement = (x: number, y: number) => {
    const best = nearestWallProjection(x, y);
    if (!best) return null;
    const snapWorld = CONFIG.snapDistancePx / viewport.zoom;
    const mx = (best.wall.p1.x + best.wall.p2.x) / 2;
    const my = (best.wall.p1.y + best.wall.p2.y) / 2;
    if (Math.hypot(best.pt.x - mx, best.pt.y - my) < snapWorld) {
      return { ...best, pt: { x: mx, y: my } };
    }
    return best;
  };

  const handleBackgroundDown = (e: React.PointerEvent) => {
    // Middle-mouse-button always pans the canvas (works in any tool/drawMode)
    if (e.button === 1) {
      e.preventDefault();
      setIsPanning(true);
      return;
    }
    // Only respond to left-button below
    if (e.button !== 0) return;
    // Drawing modes intercept clicks
    if (drawMode) {
      const sp = getSvgPoint(e.clientX, e.clientY);
      if (!sp) return;
      e.stopPropagation();
      if (drawMode === "wall") {
        let fx = sp.x, fy = sp.y;
        if (!e.shiftKey && wallDraftStart) {
          const s = snapAngle45(wallDraftStart, fx, fy);
          fx = s.x; fy = s.y;
        }
        const snap = snapWallEndpoint(fx, fy);
        if (snap) { fx = snap.x; fy = snap.y; }
        else {
          const ag = computeAlignmentSnap(fx, fy);
          fx = ag.x; fy = ag.y;
        }
        if (!wallDraftStart) {
          setWallDraftStart({ x: fx, y: fy });
        } else {
          if (Math.hypot(fx - wallDraftStart.x, fy - wallDraftStart.y) > 1) {
            pushHistory();
            const newWallId = generateId("wall");
            setWalls((prev) => [
              ...prev,
              {
                id: newWallId,
                thickness: inchesToPx(4),
                p1: wallDraftStart,
                p2: { x: fx, y: fy },
              },
            ]);
            // Auto-assign default wall + baseboard materials
            setVisualMetadata((m) => {
              const next = { ...m };
              if (defaultMaterials.wall) {
                next[newWallId] = { ...next[newWallId], material: matToAssignment(defaultMaterials.wall) };
              }
              if (defaultMaterials.baseboard) {
                const bbKey = `baseboard_${newWallId}`;
                next[bbKey] = { ...next[bbKey], material: matToAssignment(defaultMaterials.baseboard) };
              }
              return next;
            });
          }
          // Chain: keep drawing from the just-placed endpoint so the user
          // can quickly form a connected shape. Press Escape (or toggle the
          // Draw Wall tool) to stop.
          setWallDraftStart({ x: fx, y: fy });
        }
        return;
      }
      if (drawMode === "room") {
        let fx = sp.x, fy = sp.y;
        if (!e.shiftKey && roomDraft.length > 0) {
          const s = snapAngle45(roomDraft[roomDraft.length - 1], fx, fy);
          fx = s.x; fy = s.y;
        }
        const snap = snapWallEndpoint(fx, fy);
        if (snap) { fx = snap.x; fy = snap.y; }
        else {
          const ag = computeAlignmentSnap(fx, fy);
          fx = ag.x; fy = ag.y;
        }
        // Close polygon if clicking near start (and have at least 3 pts)
        if (roomDraft.length >= 3) {
          const start = roomDraft[0];
          const closeDistWorld = 12 / viewport.zoom;
          if (Math.hypot(fx - start.x, fy - start.y) <= closeDistWorld) {
            pushHistory();
            const newId = `f${activeFloor}_${generateId("floor")}`;
            setFloors((prev) => [...prev, { id: newId, polygon: [...roomDraft] }]);
            setRoomDraft([]);
            setSelectedId(newId);
            setAlignmentGuides([]);
            return;
          }
        }
        setRoomDraft((prev) => [...prev, { x: fx, y: fy }]);
        return;
      }
      if (drawMode === "door" || drawMode === "double_door" || drawMode === "arch" || drawMode === "window" || drawMode === "patio") {
        const best = projectForPlacement(sp.x, sp.y);
        if (!best) return;
        pushHistory();
        if (drawMode === "door" || drawMode === "double_door" || drawMode === "arch") {
          const isArch = drawMode === "arch";
          const isDouble = drawMode === "double_door";
          const widthPx = isDouble ? inchesToPx(60) : isArch ? inchesToPx(36) : inchesToPx(30);
          const ux = Math.cos(best.angle), uy = Math.sin(best.angle);
          const nx = -uy, ny = ux;
          const c = best.pt;
          const hinge = { x: c.x - ux * widthPx / 2, y: c.y - uy * widthPx / 2 };
          const strike = { x: c.x + ux * widthPx / 2, y: c.y + uy * widthPx / 2 };
          const leaf = { x: hinge.x + nx * widthPx, y: hinge.y + ny * widthPx };
          const newId = generateId(isArch ? "arch" : "door");
          setDoors((prev) => [
            ...prev,
            {
              id: newId,
              thickness: best.thickness,
              width: widthPx,
              hinge,
              strike,
              leaf,
              height_in: 80,
              flipX: false,
              flipY: false,
              open: isArch ? false : true,
              is_double: isDouble,
              is_arch: isArch,
              model_url: isArch ? undefined : isDouble ? defaultAssets.double_door?.model_url : defaultAssets.door?.model_url,
            },
          ]);
          setSelectedId(newId);
        } else {
          const widthPx = drawMode === "patio" ? inchesToPx(72) : inchesToPx(36); // 6'-0" or 3'-0"
          const newId = generateId("window");
          setWindows((prev) => [
            ...prev,
            {
              id: newId,
              thickness: best.thickness,
              width: widthPx,
              center: best.pt,
              rotation_rad: best.angle,
              height_in: drawMode === "patio" ? 80 : 60,
              sill_height_in: drawMode === "patio" ? 0 : 24,
              dist_from_ceiling_in: drawMode === "patio" ? undefined : 24,
              is_patio: drawMode === "patio",
              model_url: drawMode === "patio" ? defaultAssets.patio?.model_url : defaultAssets.window?.model_url,
            },
          ]);
          setSelectedId(newId);
        }
        return;
      }
      if (drawMode === "text") {
        pushHistory();
        const newId = generateId("text");
        setTexts((prev) => [
          ...prev,
          { id: newId, type: "label", text: "Label", x: sp.x, y: sp.y, fontSize: 7 },
        ]);
        setSelectedId(newId);
        setEditingTextId(newId);
        setDrawMode(null);
        return;
      }
      if (drawMode === "furniture" && pendingFurniture) {
        pushHistory();
        const wPx = pendingFurniture.widthIn * PIXELS_PER_WORLD_INCH;
        const lPx = pendingFurniture.lengthIn * PIXELS_PER_WORLD_INCH;
        // Anchor (back-edge center) at click. Footprint extends forward (down +y).
        const ax = sp.x, ay = sp.y;
        const corners: Pt[] = [
          { x: ax - wPx / 2, y: ay },           // back-left
          { x: ax + wPx / 2, y: ay },           // back-right
          { x: ax + wPx / 2, y: ay + lPx },     // front-right
          { x: ax - wPx / 2, y: ay + lPx },     // front-left
        ];
        const newId = generateId("furniture");
        setFurniture((prev) => [
          ...prev,
          {
            id: newId,
            type: pendingFurniture.type,
            is_L_shaped: false,
            corners,
            back_edge: { p1: corners[0], p2: corners[1] },
            angle_deg: 0,
          },
        ]);
        setSelectedId(newId);
        setDrawMode(null);
        setPendingFurniture(null);
        return;
      }
      if (drawMode === "stairs" && pendingStairShape) {
        pushHistory();
        const width_in = DEFAULT_STAIR_WIDTH_IN;
        const widthPx = inchesToPx(width_in);
        // Default dimensions per shape (in inches)
        let bboxW = 0, bboxH = 0;
        if (pendingStairShape === "straight") {
          bboxW = inchesToPx(120); // 10ft length
          bboxH = widthPx;          // 3ft width
        } else if (pendingStairShape === "L") {
          // legs of 5ft (60") each; bbox side = leg + width
          bboxW = inchesToPx(60) + widthPx;
          bboxH = inchesToPx(60) + widthPx;
        } else {
          // U: legs 5ft, gap 2ft → bbox: width = 2*stairW + gap, height = leg + stairW
          bboxW = widthPx * 2 + inchesToPx(24);
          bboxH = inchesToPx(60) + widthPx;
        }
        const bbox = { x: sp.x - bboxW / 2, y: sp.y - bboxH / 2, w: bboxW, h: bboxH };
        const polygon = buildStairPolygonForShape(pendingStairShape, bbox, widthPx);
        const newId = generateId("stairs");
        setStructures((prev) => [
          ...prev,
          { id: newId, kind: "stairs", polygon, shape: pendingStairShape, width_in, rotation_anchor: polygonBboxCenter(polygon) },
        ]);
        setSelectedId(newId);
        setDrawMode(null);
        setPendingStairShape(null);
        return;
      }
      if (drawMode === "railing") {
        // Wall-like two-click line (with optional shift to disable 45° lock).
        let fx = sp.x, fy = sp.y;
        if (!e.shiftKey && structureDraftStart) {
          const s = snapAngle45(structureDraftStart, fx, fy);
          fx = s.x; fy = s.y;
        }
        const snap = snapWallEndpoint(fx, fy);
        if (snap) { fx = snap.x; fy = snap.y; }
        else {
          const ag = computeAlignmentSnap(fx, fy);
          fx = ag.x; fy = ag.y;
        }
        if (!structureDraftStart) {
          setStructureDraftStart({ x: fx, y: fy });
        } else {
          if (Math.hypot(fx - structureDraftStart.x, fy - structureDraftStart.y) > 1) {
            pushHistory();
            const newId = generateId("railing");
            setStructures((prev) => [
              ...prev,
              {
                id: newId,
                kind: "railing",
                p1: structureDraftStart,
                p2: { x: fx, y: fy },
                thickness: inchesToPx(DEFAULT_RAILING_THICKNESS_IN),
              },
            ]);
          }
          // Chain: keep drawing from the just-placed endpoint, like walls.
          // Press Escape (or toggle the Add Railing tool) to stop.
          setStructureDraftStart({ x: fx, y: fy });
        }
        return;
      }
    }
    // Default behavior (Pan tool): clicking blank canvas deselects and starts panning
    setSelectedId(null);
    setIsPanning(true);
  };


  const handlePointerMove = (e: React.PointerEvent) => {
    if (isPanning) {
      setViewport((p) => ({ ...p, x: p.x + e.movementX, y: p.y + e.movementY }));
      return;
    }
    const svgPoint = getSvgPoint(e.clientX, e.clientY);
    if (!svgPoint) return;

    setMousePos(svgPoint);

    // Drawing mode preview
    if (drawMode && !activeDrag) {
      let activeGuides: Array<{ axis: "x" | "y"; coord: number }> = [];
      if (drawMode === "wall") {
        let fx = svgPoint.x, fy = svgPoint.y;
        if (!e.shiftKey && wallDraftStart) {
          const s = snapAngle45(wallDraftStart, fx, fy);
          fx = s.x; fy = s.y;
        }
        const snap = snapWallEndpoint(fx, fy);
        if (snap) { fx = snap.x; fy = snap.y; setSnapIndicator(snap); }
        else {
          const ag = computeAlignmentSnap(fx, fy);
          fx = ag.x; fy = ag.y;
          activeGuides = ag.guides;
          setSnapIndicator(null);
        }
        setDrawPreview({ kind: "wall", pt: { x: fx, y: fy } });
      } else if (drawMode === "room") {
        let fx = svgPoint.x, fy = svgPoint.y;
        if (!e.shiftKey && roomDraft.length > 0) {
          const s = snapAngle45(roomDraft[roomDraft.length - 1], fx, fy);
          fx = s.x; fy = s.y;
        }
        const snap = snapWallEndpoint(fx, fy);
        if (snap) { fx = snap.x; fy = snap.y; setSnapIndicator(snap); }
        else if (roomDraft.length >= 3) {
          const start = roomDraft[0];
          const closeDistWorld = 12 / viewport.zoom;
          if (Math.hypot(fx - start.x, fy - start.y) <= closeDistWorld) {
            setSnapIndicator(start);
          } else {
            const ag = computeAlignmentSnap(fx, fy);
            fx = ag.x; fy = ag.y;
            activeGuides = ag.guides;
            setSnapIndicator(null);
          }
        } else {
          const ag = computeAlignmentSnap(fx, fy);
          fx = ag.x; fy = ag.y;
          activeGuides = ag.guides;
          setSnapIndicator(null);
        }
        // Update mousePos to reflect snap so rubber-band line follows guides
        setMousePos({ x: fx, y: fy });
        setDrawPreview(null);
      } else if (drawMode === "railing") {
        // Apply Shift-disables-axis-lock + wall/railing endpoint snapping + alignment guides
        let fx = svgPoint.x, fy = svgPoint.y;
        if (!e.shiftKey && structureDraftStart) {
          const s = snapAngle45(structureDraftStart, fx, fy);
          fx = s.x; fy = s.y;
        }
        const snap = snapWallEndpoint(fx, fy);
        if (snap) { fx = snap.x; fy = snap.y; setSnapIndicator(snap); }
        else {
          const ag = computeAlignmentSnap(fx, fy);
          fx = ag.x; fy = ag.y;
          activeGuides = ag.guides;
          setSnapIndicator(null);
        }
        setMousePos({ x: fx, y: fy });
        setDrawPreview(null);
      } else if (drawMode === "text" || drawMode === "furniture" || drawMode === "stairs") {
        setDrawPreview(null);
        setSnapIndicator(null);
      } else {
        const best = projectForPlacement(svgPoint.x, svgPoint.y);
        if (best) {
          const ag = computeAlignmentSnap(best.pt.x, best.pt.y);
          activeGuides = ag.guides;
          setDrawPreview({ kind: drawMode, pt: best.pt, angle: best.angle, thickness: best.thickness });
          setSnapIndicator(best.pt);
        } else {
          setDrawPreview(null);
          setSnapIndicator(null);
        }
      }
      setAlignmentGuides(activeGuides);
      return;
    }
    if (alignmentGuides.length > 0) setAlignmentGuides([]);


    if (!activeDrag) return;
    const isShiftPressed = e.shiftKey;
    // Axis lock is the DEFAULT for drag operations; holding Shift unlocks it.
    const axisLock = !e.shiftKey;

    // Snap to other walls: endpoints AND nearest point along the segment
    const snapWorld = CONFIG.snapDistancePx / viewport.zoom;
    const findSnap = (x: number, y: number): Pt | null => {
      let best: { pt: Pt; d: number } | null = null;
      const consider = (p1: Pt, p2: Pt, id: string, kind: "wall" | "railing") => {
        if (kind === "wall" && activeDrag.type === "wall" && id === activeDrag.id) return;
        if (kind === "railing" && (activeDrag.type === "railing" || activeDrag.type === "railing-body") && id === activeDrag.id) return;
        // endpoints (priority)
        for (const pt of [p1, p2]) {
          const d = Math.hypot(pt.x - x, pt.y - y);
          if (d < snapWorld && (!best || d < best.d)) best = { pt, d };
        }
        // perpendicular projection onto segment
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) return;
        let t = ((x - p1.x) * dx + (y - p1.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = p1.x + t * dx;
        const py = p1.y + t * dy;
        const d = Math.hypot(px - x, py - y);
        if (d < snapWorld && (!best || d < (best as { pt: Pt; d: number }).d - 0.5)) best = { pt: { x: px, y: py }, d };
      };
      for (const w of walls) consider(w.p1, w.p2, w.id, "wall");
      for (const s of structures) {
        if (s.kind === "railing") consider(s.p1, s.p2, s.id, "railing");
      }
      return best ? (best as { pt: Pt; d: number }).pt : null;
    };

    if (activeDrag.type === "wall-body") {
      const drag = activeDrag;
      let dx = svgPoint.x - drag.startSvg.x;
      let dy = svgPoint.y - drag.startSvg.y;
      if (axisLock) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      setWalls((prev) =>
        prev.map((wall) =>
          wall.id !== drag.id
            ? wall
            : {
                ...wall,
                p1: { x: drag.origP1.x + dx, y: drag.origP1.y + dy },
                p2: { x: drag.origP2.x + dx, y: drag.origP2.y + dy },
              },
        ),
      );
      setSnapIndicator(null);
      return;
    }
    if (activeDrag.type === "furniture-body") {
      const drag = activeDrag;
      let dx = svgPoint.x - drag.startSvg.x;
      let dy = svgPoint.y - drag.startSvg.y;
      if (isShiftPressed) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      // Compute anchor (back-edge center, or centroid) at the new position and snap to nearby walls/openings
      const origAnchor = drag.origBackEdge
        ? {
            x: (drag.origBackEdge.p1.x + drag.origBackEdge.p2.x) / 2,
            y: (drag.origBackEdge.p1.y + drag.origBackEdge.p2.y) / 2,
          }
        : {
            x: drag.origCorners.reduce((s, p) => s + p.x, 0) / drag.origCorners.length,
            y: drag.origCorners.reduce((s, p) => s + p.y, 0) / drag.origCorners.length,
          };
      const newAnchorX = origAnchor.x + dx;
      const newAnchorY = origAnchor.y + dy;
      const ag = computeAlignmentSnap(newAnchorX, newAnchorY);
      const adjDx = ag.x - origAnchor.x;
      const adjDy = ag.y - origAnchor.y;
      setAlignmentGuides(ag.guides);
      setFurniture((prev) =>
        prev.map((f) =>
          f.id !== drag.id
            ? f
            : {
                ...f,
                corners: drag.origCorners.map((c) => ({ x: c.x + adjDx, y: c.y + adjDy })),
                back_edge: drag.origBackEdge
                  ? {
                      p1: { x: drag.origBackEdge.p1.x + adjDx, y: drag.origBackEdge.p1.y + adjDy },
                      p2: { x: drag.origBackEdge.p2.x + adjDx, y: drag.origBackEdge.p2.y + adjDy },
                    }
                  : f.back_edge,
              },
        ),
      );
      setSnapIndicator(null);
      return;
    }
    if (activeDrag.type === "furniture-rotate") {
      const drag = activeDrag;
      const curAngle = Math.atan2(svgPoint.y - drag.cy, svgPoint.x - drag.cx) * (180 / Math.PI);
      let delta = curAngle - drag.startAngle;
      const step = isShiftPressed ? 1 : 15;
      delta = Math.round(delta / step) * step;
      const rad = (delta * Math.PI) / 180;
      const cos = Math.cos(rad), sin = Math.sin(rad);
      const rotPt = (p: Pt): Pt => ({
        x: drag.cx + (p.x - drag.cx) * cos - (p.y - drag.cy) * sin,
        y: drag.cy + (p.x - drag.cx) * sin + (p.y - drag.cy) * cos,
      });
      setFurniture((prev) =>
        prev.map((f) =>
          f.id !== drag.id
            ? f
            : {
                ...f,
                corners: drag.origCorners.map(rotPt),
                back_edge: drag.origBackEdge
                  ? { p1: rotPt(drag.origBackEdge.p1), p2: rotPt(drag.origBackEdge.p2) }
                  : f.back_edge,
                angle_deg: drag.origItemAngle + delta,
              },
        ),
      );
      setSnapIndicator(null);
      return;
    }
    if (activeDrag.type === "text-body") {
      const drag = activeDrag;
      let dx = svgPoint.x - drag.startSvg.x;
      let dy = svgPoint.y - drag.startSvg.y;
      if (axisLock) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0;
        else dx = 0;
      }
      setTexts((prev) =>
        prev.map((t) =>
          t.id !== drag.id ? t : { ...t, x: drag.origX + dx, y: drag.origY + dy },
        ),
      );
      setSnapIndicator(null);
      return;
    }
    if (activeDrag.type === "text-resize") {
      const drag = activeDrag;
      const dist = Math.hypot(svgPoint.x - drag.cx, svgPoint.y - drag.cy);
      const scale = Math.max(0.1, dist / drag.origDist);
      const newFs = Math.min(200, Math.max(2, drag.origFontSize * scale));
      setTexts((prev) =>
        prev.map((t) => (t.id !== drag.id ? t : { ...t, fontSize: newFs })),
      );
      setSnapIndicator(null);
      return;
    }
    if (activeDrag.type === "wall") {
      setWalls((prev) =>
        prev.map((wall) => {
          if (wall.id !== activeDrag.id) return wall;
          const stationary = activeDrag.pointIndex === "p1" ? wall.p2 : wall.p1;
          let fx = svgPoint.x,
            fy = svgPoint.y;
          if (axisLock) {
            const s = snapAngle45(stationary, svgPoint.x, svgPoint.y);
            fx = s.x; fy = s.y;
          }
          const snap = findSnap(fx, fy);
          if (snap) {
            fx = snap.x;
            fy = snap.y;
            setSnapIndicator(snap);
          } else {
            setSnapIndicator(null);
          }
          return { ...wall, [activeDrag.pointIndex as "p1" | "p2"]: { x: fx, y: fy } };
        }),
      );
    } else if (activeDrag.type === "floor") {
      setFloors((prev) =>
        prev.map((floor) => {
          if (floor.id !== activeDrag.id) return floor;
          const updated = [...floor.polygon];
          let fx = svgPoint.x, fy = svgPoint.y;
          const snap = findSnap(fx, fy);
          if (snap) { fx = snap.x; fy = snap.y; setSnapIndicator(snap); } else setSnapIndicator(null);
          updated[activeDrag.pointIndex as number] = { x: fx, y: fy };
          return { ...floor, polygon: updated };
        }),
      );
    } else if (activeDrag.type === "window") {
      // Project mouse onto nearest wall segment; snap window center along it.
      let best: { pt: Pt; angle: number; thickness: number; d: number; wall: typeof walls[number] } | null = null;
      for (const w of walls) {
        const dx = w.p2.x - w.p1.x;
        const dy = w.p2.y - w.p1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        let t = ((svgPoint.x - w.p1.x) * dx + (svgPoint.y - w.p1.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = w.p1.x + t * dx;
        const py = w.p1.y + t * dy;
        const d = Math.hypot(px - svgPoint.x, py - svgPoint.y);
        if (!best || d < best.d) {
          best = { pt: { x: px, y: py }, angle: Math.atan2(dy, dx), thickness: w.thickness, d, wall: w };
        }
      }
      if (best) {
        // Snap to midpoint of the wall being moved along
        const snapWorld = CONFIG.snapDistancePx / viewport.zoom;
        const mx = (best.wall.p1.x + best.wall.p2.x) / 2;
        const my = (best.wall.p1.y + best.wall.p2.y) / 2;
        if (Math.hypot(best.pt.x - mx, best.pt.y - my) < snapWorld) {
          best = { ...best, pt: { x: mx, y: my } };
        }
        setSnapIndicator(best.pt);
        const snapped = best;
        setWindows((prev) =>
          prev.map((win) =>
            win.id !== activeDrag.id
              ? win
              : { ...win, center: snapped.pt, rotation_rad: snapped.angle, thickness: snapped.thickness },
          ),
        );
      }
    } else if (activeDrag.type === "door") {
      let best: { pt: Pt; angle: number; thickness: number; d: number; wall: typeof walls[number] } | null = null;
      for (const w of walls) {
        const dx = w.p2.x - w.p1.x;
        const dy = w.p2.y - w.p1.y;
        const len2 = dx * dx + dy * dy;
        if (len2 === 0) continue;
        let t = ((svgPoint.x - w.p1.x) * dx + (svgPoint.y - w.p1.y) * dy) / len2;
        t = Math.max(0, Math.min(1, t));
        const px = w.p1.x + t * dx;
        const py = w.p1.y + t * dy;
        const d = Math.hypot(px - svgPoint.x, py - svgPoint.y);
        if (!best || d < best.d) {
          best = { pt: { x: px, y: py }, angle: Math.atan2(dy, dx), thickness: w.thickness, d, wall: w };
        }
      }
      if (best) {
        const snapWorld = CONFIG.snapDistancePx / viewport.zoom;
        const mx = (best.wall.p1.x + best.wall.p2.x) / 2;
        const my = (best.wall.p1.y + best.wall.p2.y) / 2;
        if (Math.hypot(best.pt.x - mx, best.pt.y - my) < snapWorld) {
          best = { ...best, pt: { x: mx, y: my } };
        }
        setSnapIndicator(best.pt);
        const snapped = best;
        setDoors((prev) =>
          prev.map((door) => {
            if (door.id !== activeDrag.id) return door;
            const oldCx = (door.hinge.x + door.strike.x) / 2;
            const oldCy = (door.hinge.y + door.strike.y) / 2;
            const oldAngle = Math.atan2(door.strike.y - door.hinge.y, door.strike.x - door.hinge.x);
            // Pick whichever wall direction is closer to current orientation (preserve hinge side)
            let newAngle = snapped.angle;
            const diff = Math.atan2(Math.sin(newAngle - oldAngle), Math.cos(newAngle - oldAngle));
            if (Math.abs(diff) > Math.PI / 2) newAngle = newAngle + Math.PI;
            const da = newAngle - oldAngle;
            const cos = Math.cos(da), sin = Math.sin(da);
            const transform = (p: Pt): Pt => {
              const dx = p.x - oldCx;
              const dy = p.y - oldCy;
              return { x: dx * cos - dy * sin + snapped.pt.x, y: dx * sin + dy * cos + snapped.pt.y };
            };
            return {
              ...door,
              hinge: transform(door.hinge),
              strike: transform(door.strike),
              leaf: transform(door.leaf),
              thickness: snapped.thickness,
            };
          }),
        );
      }
    } else if (activeDrag.type === "railing") {
      const drag = activeDrag;
      setStructures((prev) =>
        prev.map((s) => {
          if (s.id !== drag.id || s.kind !== "railing") return s;
          const stationary = drag.pointIndex === "p1" ? s.p2 : s.p1;
          let fx = svgPoint.x, fy = svgPoint.y;
          if (axisLock) {
            const sn = snapAngle45(stationary, fx, fy);
            fx = sn.x; fy = sn.y;
          }
          const snap = findSnap(fx, fy);
          if (snap) { fx = snap.x; fy = snap.y; setSnapIndicator(snap); }
          else setSnapIndicator(null);
          return { ...s, [drag.pointIndex as "p1" | "p2"]: { x: fx, y: fy } };
        }),
      );
    } else if (activeDrag.type === "railing-body") {
      const drag = activeDrag;
      let dx = svgPoint.x - drag.startSvg.x;
      let dy = svgPoint.y - drag.startSvg.y;
      if (axisLock) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
      }
      setStructures((prev) =>
        prev.map((s) =>
          s.id !== drag.id || s.kind !== "railing"
            ? s
            : {
                ...s,
                p1: { x: drag.origP1.x + dx, y: drag.origP1.y + dy },
                p2: { x: drag.origP2.x + dx, y: drag.origP2.y + dy },
              },
        ),
      );
      setSnapIndicator(null);
    } else if (activeDrag.type === "stair-body") {
      const drag = activeDrag;
      let dx = svgPoint.x - drag.startSvg.x;
      let dy = svgPoint.y - drag.startSvg.y;
      if (isShiftPressed) {
        if (Math.abs(dx) >= Math.abs(dy)) dy = 0; else dx = 0;
      }
      setStructures((prev) =>
        prev.map((s) => {
          if (s.id !== drag.id || s.kind !== "stairs") return s;
          const next: StairsStructure = {
            ...s,
            polygon: drag.origPolygon.map((p) => ({ x: p.x + dx, y: p.y + dy })),
          };
          if (drag.origAnchor) {
            next.rotation_anchor = { x: drag.origAnchor.x + dx, y: drag.origAnchor.y + dy };
          }
          if (drag.origStart) next.start = { x: drag.origStart.x + dx, y: drag.origStart.y + dy };
          if (drag.origEnd) next.end = { x: drag.origEnd.x + dx, y: drag.origEnd.y + dy };
          return next;
        }),
      );

      setSnapIndicator(null);
    } else if (activeDrag.type === "stair-rotate") {
      const drag = activeDrag;
      const curAngle = Math.atan2(svgPoint.y - drag.cy, svgPoint.x - drag.cx) * (180 / Math.PI);
      let delta = curAngle - drag.startAngle;
      const step = isShiftPressed ? 1 : 15;
      delta = Math.round(delta / step) * step;
      const newDeg = drag.origRotationDeg + delta;
      const rad = (newDeg * Math.PI) / 180;
      setStructures((prev) =>
        prev.map((s) =>
          s.id !== drag.id || s.kind !== "stairs" ? s : { ...s, rotation_rad: rad },
        ),
      );
      setSnapIndicator(null);
    } else if (activeDrag.type === "stair-end") {
      const drag = activeDrag;
      // Convert world pointer delta into LOCAL polygon space by rotating by -rotation.
      const wdx = svgPoint.x - drag.startSvg.x;
      const wdy = svgPoint.y - drag.startSvg.y;
      const cs = Math.cos(-drag.rotation), sn = Math.sin(-drag.rotation);
      const ldx = wdx * cs - wdy * sn;
      const ldy = wdx * sn + wdy * cs;
      let delta = drag.axis === "x" ? ldx : ldy;
      // Clamp so the moving group keeps at least 12px (~1ft) gap from the
      // opposite (non-moving) vertices along the same axis.
      const idxSet = new Set(drag.vertexIndices);
      const movingCoords = drag.origPolygon
        .map((p, i) => (idxSet.has(i) ? (drag.axis === "x" ? p.x : p.y) : null))
        .filter((v): v is number => v !== null);
      const clampSet = drag.clampAgainstIndices
        ? new Set(drag.clampAgainstIndices)
        : null;
      const otherCoords = drag.origPolygon
        .map((p, i) => {
          if (clampSet) return clampSet.has(i) ? (drag.axis === "x" ? p.x : p.y) : null;
          return !idxSet.has(i) ? (drag.axis === "x" ? p.x : p.y) : null;
        })
        .filter((v): v is number => v !== null);
      const minGap = inchesToPx(12);
      if (drag.sign === 1) {
        const otherMax = Math.max(...otherCoords);
        const movingMin = Math.min(...movingCoords);
        if (movingMin + delta < otherMax + minGap) delta = otherMax + minGap - movingMin;
      } else {
        const otherMin = Math.min(...otherCoords);
        const movingMax = Math.max(...movingCoords);
        if (movingMax + delta > otherMin - minGap) delta = otherMin - minGap - movingMax;
      }
      const d = delta;
      setStructures((prev) =>
        prev.map((s) => {
          if (s.id !== drag.id || s.kind !== "stairs") return s;
          const polygon = drag.origPolygon.map((p, i) => {
            if (!idxSet.has(i)) return { ...p };
            return drag.axis === "x" ? { x: p.x + d, y: p.y } : { x: p.x, y: p.y + d };
          });
          const next: StairsStructure = { ...s, polygon };
          // Keep start/end anchored to their respective open-ends after resize.
          if (drag.origStart || drag.origEnd) {
            const stairWidthPx = inchesToPx(s.width_in ?? DEFAULT_STAIR_WIDTH_IN);
            const newEnds = getStairOpenEnds(polygon, s.shape ?? "straight", stairWidthPx);
            const origEnds = getStairOpenEnds(drag.origPolygon, s.shape ?? "straight", stairWidthPx);
            const snap = (orig?: Pt): Pt | undefined => {
              if (!orig || newEnds.length === 0 || origEnds.length === 0) return orig;
              let bestI = 0, bestD = Infinity;
              origEnds.forEach((e, i) => {
                const dd = (e.mid.x - orig.x) ** 2 + (e.mid.y - orig.y) ** 2;
                if (dd < bestD) { bestD = dd; bestI = i; }
              });
              const target = newEnds[Math.min(bestI, newEnds.length - 1)];
              return { x: target.mid.x, y: target.mid.y };
            };
            if (drag.origStart) next.start = snap(drag.origStart);
            if (drag.origEnd) next.end = snap(drag.origEnd);
          }
          return next;
        }),
      );

      setSnapIndicator(null);
    }
  };


  const initiateCalibration = () => {
    setViewMode("2D");
    setSelectedId(null);
    setCalibrationState({ active: true, point1: null });
  };

  // File handling
  const handleFile = (file: File) => {
    if (!file.name.endsWith(".json")) {
      alert("Please drop a .json file");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(String(e.target?.result));
        loadPlan(data, file.name);
        setViewMode("2D");
        setSelection3D(null);
        setScalePromptOpen(true);
      } catch (err) {
        alert("Invalid JSON file: " + (err as Error).message);
      }
    };
    reader.readAsText(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Selected items
  const selectedFloor = floors.find((f) => f.id === selectedId);
  const selectedWall = walls.find((w) => w.id === selectedId);
  const selectedDoor = doors.find((d) => d.id === selectedId);
  const selectedWindow = windows.find((w) => w.id === selectedId);
  const selectedFurniture = furniture.find((f) => f.id === selectedId);
  const selectedText = texts.find((t) => t.id === selectedId);
  const selectedStructure = structures.find((s) => s.id === selectedId);
  const selectedRailing = selectedStructure?.kind === "railing" ? selectedStructure : null;
  const selectedStairs = selectedStructure?.kind === "stairs" ? selectedStructure : null;

  // Render helpers
  const effectiveHoveredId = drawMode || calibrationState.active ? null : hoveredId;
  const getStroke = (id: string, def: string) =>
    id === selectedId ? COLORS.itemSelected : id === effectiveHoveredId ? COLORS.strokeHover : def;

  const FURNITURE_ICON: Record<string, LucideIcon> = {
    bed: Bed,
    sofa: Sofa,
    couch: Sofa,
    bath: Bath,
    tub: Bath,
    bathtub: Bath,
    toilet: Toilet,
    sink: ShowerHead,
    shower: ShowerHead,
    table: Square,
    desk: Square,
    chair: Armchair,
    armchair: Armchair,
    fridge: Refrigerator,
    refrigerator: Refrigerator,
    stove: CookingPot,
    oven: CookingPot,
  };

  const renderFurniture = () =>
    furniture.map((f) => {
      if (!f.corners || f.corners.length < 3) return null;
      const stroke = getStroke(f.id, COLORS.wall);
      const points = f.corners.map((c) => `${c.x},${c.y}`).join(" ");
      const anchor = f.back_edge
        ? {
            x: (f.back_edge.p1.x + f.back_edge.p2.x) / 2,
            y: (f.back_edge.p1.y + f.back_edge.p2.y) / 2,
          }
        : {
            x: f.corners.reduce((s, p) => s + p.x, 0) / f.corners.length,
            y: f.corners.reduce((s, p) => s + p.y, 0) / f.corners.length,
          };
      let angle = f.angle_deg ?? 0;
      if (f.back_edge) {
        const dx = f.back_edge.p2.x - f.back_edge.p1.x;
        const dy = f.back_edge.p2.y - f.back_edge.p1.y;
        
        // Math.atan2 works almost identically to math.atan2 in Python
        angle = Math.atan2(dy, dx) * (180 / Math.PI);
      }
      const typeLower = f.type.toLowerCase();
      const Icon = FURNITURE_ICON[typeLower] ?? Square;
      const fallbackPx = 24 / viewport.zoom;

      // Width along the back edge, length perpendicular into the room.
      const widthPx = f.back_edge
        ? Math.hypot(
            f.back_edge.p2.x - f.back_edge.p1.x,
            f.back_edge.p2.y - f.back_edge.p1.y,
          )
        : fallbackPx;
      let lengthPx = widthPx;
      if (f.back_edge && widthPx > 1e-6) {
        const ux2 = (f.back_edge.p2.x - f.back_edge.p1.x) / widthPx;
        const uy2 = (f.back_edge.p2.y - f.back_edge.p1.y) / widthPx;
        let nx2 = -uy2, ny2 = ux2;
        const cgx = f.corners.reduce((s, p) => s + p.x, 0) / f.corners.length;
        const cgy = f.corners.reduce((s, p) => s + p.y, 0) / f.corners.length;
        if ((cgx - anchor.x) * nx2 + (cgy - anchor.y) * ny2 < 0) {
          nx2 = -nx2; ny2 = -ny2;
        }
        let L = 0;
        for (const c of f.corners) {
          const d = (c.x - anchor.x) * nx2 + (c.y - anchor.y) * ny2;
          if (d > L) L = d;
        }
        if (L > 1e-6) lengthPx = L;
      }

      const widthComponents: Record<string, any> = {
        bath: Custom_Bathtub,
        bathtub: Custom_Bathtub,
        tub: Custom_Bathtub,
        shower: Custom_Small_Shower,
        small_shower: Custom_Small_Shower,
        large_shower: Custom_Large_Shower,
        stove: Custom_Stove,
        oven: Custom_Stove,
        fridge: Custom_Fridge,
        refrigerator: Custom_Fridge,
        sink: Custom_Single_Sink,
        vanity: Custom_Single_Vanity,
        single_vanity: Custom_Single_Vanity,
        double_vanity: Custom_Double_Vanity,
        couch: Custom_Single_Couch,
        sofa: Custom_Single_Couch,
        single_couch: Custom_Single_Couch,
        double_couch: Custom_Double_Couch,
        triple_couch: Custom_Triple_Couch,
        counter: Custom_Single_Cabinet,
        single_counter: Custom_Single_Cabinet,
        double_counter: Custom_Double_Cabinet,
        kitchen_island: Custom_Kitchen_Island,
      };
      const lengthComponents: Record<string, any> = {
        toilet: Custom_Toilet,
        bed: Custom_Queen_Bed,
        king_bed: Custom_King_Bed,
        queen_bed: Custom_Queen_Bed,
        double_bed: Custom_Double_Bed,
        single_bed: Custom_Single_Bed,
      };
      const WidthComp = widthComponents[typeLower];
      const LengthComp = lengthComponents[typeLower];

      // Sanitize numeric values before they reach SVG attributes.
      // Invalid math (NaN/Infinity/negatives) mid-drag would otherwise spam
      // React warnings at 60fps and choke Vite's HMR WebSocket (1006 close).
      const safeNum = (n: number, fallback: number) =>
        Number.isFinite(n) ? n : fallback;
      const safePos = (n: number, fallback: number) =>
        Number.isFinite(n) && n > 0 ? n : fallback;
      const safeFallbackPx = safePos(fallbackPx, 20);
      const safeWidthPx = safePos(widthPx, safeFallbackPx);
      const safeLengthPx = safePos(lengthPx, safeFallbackPx);
      const safeAngle = safeNum(angle, 0);
      const safeAnchorX = safeNum(anchor.x, 0);
      const safeAnchorY = safeNum(anchor.y, 0);

      return (
        <g
          key={f.id}
          onPointerEnter={() => setHoveredId(f.id)}
          onPointerLeave={() => setHoveredId(null)}
          onPointerDown={(e) => {
            if (drawMode || calibrationState.active) return;
            if (e.button !== 0) return;
            e.stopPropagation();
            setSelectedId(f.id);
            const sp = getSvgPoint(e.clientX, e.clientY);
            if (!sp) return;
            pushHistory();
            setActiveDrag({
              id: f.id,
              type: "furniture-body",
              startSvg: sp,
              origCorners: f.corners.map((c) => ({ ...c })),
              origBackEdge: f.back_edge
                ? { p1: { ...f.back_edge.p1 }, p2: { ...f.back_edge.p2 } }
                : undefined,
            });
          }}
          style={{ cursor: drawMode ? undefined : "move" }}
        >
          <polygon
            points={points}
            fill="oklch(0.9 0.05 45)"
            fillOpacity={0.5}
            stroke={stroke}
            strokeWidth={1}
          />
          <g transform={`rotate(${safeAngle} ${safeAnchorX} ${safeAnchorY})${f.flipLR ? ` translate(${2 * safeAnchorX} 0) scale(-1 1)` : ""}`} style={{ pointerEvents: "none" }}>
            {LengthComp ? (
              <LengthComp
                anchorX={safeAnchorX}
                anchorY={safeAnchorY}
                width={safeWidthPx}
                length={safeLengthPx}
                stroke={stroke}
                fill={typeLower.includes("bed") ? stroke : "#ffffff"}
              />
            ) : WidthComp ? (
              <WidthComp
                anchorX={safeAnchorX}
                anchorY={safeAnchorY}
                width={safeWidthPx}
                height={safeLengthPx}
                length={safeLengthPx}
                stroke={stroke}
                fill="none"
              />
            ) : (
              <foreignObject
                x={safeAnchorX - safeFallbackPx / 2}
                y={safeAnchorY}
                width={safeFallbackPx}
                height={safeFallbackPx}
                style={{ pointerEvents: "none" }}
              >
                <Icon size={safeFallbackPx} color={stroke} />
              </foreignObject>
            )}
          </g>

        </g>
      );
    });



  const renderStructures = () => {
    const treadInPx = inchesToPx(11);
    const balusterSpacingPx = inchesToPx(5);
    const balusterSizePx = inchesToPx(1.5);

    return (
      <g>
        {structures.map((s) => {
          const stroke = getStroke(s.id, "#000000");
          const sw = 1.5 / viewport.zoom;

          if (s.kind === "stairs") {
            const rects = decomposeStairPolygon(s.polygon);
            const pathD =
              s.polygon
                .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
                .join(" ") + " Z";

            const anchor = s.rotation_anchor ?? polygonBboxCenter(s.polygon);
            const rotDeg = ((s.rotation_rad ?? 0) * 180) / Math.PI;
            const isProjectedMaster =
              activeFloor === 2 && ((s as any).__from_master_floor || s.spans_to_floor === 2);
            return (
              <g
                key={s.id}
                transform={`rotate(${rotDeg} ${anchor.x} ${anchor.y})`}
                opacity={isProjectedMaster ? 0.5 : 1}
                onPointerEnter={() => setHoveredId(s.id)}
                onPointerLeave={() => setHoveredId(null)}
                onPointerDown={(e) => {
                  if (drawMode || calibrationState.active) return;
                  if (e.button !== 0) return;
                  e.stopPropagation();
                  setSelectedId(s.id);
                  const sp = getSvgPoint(e.clientX, e.clientY);
                  if (!sp) return;
                  pushHistory();
                  setActiveDrag({
                    id: s.id,
                    type: "stair-body",
                    startSvg: sp,
                    origPolygon: s.polygon.map((p) => ({ ...p })),
                    origAnchor: s.rotation_anchor ? { ...s.rotation_anchor } : undefined,
                    origStart: s.start ? { ...s.start } : undefined,
                    origEnd: s.end ? { ...s.end } : undefined,
                  });

                }}
                style={{ cursor: drawMode ? undefined : "move" }}
              >
                {/* Stair polygon outline + white fill */}
                <path d={pathD} fill="#ffffff" stroke={stroke} strokeWidth={sw} />
                {/* Treads — drawn per run rect, perpendicular to its long edge.
                    Landing rects are skipped. */}
                {(() => {
                  // Merge co-linear non-landing cells into maximal run rectangles
                  // so each run keeps a single consistent tread direction even
                  // when the grid decomposition splits it (e.g. when the other
                  // leg of a U-shape introduces extra x/y splits).
                  const runs = rects.filter((r) => !r.isLanding).map((r) => ({ ...r }));
                  const eq = (a: number, b: number) => Math.abs(a - b) < 0.5;
                  let merged = true;
                  while (merged) {
                    merged = false;
                    outer: for (let a = 0; a < runs.length; a++) {
                      for (let b = a + 1; b < runs.length; b++) {
                        const A = runs[a], B = runs[b];
                        if (eq(A.x, B.x) && eq(A.w, B.w) && (eq(A.y + A.h, B.y) || eq(B.y + B.h, A.y))) {
                          const y0 = Math.min(A.y, B.y);
                          const y1 = Math.max(A.y + A.h, B.y + B.h);
                          runs[a] = { ...A, y: y0, h: y1 - y0 };
                          runs.splice(b, 1);
                          merged = true;
                          break outer;
                        }
                        if (eq(A.y, B.y) && eq(A.h, B.h) && (eq(A.x + A.w, B.x) || eq(B.x + B.w, A.x))) {
                          const x0 = Math.min(A.x, B.x);
                          const x1 = Math.max(A.x + A.w, B.x + B.w);
                          runs[a] = { ...A, x: x0, w: x1 - x0 };
                          runs.splice(b, 1);
                          merged = true;
                          break outer;
                        }
                      }
                    }
                  }
                  const stairWidthPx = inchesToPx(s.width_in ?? 36);
                  return runs.map((r, idx) => {
                    // Run direction is along the dimension that is NOT the stair width.
                    // Treads are perpendicular to the run. This keeps tread direction
                    // stable even when a leg is shortened below the stair width.
                    const wMatches = Math.abs(r.w - stairWidthPx) < Math.abs(r.h - stairWidthPx);
                    const treadsHorizontal = wMatches; // width == stair width → run is vertical → treads horizontal

                    const lines: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
                    if (treadsHorizontal) {
                      for (let yi = r.y + treadInPx; yi < r.y + r.h - 0.5; yi += treadInPx) {
                        lines.push({ x1: r.x, y1: yi, x2: r.x + r.w, y2: yi });
                      }
                    } else {
                      for (let xi = r.x + treadInPx; xi < r.x + r.w - 0.5; xi += treadInPx) {
                        lines.push({ x1: xi, y1: r.y, x2: xi, y2: r.y + r.h });
                      }
                    }
                    return (
                      <g key={idx}>
                        {lines.map((t, i) => (
                          <line
                            key={i}
                            x1={t.x1}
                            y1={t.y1}
                            x2={t.x2}
                            y2={t.y2}
                            stroke="#000000"
                            strokeWidth={0.8 / viewport.zoom}
                          />
                        ))}
                      </g>
                    );
                  });
                })()}
                {/* Start indicator — small arrow + label at the "Start" end of
                    the run. Falls back to the first open-end midpoint when
                    no explicit start_point is set on the stair. */}
                {(() => {
                  const stairWidthPx = inchesToPx(s.width_in ?? DEFAULT_STAIR_WIDTH_IN);
                  const ends = getStairOpenEnds(s.polygon, s.shape ?? "straight", stairWidthPx);
                  const start = s.start ?? ends[0]?.mid;
                  if (!start) return null;
                  // Arrow direction = along the FIRST run (from the start short-end
                  // pointing inward into the polygon). For L/U this correctly
                  // follows the first flight rather than cutting diagonally to
                  // the far end. Fallback: start→end / start→centroid.
                  let ux = 0, uy = 0;
                  const startEnd = ends
                    .map((e) => ({ e, d: Math.hypot(e.mid.x - start.x, e.mid.y - start.y) }))
                    .sort((a, b) => a.d - b.d)[0]?.e;
                  if (startEnd) {
                    // Inward = opposite of the outward sign along the end's axis.
                    if (startEnd.axis === "x") { ux = -startEnd.sign; uy = 0; }
                    else { ux = 0; uy = -startEnd.sign; }
                  } else {
                    const cx = s.polygon.reduce((a, p) => a + p.x, 0) / s.polygon.length;
                    const cy = s.polygon.reduce((a, p) => a + p.y, 0) / s.polygon.length;
                    const tx = (s.end?.x ?? cx) - start.x;
                    const ty = (s.end?.y ?? cy) - start.y;
                    const tl = Math.hypot(tx, ty) || 1;
                    ux = tx / tl; uy = ty / tl;
                  }
                  const arrowLen = Math.min(stairWidthPx * 0.55, 22);
                  const arrowHead = arrowLen * 0.35;
                  const px = -uy, py = ux;
                  const tip = { x: start.x + ux * arrowLen, y: start.y + uy * arrowLen };
                  const base = { x: start.x, y: start.y };
                  const hL = { x: tip.x - ux * arrowHead + px * arrowHead * 0.6, y: tip.y - uy * arrowHead + py * arrowHead * 0.6 };
                  const hR = { x: tip.x - ux * arrowHead - px * arrowHead * 0.6, y: tip.y - uy * arrowHead - py * arrowHead * 0.6 };
                  const sw2 = 1.6 / viewport.zoom;
                  const fontSize = 10 / viewport.zoom;
                  const labelPos = { x: start.x - ux * arrowLen * 0.5, y: start.y - uy * arrowLen * 0.5 };

                  return (
                    <g pointerEvents="none">
                      <line x1={base.x} y1={base.y} x2={tip.x} y2={tip.y} stroke="#0ea5e9" strokeWidth={sw2} strokeLinecap="round" />
                      <polygon
                        points={`${tip.x},${tip.y} ${hL.x},${hL.y} ${hR.x},${hR.y}`}
                        fill="#0ea5e9"
                      />
                      <text
                        x={labelPos.x}
                        y={labelPos.y}
                        fontSize={fontSize}
                        fontWeight={700}
                        fill="#0ea5e9"
                        stroke="#ffffff"
                        strokeWidth={2.5 / viewport.zoom}
                        paintOrder="stroke"
                        textAnchor="middle"
                        dominantBaseline="middle"
                      >
                        START
                      </text>
                    </g>
                  );
                })()}
              </g>
            );
          }


          // Railing — wall-like: centerline p1→p2 swept by `thickness`.
          const dx = s.p2.x - s.p1.x;
          const dy = s.p2.y - s.p1.y;
          const len = Math.hypot(dx, dy);
          if (len < 0.5) return null;
          const ux = dx / len, uy = dy / len;
          // Perp unit
          const px = -uy, py = ux;
          const balusters: Array<{ cx: number; cy: number }> = [];
          for (let d = balusterSpacingPx; d < len - balusterSpacingPx / 2; d += balusterSpacingPx) {
            balusters.push({ cx: s.p1.x + ux * d, cy: s.p1.y + uy * d });
          }
          return (
            <g
              key={s.id}
              onPointerEnter={() => setHoveredId(s.id)}
              onPointerLeave={() => setHoveredId(null)}
              onPointerDown={(e) => {
                if (drawMode || calibrationState.active) return;
                if (e.button !== 0) return;
                e.stopPropagation();
                setSelectedId(s.id);
                const sp = getSvgPoint(e.clientX, e.clientY);
                if (!sp) return;
                pushHistory();
                setActiveDrag({
                  id: s.id,
                  type: "railing-body",
                  startSvg: sp,
                  origP1: { ...s.p1 },
                  origP2: { ...s.p2 },
                });
              }}
              style={{ cursor: drawMode ? undefined : "move" }}
            >
              {/* Hit area */}
              <line
                x1={s.p1.x}
                y1={s.p1.y}
                x2={s.p2.x}
                y2={s.p2.y}
                stroke="transparent"
                strokeWidth={s.thickness + CONFIG.hitboxBuffer * 4}
                strokeLinecap="square"
              />
              {/* Body (white fill + black outline) */}
              <line
                x1={s.p1.x}
                y1={s.p1.y}
                x2={s.p2.x}
                y2={s.p2.y}
                stroke="#ffffff"
                strokeWidth={s.thickness}
                strokeLinecap="square"
                style={{ pointerEvents: "none" }}
              />
              <line
                x1={s.p1.x}
                y1={s.p1.y}
                x2={s.p2.x}
                y2={s.p2.y}
                stroke={stroke}
                strokeWidth={sw}
                strokeLinecap="square"
                style={{ pointerEvents: "none" }}
                strokeDasharray="0"
              />
              {/* Top/bottom edges of the swept rectangle (so it reads like a rail body) */}
              {[s.thickness / 2, -s.thickness / 2].map((off, i) => (
                <line
                  key={i}
                  x1={s.p1.x + px * off}
                  y1={s.p1.y + py * off}
                  x2={s.p2.x + px * off}
                  y2={s.p2.y + py * off}
                  stroke={stroke}
                  strokeWidth={sw}
                  style={{ pointerEvents: "none" }}
                />
              ))}
              {/* Balusters along centerline */}
              {balusters.map((b, i) => (
                <rect
                  key={i}
                  x={b.cx - balusterSizePx / 2}
                  y={b.cy - balusterSizePx / 2}
                  width={balusterSizePx}
                  height={balusterSizePx}
                  fill="#000000"
                  transform={`rotate(${(Math.atan2(uy, ux) * 180) / Math.PI} ${b.cx} ${b.cy})`}
                  style={{ pointerEvents: "none" }}
                />
              ))}
            </g>
          );
        })}
      </g>
    );
  };




  const renderTexts = () =>
    texts.map((t) => {
      const fs = (t.fontSize ?? 7) * PIXELS_PER_WORLD_INCH;
      const isEditing = editingTextId === t.id;
      if (isEditing) {
        const pad = fs * 0.3;
        const w = Math.max(fs * 4, (t.text || " ").length * fs * 0.7) + pad * 2;
        const h = fs + pad * 2;
        return (
          <foreignObject
            key={t.id}
            x={t.x - w / 2}
            y={t.y - h / 2}
            width={w}
            height={h}
            style={{ overflow: "visible" }}
          >
            <input
              autoFocus
              value={t.text}
              onChange={(e) => {
                const v = e.target.value;
                setTexts((prev) => prev.map((x) => (x.id === t.id ? { ...x, text: v } : x)));
              }}
              onBlur={() => setEditingTextId(null)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === "Escape") {
                  e.preventDefault();
                  (e.currentTarget as HTMLInputElement).blur();
                }
                e.stopPropagation();
              }}
              onPointerDown={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                height: "100%",
                border: `${1 / viewport.zoom}px solid ${COLORS.itemSelected}`,
                outline: "none",
                background: "white",
                fontSize: `${fs}px`,
                fontWeight: 700,
                color: "#6b7280",
                textAlign: "center",
                fontFamily: "var(--font-sans)",
                padding: 0,
                boxSizing: "border-box",
              }}
            />
          </foreignObject>
        );
      }
      return (
        <g
          key={t.id}
          onPointerEnter={() => setHoveredId(t.id)}
          onPointerLeave={() => setHoveredId(null)}
          onPointerDown={(e) => {
            if (drawMode || calibrationState.active) return;
            if (e.button !== 0) return;
            e.stopPropagation();
            setSelectedId(t.id);
            const sp = getSvgPoint(e.clientX, e.clientY);
            if (!sp) return;
            pushHistory();
            setActiveDrag({
              id: t.id,
              type: "text-body",
              startSvg: sp,
              origX: t.x,
              origY: t.y,
            });
          }}
          onDoubleClick={(e) => {
            if (drawMode || calibrationState.active) return;
            e.stopPropagation();
            setSelectedId(t.id);
            setEditingTextId(t.id);
          }}
          style={{ cursor: drawMode ? undefined : "move" }}
        >
          <text
            x={t.x}
            y={t.y}
            textAnchor="middle"
            dominantBaseline="middle"
            fontSize={fs}
            fontWeight={700}
            fill={t.id === selectedId ? COLORS.itemSelected : "#6b7280"}
            style={{
              userSelect: "none",
            }}
          >
            {t.text}
          </text>
        </g>
      );
    });


  const renderFloors = () =>
    floors.map((floor) => {
      const sel = floor.id === selectedId;
      const hov = floor.id === effectiveHoveredId && !sel;
      const fill = sel ? COLORS.floorSelected : hov ? COLORS.itemHover : COLORS.floor;
      return (
        <polygon
          key={floor.id}
          points={(floor.polygon || []).map((p) => `${p.x},${p.y}`).join(" ")}
          fill={fill}
          fillOpacity={0.85}
          stroke="transparent"
          cursor="pointer"
          onPointerDown={(e) => handleItemClick(e, floor.id, "floor")}
          onPointerEnter={() => setHoveredId(floor.id)}
          onPointerLeave={() => setHoveredId(null)}
        />
      );
    });

  const renderWalls = () =>
    walls.map((wall) => {
      const stroke = getStroke(wall.id, COLORS.wall);
      return (
        <g
          key={wall.id}
          onPointerEnter={() => setHoveredId(wall.id)}
          onPointerLeave={() => setHoveredId(null)}
        >
          <line
            x1={wall.p1.x}
            y1={wall.p1.y}
            x2={wall.p2.x}
            y2={wall.p2.y}
            stroke="transparent"
            strokeWidth={wall.thickness + CONFIG.hitboxBuffer * 4}
            strokeLinecap="square"
            cursor="move"
            onPointerDown={(e) => handleWallBodyDown(e, wall)}
          />
          <line
            x1={wall.p1.x}
            y1={wall.p1.y}
            x2={wall.p2.x}
            y2={wall.p2.y}
            stroke={stroke}
            strokeWidth={wall.thickness}
            strokeLinecap="square"
            style={{ pointerEvents: "none" }}
          />
        </g>
      );
    });

  const renderDoors = () =>
    doors.map((door) => {
      const color = getStroke(door.id, COLORS.door);
      const sweepFlag =
        (door.strike.x - door.hinge.x) * (door.leaf.y - door.hinge.y) -
          (door.strike.y - door.hinge.y) * (door.leaf.x - door.hinge.x) >
        0
          ? 0
          : 1;
      const cx = (door.hinge.x + door.strike.x) / 2;
      const cy = (door.hinge.y + door.strike.y) / 2;
      const angleDeg =
        Math.atan2(door.strike.y - door.hinge.y, door.strike.x - door.hinge.x) *
        (180 / Math.PI);
      const isOpen = door.open !== false;
      const isDouble = !!door.is_double;

      const commonPointerHandlers = {
        cursor: calibrationState.active ? "crosshair" : "grab",
        onPointerDown: (e: React.PointerEvent) => {
          if (drawMode) return;
          e.stopPropagation();
          if (calibrationState.active) {
            handleItemClick(e, door.id, "door");
            return;
          }
          setSelectedId(door.id);
          pushHistory();
          setActiveDrag({ id: door.id, type: "door" });
        },
        onPointerEnter: () => setHoveredId(door.id),
        onPointerLeave: () => setHoveredId(null),
      };

      if (door.is_arch) {
        // Arch: white opening rectangle + 3 dashed lines (two outer wall
        // edges + one down the centerline) drawn in wall-aligned local space.
        const t = door.thickness;
        const w = door.width;
        return (
          <g key={door.id} {...commonPointerHandlers}>
            <g transform={`translate(${cx}, ${cy}) rotate(${angleDeg})`}>
              <rect
                x={-w / 2}
                y={-t / 2}
                width={w}
                height={t}
                fill={COLORS.white}
                stroke="none"
              />
              <line
                x1={-w / 2}
                y1={-t / 2}
                x2={w / 2}
                y2={-t / 2}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <line
                x1={-w / 2}
                y1={t / 2}
                x2={w / 2}
                y2={t / 2}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              <line
                x1={-w / 2}
                y1={0}
                x2={w / 2}
                y2={0}
                stroke={color}
                strokeWidth={1}
                strokeDasharray="4 3"
              />
              {/* invisible hitbox */}
              <rect
                x={-w / 2}
                y={-Math.max(t / 2 + 4, 8)}
                width={w}
                height={Math.max(t + 8, 16)}
                fill="transparent"
              />
            </g>
          </g>
        );
      }

      if (isDouble) {
        // Two leaves meeting at midpoint, both swinging the same side.
        const dx = door.strike.x - door.hinge.x;
        const dy = door.strike.y - door.hinge.y;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len, uy = dy / len;
        const half = door.width / 2;
        const side = (sweepFlag === 0 ? 1 : -1) * (door.flipY ? -1 : 1);
        const nx = -uy * side, ny = ux * side;
        const aClosedDeg = angleDeg;
        const bClosedDeg = angleDeg + 180;
        const openDeg = Math.atan2(ny, nx) * (180 / Math.PI);
        const leafADeg = isOpen ? openDeg : aClosedDeg;
        const leafBDeg = isOpen ? openDeg : bClosedDeg;
        const midX = cx, midY = cy;
        const tipAX = door.hinge.x + nx * half;
        const tipAY = door.hinge.y + ny * half;
        const tipBX = door.strike.x + nx * half;
        const tipBY = door.strike.y + ny * half;
        const arcASweep = side > 0 ? 0 : 1;
        const arcBSweep = side > 0 ? 1 : 0;

        return (
          <g key={door.id} {...commonPointerHandlers}>
            <line
              x1={door.hinge.x}
              y1={door.hinge.y}
              x2={door.strike.x}
              y2={door.strike.y}
              stroke={COLORS.white}
              strokeWidth={door.thickness + 2}
              strokeLinecap="square"
            />
            <g transform={`translate(${door.hinge.x}, ${door.hinge.y}) rotate(${leafADeg})`}>
              <rect
                x={0}
                y={-CONFIG.doorStyles.panelThickness / 2}
                width={half}
                height={CONFIG.doorStyles.panelThickness}
                fill={COLORS.white}
                stroke={color}
                strokeWidth={CONFIG.doorStyles.panelStrokeWidth}
              />
            </g>
            <g transform={`translate(${door.strike.x}, ${door.strike.y}) rotate(${leafBDeg})`}>
              <rect
                x={0}
                y={-CONFIG.doorStyles.panelThickness / 2}
                width={half}
                height={CONFIG.doorStyles.panelThickness}
                fill={COLORS.white}
                stroke={color}
                strokeWidth={CONFIG.doorStyles.panelStrokeWidth}
              />
            </g>
            {isOpen && (
              <>
                <path
                  d={`M ${tipAX} ${tipAY} A ${half} ${half} 0 0 ${arcASweep} ${midX} ${midY}`}
                  fill="none"
                  stroke={COLORS.doorArc}
                  strokeWidth={CONFIG.doorStyles.arcStrokeWidth}
                  strokeDasharray={CONFIG.doorStyles.arcDashArray}
                />
                <path
                  d={`M ${tipBX} ${tipBY} A ${half} ${half} 0 0 ${arcBSweep} ${midX} ${midY}`}
                  fill="none"
                  stroke={COLORS.doorArc}
                  strokeWidth={CONFIG.doorStyles.arcStrokeWidth}
                  strokeDasharray={CONFIG.doorStyles.arcDashArray}
                />
              </>
            )}
            {/* invisible hitbox spanning the opening */}
            <line
              x1={door.hinge.x}
              y1={door.hinge.y}
              x2={door.strike.x}
              y2={door.strike.y}
              stroke="transparent"
              strokeWidth={Math.max(door.thickness + 8, 16)}
            />
          </g>
        );
      }

      const panelAngleDeg = isOpen
        ? Math.atan2(door.leaf.y - door.hinge.y, door.leaf.x - door.hinge.x) *
          (180 / Math.PI)
        : angleDeg;
      const leafDist = Math.hypot(
        door.leaf.x - door.hinge.x,
        door.leaf.y - door.hinge.y,
      );
      const flipMatrix = `translate(${cx}, ${cy}) rotate(${angleDeg}) scale(${
        door.flipX ? -1 : 1
      }, ${door.flipY ? -1 : 1}) rotate(${-angleDeg}) translate(${-cx}, ${-cy})`;

      return (
        <g key={door.id} {...commonPointerHandlers}>
          <g transform={flipMatrix}>
            <line
              x1={door.hinge.x}
              y1={door.hinge.y}
              x2={door.strike.x}
              y2={door.strike.y}
              stroke={COLORS.white}
              strokeWidth={door.thickness + 2}
              strokeLinecap="square"
            />
            <g
              transform={`translate(${door.hinge.x}, ${door.hinge.y}) rotate(${panelAngleDeg})`}
            >
              <rect
                x={0}
                y={-CONFIG.doorStyles.panelThickness / 2}
                width={leafDist}
                height={CONFIG.doorStyles.panelThickness}
                fill={COLORS.white}
                stroke={color}
                strokeWidth={CONFIG.doorStyles.panelStrokeWidth}
              />
            </g>
            {isOpen && (
              <path
                d={`M ${door.leaf.x} ${door.leaf.y} A ${door.width} ${door.width} 0 0 ${sweepFlag} ${door.strike.x} ${door.strike.y}`}
                fill="none"
                stroke={COLORS.doorArc}
                strokeWidth={CONFIG.doorStyles.arcStrokeWidth}
                strokeDasharray={CONFIG.doorStyles.arcDashArray}
              />
            )}
            <polygon
              points={`${door.hinge.x},${door.hinge.y} ${door.strike.x},${door.strike.y} ${door.leaf.x},${door.leaf.y}`}
              fill="transparent"
            />
          </g>
        </g>
      );
    });


  const renderWindows = () =>
    windows.map((win) => {
      const color = getStroke(win.id, COLORS.window);
      const rot = (win.rotation_rad || 0) * (180 / Math.PI);
      const t = win.thickness || CONFIG.defaultWallThickness;
      const isPatio = !!win.is_patio;
      const paneT = Math.max(2, t / 5);
      const overlap = win.width * 0.04;
      return (
        <g
          key={win.id}
          cursor={calibrationState.active ? "crosshair" : "grab"}
          transform={`translate(${win.center.x}, ${win.center.y}) rotate(${rot})`}
          onPointerDown={(e) => {
            if (drawMode) return;
            e.stopPropagation();
            if (calibrationState.active) {
              handleItemClick(e, win.id, "window");
              return;
            }
            setSelectedId(win.id);
            pushHistory();
            setActiveDrag({ id: win.id, type: "window" });
          }}
          onPointerEnter={() => setHoveredId(win.id)}
          onPointerLeave={() => setHoveredId(null)}
        >
          {!isPatio && (
            <rect
              x={-win.width / 2}
              y={-t / 2}
              width={win.width}
              height={t}
              fill={COLORS.white}
              stroke={color}
              strokeWidth={CONFIG.windowStyles.frameStrokeWidth}
            />
          )}
          {isPatio && (
            <rect
              x={-win.width / 2}
              y={-t / 2}
              width={win.width}
              height={t}
              fill={COLORS.white}
              stroke="none"
            />
          )}

          {isPatio ? (
            <>
              <rect
                x={-win.width / 2}
                y={-t / 6 - paneT / 2}
                width={win.width / 2 + overlap}
                height={paneT}
                fill={COLORS.white}
                stroke={color}
                strokeWidth={CONFIG.windowStyles.paneStrokeWidth}
              />
              <rect
                x={-overlap}
                y={t / 6 - paneT / 2}
                width={win.width / 2 + overlap}
                height={paneT}
                fill={COLORS.white}
                stroke={color}
                strokeWidth={CONFIG.windowStyles.paneStrokeWidth}
              />
            </>
          ) : (
            <>
              <line
                x1={-win.width / 2 + win.width / 3}
                y1={-t / 2}
                x2={-win.width / 2 + win.width / 3}
                y2={t / 2}
                stroke={color}
                strokeWidth={CONFIG.windowStyles.paneStrokeWidth}
              />
              <line
                x1={-win.width / 2 + (win.width * 2) / 3}
                y1={-t / 2}
                x2={-win.width / 2 + (win.width * 2) / 3}
                y2={t / 2}
                stroke={color}
                strokeWidth={CONFIG.windowStyles.paneStrokeWidth}
              />
            </>
          )}

        </g>
      );
    });

  const handleR = 6;

  // Reusable dimension line (parallel to segment, offset perpendicular)
  const renderDimensionLine = (p1: Pt, p2: Pt, key?: string) => {
    const z = viewport.zoom;
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const len = Math.hypot(dx, dy);
    if (len < 0.5) return null;
    const ux = dx / len, uy = dy / len;
    const nx = -uy, ny = ux;
    const gap = handleR * 1.8;
    const ext = gap + 16;
    const tick = 9;
    const sw = 1.5;
    const fontSize = 12;
    const a1x = p1.x + nx * ext, a1y = p1.y + ny * ext;
    const a2x = p2.x + nx * ext, a2y = p2.y + ny * ext;
    const e1x = p1.x + nx * gap, e1y = p1.y + ny * gap;
    const e2x = p2.x + nx * gap, e2y = p2.y + ny * gap;
    const tx = (ux + nx) * (tick / 2);
    const ty = (uy + ny) * (tick / 2);
    const label = formatFtIn(pxToInches(len));
    const mx = (a1x + a2x) / 2, my = (a1y + a2y) / 2;
    let angDeg = (Math.atan2(uy, ux) * 180) / Math.PI;
    if (angDeg > 90) angDeg -= 180;
    else if (angDeg <= -90) angDeg += 180;
    if (angDeg === 90) angDeg = -90;
    const textPad = 4 / z;
    const textBgW = label.length * fontSize * 0.6 + textPad * 2;
    const textBgH = fontSize + textPad;
    return (
      <g key={key} pointerEvents="none">
        <line x1={e1x} y1={e1y} x2={a1x + nx * (tick / 2)} y2={a1y + ny * (tick / 2)} stroke="#000" strokeWidth={sw} />
        <line x1={e2x} y1={e2y} x2={a2x + nx * (tick / 2)} y2={a2y + ny * (tick / 2)} stroke="#000" strokeWidth={sw} />
        <line x1={a1x} y1={a1y} x2={a2x} y2={a2y} stroke="#000" strokeWidth={sw} />
        <line x1={a1x - tx} y1={a1y - ty} x2={a1x + tx} y2={a1y + ty} stroke="#000" strokeWidth={sw} />
        <line x1={a2x - tx} y1={a2y - ty} x2={a2x + tx} y2={a2y + ty} stroke="#000" strokeWidth={sw} />
        <g transform={`translate(${mx}, ${my}) rotate(${angDeg})`}>
          <rect x={-textBgW / 2} y={-textBgH / 2} width={textBgW} height={textBgH} fill="white" />
          <text x={0} y={0} fill="#000" fontSize={fontSize} fontFamily="var(--font-sans)" textAnchor="middle" dominantBaseline="middle">{label}</text>
        </g>
      </g>
    );
  };

  const renderSelectionHandles = () => (
    <g>
      {selectedFloor && (
        <polygon
          points={(selectedFloor.polygon || []).map((p) => `${p.x},${p.y}`).join(" ")}
          fill="none"
          stroke={COLORS.itemSelected}
          strokeWidth={3}
          style={{ pointerEvents: "none" }}
        />
      )}
      {selectedFloor &&
        (selectedFloor.polygon || []).map((pt, idx) => (
          <circle
            key={`floor-pt-${idx}`}
            cx={pt.x}
            cy={pt.y}
            r={handleR}
            fill={COLORS.handleFill}
            stroke={COLORS.itemSelected}
            strokeWidth={CONFIG.handleStrokeWidth}
            cursor="grab"
            onPointerDown={(e) => handleHandleDown(e, selectedFloor.id, idx, "floor")}
          />
        ))}
      {selectedWall && renderDimensionLine(selectedWall.p1, selectedWall.p2)}
      {selectedWall && (
        <>
          <circle
            cx={selectedWall.p1.x}
            cy={selectedWall.p1.y}
            r={handleR}
            fill={COLORS.handleFill}
            stroke={COLORS.itemSelected}
            strokeWidth={CONFIG.handleStrokeWidth}
            cursor="grab"
            onPointerDown={(e) => handleHandleDown(e, selectedWall.id, "p1", "wall")}
          />
          <circle
            cx={selectedWall.p2.x}
            cy={selectedWall.p2.y}
            r={handleR}
            fill={COLORS.handleFill}
            stroke={COLORS.itemSelected}
            strokeWidth={CONFIG.handleStrokeWidth}
            cursor="grab"
            onPointerDown={(e) => handleHandleDown(e, selectedWall.id, "p2", "wall")}
          />
        </>
      )}
      {selectedRailing && renderDimensionLine(selectedRailing.p1, selectedRailing.p2)}
      {selectedRailing && (
        <>
          <circle
            cx={selectedRailing.p1.x}
            cy={selectedRailing.p1.y}
            r={handleR}
            fill={COLORS.handleFill}
            stroke={COLORS.itemSelected}
            strokeWidth={CONFIG.handleStrokeWidth}
            cursor="grab"
            onPointerDown={(e) => handleHandleDown(e, selectedRailing.id, "p1", "railing")}
          />
          <circle
            cx={selectedRailing.p2.x}
            cy={selectedRailing.p2.y}
            r={handleR}
            fill={COLORS.handleFill}
            stroke={COLORS.itemSelected}
            strokeWidth={CONFIG.handleStrokeWidth}
            cursor="grab"
            onPointerDown={(e) => handleHandleDown(e, selectedRailing.id, "p2", "railing")}
          />
        </>
      )}
      {selectedStairs && (() => {
        const shape = selectedStairs.shape ?? "straight";
        const anchor = selectedStairs.rotation_anchor ?? polygonBboxCenter(selectedStairs.polygon);
        const rotationRad = selectedStairs.rotation_rad ?? 0;
        const rotDeg = (rotationRad * 180) / Math.PI;
        const stairWidthPx = inchesToPx(selectedStairs.width_in ?? DEFAULT_STAIR_WIDTH_IN);
        const ends = getStairOpenEnds(selectedStairs.polygon, shape, stairWidthPx);
        const handleR2 = handleR;
        const iconSize = 20;
        // Rotate handle position (LOCAL space) — top-left of bbox, offset outward.
        const bbox = polygonBbox(selectedStairs.polygon);
        const offset = 10;
        const hxLocal = bbox.x - offset;
        const hyLocal = bbox.y - offset;
        const isRotating =
          activeDrag?.type === "stair-rotate" && activeDrag.id === selectedStairs.id;
        // Protractor radius — world-space, drawn at anchor (no rotation transform).
        let protR = 0;
        for (const p of selectedStairs.polygon) {
          const d = Math.hypot(p.x - anchor.x, p.y - anchor.y);
          if (d > protR) protR = d;
        }
        protR += 30 / viewport.zoom;
        const protColor = "#9ca3af";
        return (
          <g>
            {/* Protractor overlay (world space) */}
            {isRotating && (
              <g pointerEvents="none">
                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r={protR}
                  fill="none"
                  stroke={protColor}
                  strokeWidth={1 / viewport.zoom}
                  opacity={0.7}
                />
                {Array.from({ length: 24 }).map((_, i) => {
                  const a = (i * 15 * Math.PI) / 180;
                  const isMajor = i % 6 === 0;
                  const tickLen = (isMajor ? 12 : 6) / viewport.zoom;
                  return (
                    <line
                      key={`tick-${i}`}
                      x1={anchor.x + Math.cos(a) * (protR - tickLen)}
                      y1={anchor.y + Math.sin(a) * (protR - tickLen)}
                      x2={anchor.x + Math.cos(a) * protR}
                      y2={anchor.y + Math.sin(a) * protR}
                      stroke={protColor}
                      strokeWidth={(isMajor ? 1.5 : 1) / viewport.zoom}
                      opacity={0.8}
                    />
                  );
                })}
                <text
                  x={anchor.x}
                  y={anchor.y - 6 / viewport.zoom}
                  fontSize={11 / viewport.zoom}
                  fill="#6b7280"
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {Math.round(rotDeg)}°
                </text>
              </g>
            )}
            {/* Selection outline + handles, rendered in LOCAL space via rotation transform */}
            <g transform={`rotate(${rotDeg} ${anchor.x} ${anchor.y})`}>
              <polygon
                points={selectedStairs.polygon.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={COLORS.itemSelected}
                strokeWidth={1.5 / viewport.zoom}
                strokeDasharray={`${4 / viewport.zoom},${3 / viewport.zoom}`}
                style={{ pointerEvents: "none" }}
              />
              {ends.map((ed, i) => (
                <circle
                  key={i}
                  cx={ed.mid.x}
                  cy={ed.mid.y}
                  r={handleR*0.75}
                  fill={COLORS.handleFill}
                  stroke={COLORS.itemSelected}
                  strokeWidth={CONFIG.handleStrokeWidth*0.75}
                  style={{ cursor: ed.cursor }}
                  onPointerDown={(e) => {
                    if (drawMode || calibrationState.active) return;
                    e.stopPropagation();
                    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                    const sp = getSvgPoint(e.clientX, e.clientY);
                    if (!sp) return;
                    pushHistory();
                    setActiveDrag({
                      id: selectedStairs.id,
                      type: "stair-end",
                      axis: ed.axis,
                      sign: ed.sign,
                      vertexIndices: ed.vertexIndices,
                      clampAgainstIndices: ed.clampAgainstIndices,
                      origPolygon: selectedStairs.polygon.map((p) => ({ ...p })),
                      startSvg: sp,
                      rotation: rotationRad,
                      origStart: selectedStairs.start ? { ...selectedStairs.start } : undefined,
                      origEnd: selectedStairs.end ? { ...selectedStairs.end } : undefined,
                    });

                  }}
                />
              ))}
              {/* Rotate handle (local space) */}
              <g
                style={{ cursor: "grab" }}
                onPointerDown={(e) => {
                  if (e.button !== 0) return;
                  if (drawMode || calibrationState.active) return;
                  e.stopPropagation();
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                  const sp = getSvgPoint(e.clientX, e.clientY);
                  if (!sp) return;
                  pushHistory();
                  const startAngle =
                    Math.atan2(sp.y - anchor.y, sp.x - anchor.x) * (180 / Math.PI);
                  setActiveDrag({
                    id: selectedStairs.id,
                    type: "stair-rotate",
                    cx: anchor.x,
                    cy: anchor.y,
                    startAngle,
                    origRotationDeg: rotDeg,
                  });
                }}
              >
                <circle
                  cx={hxLocal}
                  cy={hyLocal}
                  r={handleR2}
                  fill="white"
                  stroke="none"
                />
                <foreignObject
                  x={hxLocal - iconSize / 2}
                  y={hyLocal - iconSize / 2}
                  width={iconSize}
                  height={iconSize}
                  style={{ pointerEvents: "none" }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: COLORS.itemSelected,
                    }}
                  >
                    <Custom_Rotate size={iconSize} />
                  </div>
                </foreignObject>
              </g>
            </g>
          </g>
        );
      })()}

      {selectedText && editingTextId !== selectedText.id && (() => {
        const fs = (selectedText.fontSize ?? 7) * PIXELS_PER_WORLD_INCH;
        const pad = fs * 0.3;
        const w = Math.max(fs, (selectedText.text || " ").length * fs * 0.6) + pad * 2;
        const h = fs + pad * 2;
        const cx = selectedText.x;
        const cy = selectedText.y;
        const x0 = cx - w / 2;
        const y0 = cy - h / 2;
        const corners: Array<{ x: number; y: number; cursor: string }> = [
          { x: x0, y: y0, cursor: "nwse-resize" },
          { x: x0 + w, y: y0, cursor: "nesw-resize" },
          { x: x0 + w, y: y0 + h, cursor: "nwse-resize" },
          { x: x0, y: y0 + h, cursor: "nesw-resize" },
        ];
        const hSize = handleR;
        return (
          <g>
            <rect
              x={x0}
              y={y0}
              width={w}
              height={h}
              fill="none"
              stroke={COLORS.itemSelected}
              strokeWidth={1.5 / viewport.zoom}
              strokeDasharray={`${4 / viewport.zoom},${3 / viewport.zoom}`}
              style={{ pointerEvents: "none" }}
            />
            {corners.map((c, i) => (
              <circle
                key={`txt-handle-${i}`}
                cx={c.x}
                cy={c.y}
                r={hSize*0.45}
                fill={COLORS.handleFill}
                stroke={COLORS.itemSelected}
                strokeWidth={CONFIG.handleStrokeWidth*0.6}
                style={{ cursor: c.cursor }}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                  const sp = getSvgPoint(e.clientX, e.clientY);
                  if (!sp) return;
                  const dist = Math.hypot(sp.x - cx, sp.y - cy);
                  setActiveDrag({
                    id: selectedText.id,
                    type: "text-resize",
                    origFontSize: selectedText.fontSize ?? 7,
                    origDist: Math.max(dist, 1),
                    cx,
                    cy,
                  });
                }}
              />
            ))}
          </g>
        );
      })()}
      {selectedFurniture && selectedFurniture.back_edge && selectedFurniture.corners && selectedFurniture.corners.length >= 3 && (() => {
        const f = selectedFurniture;
        const p1 = f.back_edge!.p1, p2 = f.back_edge!.p2;
        const dx = p2.x - p1.x, dy = p2.y - p1.y;
        const L = Math.hypot(dx, dy);
        if (L < 0.5) return null;
        const ux = dx / L, uy = dy / L;
        let nx = -uy, ny = ux;
        const cx = f.corners.reduce((s, p) => s + p.x, 0) / f.corners.length;
        const cy = f.corners.reduce((s, p) => s + p.y, 0) / f.corners.length;
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
        // Make normal point toward interior (centroid) for length-projection
        if ((cx - mx) * nx + (cy - my) * ny < 0) { nx = -nx; ny = -ny; }
        let maxProj = 0;
        for (const c of f.corners) {
          const proj = (c.x - p1.x) * nx + (c.y - p1.y) * ny;
          if (proj > maxProj) maxProj = proj;
        }
        // Width dim on back side (outside) → pass (p2, p1) so renderDimensionLine's
        // default normal (-uy, ux) flips to point away from centroid.
        const backN = { x: -uy, y: ux };
        const backOutsideFirst = (cx - mx) * backN.x + (cy - my) * backN.y < 0;
        const widthArgs: [Pt, Pt] = backOutsideFirst ? [p1, p2] : [p2, p1];
        // Length dim along the left side edge (from p1 to its front corner)
        const sideEnd = { x: p1.x + nx * maxProj, y: p1.y + ny * maxProj };
        const sideN = { x: -(sideEnd.y - p1.y) / Math.max(maxProj, 1), y: (sideEnd.x - p1.x) / Math.max(maxProj, 1) };
        const sideMx = (p1.x + sideEnd.x) / 2, sideMy = (p1.y + sideEnd.y) / 2;
        const sideOutsideFirst = (cx - sideMx) * sideN.x + (cy - sideMy) * sideN.y < 0;
        const lengthArgs: [Pt, Pt] = sideOutsideFirst ? [p1, sideEnd] : [sideEnd, p1];
        return (
          <>
            {renderDimensionLine(widthArgs[0], widthArgs[1], `${f.id}-dim-w`)}
            {renderDimensionLine(lengthArgs[0], lengthArgs[1], `${f.id}-dim-l`)}
          </>
        );
      })()}
      {selectedFurniture && selectedFurniture.corners && selectedFurniture.corners.length >= 3 && (() => {
        const f = selectedFurniture;
        // Anchor = rotation center (back-edge midpoint or centroid)
        const anchor = f.back_edge
          ? {
              x: (f.back_edge.p1.x + f.back_edge.p2.x) / 2,
              y: (f.back_edge.p1.y + f.back_edge.p2.y) / 2,
            }
          : {
              x: f.corners.reduce((s, p) => s + p.x, 0) / f.corners.length,
              y: f.corners.reduce((s, p) => s + p.y, 0) / f.corners.length,
            };
        // Place rotate handle near the back-left corner of the footprint.
        // back-left = back_edge.p1 if defined, else first corner.
        const blCorner = f.back_edge ? f.back_edge.p1 : f.corners[0];
        // Direction outward = away from anchor.
        const outDx = blCorner.x - anchor.x;
        const outDy = blCorner.y - anchor.y;
        const outLen = Math.hypot(outDx, outDy) || 1;
        const offset = 20;
        const hx = blCorner.x + (outDx / outLen) * offset;
        const hy = blCorner.y + (outDy / outLen) * offset - 15;
        const handleR2 = handleR;
        const iconSize = 20;
        const hitR = 15 / viewport.zoom;
        const isRotating = activeDrag?.type === "furniture-rotate" && activeDrag.id === f.id;
        // Approx radius for protractor = farthest corner distance from anchor
        let protR = 0;
        for (const c of f.corners) {
          const d = Math.hypot(c.x - anchor.x, c.y - anchor.y);
          if (d > protR) protR = d;
        }
        protR = protR + 30 / viewport.zoom;
        const protColor = "#9ca3af";
        return (
          <g>
            {isRotating && (
              <g pointerEvents="none">
                <circle
                  cx={anchor.x}
                  cy={anchor.y}
                  r={protR}
                  fill="none"
                  stroke={protColor}
                  strokeWidth={1 / viewport.zoom}
                  opacity={0.7}
                />
                {Array.from({ length: 24 }).map((_, i) => {
                  const a = (i * 15 * Math.PI) / 180;
                  const isMajor = i % 6 === 0;
                  const tickLen = (isMajor ? 12 : 6) / viewport.zoom;
                  const x1 = anchor.x + Math.cos(a) * (protR - tickLen);
                  const y1 = anchor.y + Math.sin(a) * (protR - tickLen);
                  const x2 = anchor.x + Math.cos(a) * protR;
                  const y2 = anchor.y + Math.sin(a) * protR;
                  return (
                    <line
                      key={`tick-${i}`}
                      x1={x1}
                      y1={y1}
                      x2={x2}
                      y2={y2}
                      stroke={protColor}
                      strokeWidth={(isMajor ? 1.5 : 1) / viewport.zoom}
                      opacity={0.8}
                    />
                  );
                })}
                {[0, 90, 180, 270].map((deg) => {
                  const a = (deg * Math.PI) / 180;
                  const tx = anchor.x + Math.cos(a) * (protR + 14 / viewport.zoom);
                  const ty = anchor.y + Math.sin(a) * (protR + 14 / viewport.zoom);
                  return (
                    <text
                      key={`lbl-${deg}`}
                      x={tx}
                      y={ty}
                      fontSize={10 / viewport.zoom}
                      fill={protColor}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      {deg}°
                    </text>
                  );
                })}
                {/* current angle indicator line */}
                <line
                  x1={anchor.x}
                  y1={anchor.y}
                  x2={anchor.x + Math.cos(((f.angle_deg ?? 0) * Math.PI) / 180) * protR}
                  y2={anchor.y + Math.sin(((f.angle_deg ?? 0) * Math.PI) / 180) * protR}
                  stroke={protColor}
                  strokeWidth={1.5 / viewport.zoom}
                  opacity={0.9}
                />
                <text
                  x={anchor.x}
                  y={anchor.y - 6 / viewport.zoom}
                  fontSize={11 / viewport.zoom}
                  fill="#6b7280"
                  fontWeight={700}
                  textAnchor="middle"
                >
                  {Math.round(f.angle_deg ?? 0)}°
                </text>
              </g>
            )}
            {/* Rotate handle */}
            <g
              style={{ cursor: "grab" }}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.stopPropagation();
                (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                pushHistory();
                const startAngle = Math.atan2(hy - anchor.y, hx - anchor.x) * (180 / Math.PI);
                setActiveDrag({
                  id: f.id,
                  type: "furniture-rotate",
                  cx: anchor.x,
                  cy: anchor.y,
                  startAngle,
                  origItemAngle: f.angle_deg ?? 0,
                  origCorners: f.corners.map((c) => ({ ...c })),
                  origBackEdge: f.back_edge
                    ? { p1: { ...f.back_edge.p1 }, p2: { ...f.back_edge.p2 } }
                    : undefined,
                });
              }}
            >
              <circle
                cx={hx}
                cy={hy}
                r={hitR}
                fill="transparent"
                style={{ pointerEvents: "all" }}
              />
              <foreignObject
                x={hx - iconSize / 2}
                y={hy - iconSize / 2}
                width={iconSize}
                height={iconSize}
                style={{ pointerEvents: "none" }}
              >
                <div
                  style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: COLORS.itemSelected,
                  }}
                >
                  <Custom_Rotate size={iconSize} />
                </div>
              </foreignObject>
            </g>
          </g>
        );
      })()}
      {showAllWallDims && !isSelected && walls.map((w) => renderDimensionLine(w.p1, w.p2, `all-dim-${w.id}`))}
    </g>
  );

  const renderCalibrationEndpoints = () => {
    if (!calibrationState.active) return null;
    return walls.map((wall) => (
      <g key={`calib-${wall.id}`}>
        <circle
          className="calib-handle"
          cx={wall.p1.x}
          cy={wall.p1.y}
          r={handleR + 2}
          cursor="crosshair"
          onPointerDown={(e) => handleHandleDown(e, wall.id, "p1", "wall")}
        />
        <circle
          className="calib-handle"
          cx={wall.p2.x}
          cy={wall.p2.y}
          r={handleR + 2}
          cursor="crosshair"
          onPointerDown={(e) => handleHandleDown(e, wall.id, "p2", "wall")}
        />
      </g>
    ));
  };

  // ============================================================================
  // UI
  // ============================================================================
  // Area of master polygon (first floor) using shoelace, converted px²→ft²
  const polygonAreaSqFt = (poly: Pt[] | undefined) => {
    if (!poly?.length || pixelsPerFoot <= 0) return 0;
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      area += a.x * b.y - b.x * a.y;
    }
    return Math.abs(area) / 2 / (pixelsPerFoot * pixelsPerFoot);
  };
  const masterFloorAreaSqFt = useMemo(() => {
    if (!floors.length || pixelsPerFoot <= 0) return 0;

    // ESCAPE HATCH: Do not run heavy boolean math while actively dragging.
    // This prevents the infinite loop crashes when shapes temporarily self-intersect.
    if (activeDrag) {
      return floors.reduce((s, f) => s + polygonAreaSqFt(f.polygon), 0);
    }

    try {
      const polys = floors
        .map((f) => f.polygon)
        .filter((p) => p && p.length >= 3)
        .map((p) => [[...p.map((pt) => [pt.x, pt.y]), [p[0].x, p[0].y]]] as [number, number][][]);
      if (!polys.length) return 0;
      const unioned = polygonClipping.union(polys[0], ...polys.slice(1));
      let totalPx2 = 0;
      for (const multi of unioned) {
        for (let r = 0; r < multi.length; r++) {
          const ring = multi[r];
          let a = 0;
          for (let i = 0; i < ring.length - 1; i++) {
            a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
          }
          totalPx2 += (r === 0 ? 1 : -1) * Math.abs(a) / 2;
        }
      }
      return totalPx2 / (pixelsPerFoot * pixelsPerFoot);
    } catch {
      return floors.reduce((s, f) => s + polygonAreaSqFt(f.polygon), 0);
    }
  }, [floors, pixelsPerFoot, activeDrag]);

  const overviewStats = [
    { label: "Walls", count: walls.length, Icon: Slash },
    { label: "Doors", count: doors.length, Icon: DoorOpen },
    { label: "Windows", count: windows.length, Icon: Custom_Window },
  ];
  const isSelected = !!(selectedFloor || selectedWall || selectedDoor || selectedWindow || selectedFurniture || selectedText || selectedStructure);

  return (
    <TooltipProvider delayDuration={100}>
      <div className="relative h-screen w-screen overflow-hidden bg-background text-foreground">
      {/* LEFT FLOATING PANEL */}
      <aside className="absolute top-4 left-4 bottom-4 z-20 w-[320px] flex flex-col rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center">
              <Layers className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight leading-tight">
                Floorforge
              </h1>
              <p className="text-[11px] text-muted-foreground leading-tight">
                2D plan editor
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5 bg-background">
          {/* File */}
          <section>
            <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
              Plan
            </h2>
            <div className="rounded-md bg-card border border-border px-3 py-2 flex items-center gap-2 mb-2">
              <FileJson className="h-4 w-4 text-primary shrink-0" />
              <span className="text-xs truncate">{planName}</span>
            </div>
            <Button
              variant="default"
              className="w-full justify-start gap-2"
              onClick={() => setUploadDialogOpen(true)}
            >
              <Upload className="h-4 w-4" />
              Upload Plan(s)
            </Button>
          </section>

          <Separator />

          {/* OVERVIEW (when nothing selected) OR CONFIGURATION (when selected) */}
          {viewMode === "2D" && !isSelected && (
            <section>
              <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Overview
              </h2>
              <div className="rounded-md bg-card border border-border px-3 py-2.5 mb-2 flex items-center gap-2">
                <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
                  <Home className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <div className="text-[11px] text-muted-foreground">Total floor area</div>
                  <div className="text-base font-semibold font-mono">
                    {masterFloorAreaSqFt.toFixed(0)} <span className="text-xs text-muted-foreground font-sans">sq ft</span>
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {overviewStats.map(({ label, count, Icon }) => (
                  <div
                    key={label}
                    className="rounded-md bg-card border border-border px-2.5 py-2 flex flex-col gap-1"
                  >
                    <Icon className="h-3.5 w-3.5 text-primary" />
                    <div className="text-[10px] text-muted-foreground leading-none">{label}</div>
                    <div className="text-sm font-semibold font-mono leading-none">{count}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3">
                <label className="text-[11px] text-muted-foreground mb-1 block">Ceiling height</label>
                <FtInStepper
                  totalIn={ceilingHeightIn}
                  onChange={(v) => setCeilingHeightIn(Math.max(12, v))}
                  min={12}
                />
              </div>
              <div className="mt-3 flex items-center justify-between rounded-md border border-border bg-card px-3 py-2">
                <label htmlFor="show-all-wall-dims" className="text-xs text-foreground cursor-pointer">
                  Show all wall dimensions
                </label>
                <Switch
                  id="show-all-wall-dims"
                  checked={showAllWallDims}
                  onCheckedChange={setShowAllWallDims}
                />
              </div>
            </section>
          )}

          {isSelected && (
            <section>
              <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Configuration
              </h2>

              {selectedFloor && (
                <div className="space-y-3 rounded-md bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Custom_Polygon className="h-3.5 w-3.5 text-primary" /> Room
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedFloor.id.slice(0, 10)}
                    </span>
                  </div>
                  <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2 flex items-center gap-2">
                    <Home className="h-4 w-4 text-primary" />
                    <div className="flex-1">
                      <div className="text-[11px] text-muted-foreground">Area</div>
                      <div className="text-base font-semibold font-mono">
                        {polygonAreaSqFt(selectedFloor.polygon).toFixed(0)}{" "}
                        <span className="text-xs text-muted-foreground font-sans">sq ft</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Vertices: <span className="text-foreground font-mono">{selectedFloor.polygon?.length || 0}</span>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelectedItem}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete floor
                  </Button>
                </div>
              )}

              {selectedWall && (
                <div className="space-y-3 rounded-md bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Slash className="h-3.5 w-3.5 text-primary" /> Wall
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedWall.id.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Length</span>
                    <span className="font-mono text-foreground">
                      {formatFtIn(pxToInches(Math.hypot(selectedWall.p2.x - selectedWall.p1.x, selectedWall.p2.y - selectedWall.p1.y)))}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex justify-between mb-2">
                      <span>Thickness</span>
                      <span className="font-mono text-foreground">
                        {pxToInches(selectedWall.thickness).toFixed(1)}″
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Slider
                        min={1}
                        max={24}
                        step={0.1}
                        value={[pxToInches(selectedWall.thickness)]}
                        onValueChange={(v) => {
                          const px = inchesToPx(v[0]);
                          setWalls((prev) =>
                            prev.map((w) => (w.id === selectedId ? { ...w, thickness: px } : w)),
                          );
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        step={0.1}
                        value={pxToInches(selectedWall.thickness)}
                        onChange={(e) => {
                          const px = inchesToPx(Number(e.target.value));
                          setWalls((prev) =>
                            prev.map((w) =>
                              w.id === selectedId ? { ...w, thickness: px } : w,
                            ),
                          );
                        }}
                        className="w-16 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelectedItem}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete wall
                  </Button>
                </div>
              )}

              {selectedRailing && (
                <div className="space-y-3 rounded-md bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      <Grip className="h-3.5 w-3.5 text-primary" /> Railing
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedRailing.id.slice(0, 10)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Length</span>
                    <span className="font-mono text-foreground">
                      {formatFtIn(pxToInches(Math.hypot(selectedRailing.p2.x - selectedRailing.p1.x, selectedRailing.p2.y - selectedRailing.p1.y)))}
                    </span>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground flex justify-between mb-2">
                      <span>Thickness</span>
                      <span className="font-mono text-foreground">
                        {pxToInches(selectedRailing.thickness).toFixed(1)}″
                      </span>
                    </label>
                    <div className="flex items-center gap-2">
                      <Slider
                        min={1}
                        max={12}
                        step={0.1}
                        value={[pxToInches(selectedRailing.thickness)]}
                        onValueChange={(v) => {
                          const px = inchesToPx(v[0]);
                          setStructures((prev) =>
                            prev.map((s) =>
                              s.id === selectedId && s.kind === "railing" ? { ...s, thickness: px } : s,
                            ),
                          );
                        }}
                        className="flex-1"
                      />
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        step={0.1}
                        value={pxToInches(selectedRailing.thickness)}
                        onChange={(e) => {
                          const px = inchesToPx(Number(e.target.value));
                          setStructures((prev) =>
                            prev.map((s) =>
                              s.id === selectedId && s.kind === "railing" ? { ...s, thickness: px } : s,
                            ),
                          );
                        }}
                        className="w-16 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelectedItem}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete railing
                  </Button>
                </div>
              )}

              {selectedStairs && (() => {
                const shape = selectedStairs.shape ?? "straight";
                const label = shape === "L" ? "L-Shaped Stairs" : shape === "U" ? "U-Shaped Stairs" : "Straight Stairs";
                const bbox = polygonBbox(selectedStairs.polygon);
                const longPx = Math.max(bbox.w, bbox.h);
                const widthIn = selectedStairs.width_in ?? DEFAULT_STAIR_WIDTH_IN;
                const changeShape = (newShape: "straight" | "L" | "U") => {
                  pushHistory();
                  const widthPx = inchesToPx(widthIn);
                  setStructures((prev) =>
                    prev.map((s) => {
                      if (s.id !== selectedId || s.kind !== "stairs") return s;
                      const curBbox = polygonBbox(s.polygon);
                      const target = s.rotation_anchor ?? polygonBboxCenter(s.polygon);
                      const built = buildStairPolygonForShape(newShape, curBbox, widthPx);
                      const builtBbox = polygonBbox(built);
                      const dx = target.x - (builtBbox.x + builtBbox.w / 2);
                      const dy = target.y - (builtBbox.y + builtBbox.h / 2);
                      const newPoly = built.map((p) => ({ x: p.x + dx, y: p.y + dy }));
                      return { ...s, shape: newShape, polygon: newPoly, rotation_anchor: target };
                    }),
                  );
                };
                const changeWidth = (newWidthIn: number) => {
                  pushHistory();
                  const widthPx = inchesToPx(newWidthIn);
                  setStructures((prev) =>
                    prev.map((s) => {
                      if (s.id !== selectedId || s.kind !== "stairs") return s;
                      const sh = s.shape ?? "straight";
                      const curBbox = polygonBbox(s.polygon);
                      const target = s.rotation_anchor ?? polygonBboxCenter(s.polygon);
                      let resized: Pt[];
                      if (sh === "straight") {
                        resized = enforceStraightStairWidth(s.polygon, widthPx);
                      } else {
                        // Preserve current orientation (L corner / U gap) when rebuilding.
                        const curWidthPx = inchesToPx(s.width_in ?? DEFAULT_STAIR_WIDTH_IN);
                        const orientation = analyzeStairOrientationFromJson(s.polygon, sh, curWidthPx);
                        resized = buildStairPolygonOriented(orientation, curBbox, widthPx);
                      }
                      const rBbox = polygonBbox(resized);
                      const dx = target.x - (rBbox.x + rBbox.w / 2);
                      const dy = target.y - (rBbox.y + rBbox.h / 2);
                      const newPoly = resized.map((p) => ({ x: p.x + dx, y: p.y + dy }));
                      return { ...s, width_in: newWidthIn, polygon: newPoly, rotation_anchor: target };
                    }),
                  );
                };

                return (
                  <div className="space-y-3 rounded-md bg-card border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold flex items-center gap-1.5">
                        <ChevronsUp className="h-3.5 w-3.5 text-primary" /> {label}
                        {selectedStairs.direction && (
                          <span
                            className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-primary/10 text-primary border border-primary/20"
                            title={
                              selectedStairs.direction === "UP"
                                ? "Ascends to floor above"
                                : "Descends to floor below"
                            }
                          >
                            {selectedStairs.direction}
                            {selectedStairs.spans_to_floor === 2 ? " · Master" : ""}
                          </span>
                        )}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {selectedStairs.id.slice(0, 10)}
                      </span>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Stair type</label>
                      <Select value={shape} onValueChange={(v) => changeShape(v as "straight" | "L" | "U")}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="straight">Straight</SelectItem>
                          <SelectItem value="L">L-Shaped</SelectItem>
                          <SelectItem value="U">U-Shaped</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Width</label>
                      <Select value={String(widthIn)} onValueChange={(v) => changeWidth(Number(v))}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="36">3 ft (36″)</SelectItem>
                          <SelectItem value="42">3.5 ft (42″)</SelectItem>
                          <SelectItem value="48">4 ft (48″)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1.5 block">Treads (steps)</label>
                      <Input
                        type="number"
                        min={2}
                        max={30}
                        value={selectedStairs.tread_count ?? 13}
                        onChange={(e) => {
                          const n = Math.max(2, Math.min(30, Math.floor(Number(e.target.value) || 0)));
                          pushHistory();
                          setStructures((prev) =>
                            prev.map((st) =>
                              st.id === selectedId && st.kind === "stairs"
                                ? { ...st, tread_count: n }
                                : st,
                            ),
                          );
                        }}
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Run length</span>
                      <span className="font-mono text-foreground">
                        {formatFtIn(pxToInches(longPx))}
                      </span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => {
                        pushHistory();
                        setStructures((prev) =>
                          prev.map((st) => {
                            if (st.id !== selectedId || st.kind !== "stairs") return st;
                            const stairWidthPx = inchesToPx(st.width_in ?? DEFAULT_STAIR_WIDTH_IN);
                            const ends = getStairOpenEnds(st.polygon, st.shape ?? "straight", stairWidthPx);
                            const curStart = st.start ?? ends[0]?.mid;
                            const curEnd = st.end ?? ends[1]?.mid;
                            if (!curStart || !curEnd) return st;
                            return { ...st, start: { ...curEnd }, end: { ...curStart } };
                          }),
                        );
                      }}
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5" /> Switch Start/End
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2"
                      onClick={deleteSelectedItem}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete stairs
                    </Button>
                  </div>
                );
              })()}


              {selectedDoor && (
                <div className="space-y-3 rounded-md bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      {selectedDoor.is_arch ? (
                        <DoorOpen className="h-3.5 w-3.5 text-primary" />
                      ) : selectedDoor.is_double ? (
                        <Custom_SlidingDoor className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <DoorOpen className="h-3.5 w-3.5 text-primary" />
                      )}
                      {selectedDoor.is_arch ? "Arch" : selectedDoor.is_double ? "Double Door" : "Door"}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedDoor.id.slice(0, 10)}
                    </span>
                  </div>
                  {(() => {
                    const widthIn = pxToInches(selectedDoor.width);
                    const heightIn = selectedDoor.height_in ?? 80;
                    const resizeDoor = (door: Door, newWidthPx: number): Door => {
                      const w = door.width || 1;
                      const ux = (door.strike.x - door.hinge.x) / w;
                      const uy = (door.strike.y - door.hinge.y) / w;
                      const px = (door.leaf.x - door.hinge.x) / w;
                      const py = (door.leaf.y - door.hinge.y) / w;
                      return {
                        ...door,
                        width: newWidthPx,
                        strike: { x: door.hinge.x + ux * newWidthPx, y: door.hinge.y + uy * newWidthPx },
                        leaf: { x: door.hinge.x + px * newWidthPx, y: door.hinge.y + py * newWidthPx },
                      };
                    };
                    const setWidth = (inches: number, all: boolean) => {
                      const newPx = inchesToPx(Math.max(1, inches));
                      const isDouble = !!selectedDoor.is_double;
                      const isArch = !!selectedDoor.is_arch;
                      const matchesGroup = (d: Door) =>
                        !!d.is_arch === isArch && (isArch ? true : !!d.is_double === isDouble);
                      pushHistory();
                      setDoors((prev) =>
                        prev.map((d) =>
                          (all ? matchesGroup(d) : d.id === selectedId)
                            ? resizeDoor(d, newPx)
                            : d,
                        ),
                      );
                    };
                    const setHeight = (inches: number, all: boolean) => {
                      const isDouble = !!selectedDoor.is_double;
                      const isArch = !!selectedDoor.is_arch;
                      const matchesGroup = (d: Door) =>
                        !!d.is_arch === isArch && (isArch ? true : !!d.is_double === isDouble);
                      pushHistory();
                      setDoors((prev) =>
                        prev.map((d) =>
                          (all ? matchesGroup(d) : d.id === selectedId)
                            ? { ...d, height_in: Math.max(1, Math.round(inches)) }
                            : d,
                        ),
                      );
                    };
                    const DOOR_WIDTHS = [
                      { label: `2'-4"`, value: 28 },
                      { label: `2'-6"`, value: 30 },
                      { label: `2'-8"`, value: 32 },
                      { label: `3'-0"`, value: 36 },
                    ];
                    const DOUBLE_DOOR_WIDTHS = [
                      { label: `4'-0"`, value: 48 },
                      { label: `5'-0"`, value: 60 },
                      { label: `6'-0"`, value: 72 },
                    ];
                    const widthOptions = selectedDoor.is_double ? DOUBLE_DOOR_WIDTHS : DOOR_WIDTHS;
                    const DOOR_HEIGHTS = [
                      { label: `6'-8"`, value: 80 },
                      { label: `8'-0"`, value: 96 },
                    ];
                    const nearestWidth = widthOptions.reduce((a, b) =>
                      Math.abs(b.value - widthIn) < Math.abs(a.value - widthIn) ? b : a,
                    ).value;

                    const nearestHeight = DOOR_HEIGHTS.reduce((a, b) =>
                      Math.abs(b.value - heightIn) < Math.abs(a.value - heightIn) ? b : a,
                    ).value;
                    return (
                      <div className="space-y-2">
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">Width</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select value={String(nearestWidth)} onValueChange={(v) => setWidth(Number(v), false)}>
                                <SelectTrigger className="h-8 text-xs [&>span]:flex-1 [&>span]:text-center">

                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {widthOptions.map((o) => (
                                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                                      {o.label}
                                    </SelectItem>
                                  ))}

                                </SelectContent>
                              </Select>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] px-2" onClick={() => setWidth(nearestWidth, true)}>
                              Apply to All
                            </Button>
                          </div>
                        </div>
                        <div>
                          <label className="text-[11px] text-muted-foreground mb-1 block">Height</label>
                          <div className="flex items-center gap-2">
                            <div className="flex-1">
                              <Select value={String(nearestHeight)} onValueChange={(v) => setHeight(Number(v), false)}>
                                <SelectTrigger className="h-8 text-xs [&>span]:flex-1 [&>span]:text-center">

                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {DOOR_HEIGHTS.map((o) => (
                                    <SelectItem key={o.value} value={String(o.value)} className="text-xs">
                                      {o.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <Button variant="outline" size="sm" className="h-8 text-[10px] px-2" onClick={() => setHeight(nearestHeight, true)}>
                              Apply to All
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })()}
                  {!selectedDoor.is_arch && (
                    <div className={cn("grid gap-2", selectedDoor.is_double ? "grid-cols-1" : "grid-cols-2")}>
                      {!selectedDoor.is_double && (
                        <Button
                          variant="secondary"
                          size="sm"
                          className="gap-1.5"
                          onClick={() => {
                            pushHistory();
                            setDoors((p) =>
                              p.map((d) =>
                                d.id === selectedId ? { ...d, flipX: !d.flipX } : d,
                              ),
                            );
                          }}
                        >
                          <FlipHorizontal className="h-3.5 w-3.5" /> Flip L/R
                        </Button>
                      )}
                      <Button
                        variant="secondary"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => {
                          pushHistory();
                          setDoors((p) =>
                            p.map((d) =>
                              d.id === selectedId ? { ...d, flipY: !d.flipY } : d,
                            ),
                          );
                        }}
                      >
                        <FlipVertical className="h-3.5 w-3.5" /> Flip In/Out
                      </Button>
                    </div>
                  )}
                  {!selectedDoor.is_arch && (
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => {
                        pushHistory();
                        setDoors((p) =>
                          p.map((d) =>
                            d.id === selectedId
                              ? { ...d, open: !(d.open !== false) }
                              : d,
                          ),
                        );
                      }}
                    >
                      {selectedDoor.open !== false ? (
                        <>
                          <DoorClosed className="h-3.5 w-3.5" /> {selectedDoor.is_double ? "Close doors" : "Close door"}
                        </>
                      ) : (
                        <>
                          <DoorOpen className="h-3.5 w-3.5" /> {selectedDoor.is_double ? "Open doors" : "Open door"}
                        </>
                      )}
                    </Button>
                  )}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelectedItem}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> {selectedDoor.is_arch ? "Delete arch" : "Delete door"}
                  </Button>
                </div>
              )}

              {selectedWindow && (
                <div className="space-y-3 rounded-md bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold flex items-center gap-1.5">
                      {selectedWindow.is_patio ? (
                        <PanelLeftOpen className="h-3.5 w-3.5 text-primary" />
                      ) : (
                        <Custom_Window className="h-3.5 w-3.5 text-primary" />
                      )}
                      {selectedWindow.is_patio ? "Patio Door" : "Window"}
                    </span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedWindow.id.slice(0, 10)}
                    </span>
                  </div>
                  {(() => {
                    const CEILING_IN = ceilingHeightIn;
                    const isPatio = !!selectedWindow.is_patio;
                    const widthIn = pxToInches(selectedWindow.width);
                    const heightInRaw = selectedWindow.height_in ?? (isPatio ? 80 : 48);
                    const sillInRaw = selectedWindow.sill_height_in ?? (isPatio ? 0 : 36);
                    const heightIn = Math.min(heightInRaw, CEILING_IN);
                    const sillIn = isPatio ? 0 : Math.min(sillInRaw, Math.max(0, CEILING_IN - heightIn));
                    const fromCeilIn = Math.max(0, CEILING_IN - heightIn - sillIn);
                    const updateWindow = (patch: Partial<WindowItem>, history = true) => {
                      if (history) pushHistory();
                      setWindows((prev) =>
                        prev.map((w) => (w.id === selectedId ? { ...w, ...patch } : w)),
                      );
                    };
                    const setSill = (v: number) => {
                      const sill = Math.max(0, Math.min(CEILING_IN - heightIn, Math.round(v)));
                      updateWindow({ sill_height_in: sill, dist_from_ceiling_in: CEILING_IN - heightIn - sill });
                    };
                    const setFromCeil = (v: number) => {
                      const dc = Math.max(0, Math.min(CEILING_IN - heightIn, Math.round(v)));
                      updateWindow({ dist_from_ceiling_in: dc, sill_height_in: CEILING_IN - heightIn - dc });
                    };
                    const setHeight = (v: number) => {
                      if (isPatio) {
                        const h = Math.max(1, Math.min(CEILING_IN, Math.round(v)));
                        updateWindow({ height_in: h, sill_height_in: 0, dist_from_ceiling_in: CEILING_IN - h });
                      } else {
                        const h = Math.max(1, Math.min(CEILING_IN - fromCeilIn, Math.round(v)));
                        updateWindow({ height_in: h, sill_height_in: CEILING_IN - h - fromCeilIn });
                      }
                    };
                    const WINDOW_WIDTHS = [24, 36, 48, 60, 72, 84, 96, 108, 120];
                    const WINDOW_HEIGHTS = [24, 36, 48, 60, 72];
                    const PATIO_WIDTHS = [60, 72, 96];
                    const PATIO_HEIGHTS = [80, 96];
                    const widthOptions = isPatio ? PATIO_WIDTHS : WINDOW_WIDTHS;
                    const heightOptions = isPatio ? PATIO_HEIGHTS : WINDOW_HEIGHTS;
                    const nearestWinW = widthOptions.reduce((a, b) =>
                      Math.abs(b - widthIn) < Math.abs(a - widthIn) ? b : a,
                    );
                    const nearestWinH = heightOptions.reduce((a, b) =>
                      Math.abs(b - heightIn) < Math.abs(a - heightIn) ? b : a,
                    );
                    const togglePatio = (on: boolean) => {
                      pushHistory();
                      if (on) {
                        const snappedW = PATIO_WIDTHS.reduce((a, b) =>
                          Math.abs(b - widthIn) < Math.abs(a - widthIn) ? b : a,
                        );
                        const h = 80;
                        updateWindow(
                          {
                            is_patio: true,
                            width: inchesToPx(snappedW),
                            height_in: h,
                            sill_height_in: 0,
                            dist_from_ceiling_in: Math.max(0, CEILING_IN - h),
                            model_url: defaultAssets.patio?.model_url,
                          },
                          false,
                        );
                      } else {
                        const h = 48;
                        const s = 36;
                        updateWindow(
                          {
                            is_patio: false,
                            height_in: h,
                            sill_height_in: s,
                            dist_from_ceiling_in: Math.max(0, CEILING_IN - h - s),
                            model_url: defaultAssets.window?.model_url,
                          },
                          false,
                        );
                      }
                    };
                    return (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2.5 py-2">
                          <label className="text-xs font-medium" htmlFor={`patio-toggle-${selectedWindow.id}`}>
                            Convert to Patio Door
                          </label>
                          <Switch
                            id={`patio-toggle-${selectedWindow.id}`}
                            checked={isPatio}
                            onCheckedChange={togglePatio}
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Width</label>
                            <Select value={String(nearestWinW)} onValueChange={(v) => updateWindow({ width: inchesToPx(Number(v)) })}>
                              <SelectTrigger className="h-8 text-xs [&>span]:flex-1 [&>span]:text-center"><SelectValue /></SelectTrigger>

                              <SelectContent>
                                {widthOptions.map((o) => (
                                  <SelectItem key={o} value={String(o)} className="text-xs">{formatFtIn(o)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="text-[11px] text-muted-foreground mb-1 block">Height</label>
                            <Select value={String(nearestWinH)} onValueChange={(v) => setHeight(Number(v))}>
                              <SelectTrigger className="h-8 text-xs [&>span]:flex-1 [&>span]:text-center"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                {heightOptions.map((o) => (
                                  <SelectItem key={o} value={String(o)} className="text-xs">{formatFtIn(o)}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        {!isPatio && (
                          <div className="grid grid-cols-1 gap-2">
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">From ceiling</label>
                              <FtInStepper totalIn={fromCeilIn} onChange={setFromCeil} min={0} max={CEILING_IN - heightIn} />
                            </div>
                            <div>
                              <label className="text-[11px] text-muted-foreground mb-1 block">Sill height</label>
                              <FtInStepper totalIn={sillIn} onChange={setSill} min={0} max={CEILING_IN - heightIn} />
                            </div>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground text-center font-mono pt-1">
                          Ceiling height: {formatFtIn(CEILING_IN)}
                        </div>
                      </div>
                    );
                  })()}
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelectedItem}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete {selectedWindow.is_patio ? "patio door" : "window"}
                  </Button>
                </div>
              )}

              {selectedFurniture && (() => {
                const t = (selectedFurniture.type || "").toLowerCase();
                type Opt = { value: string; label: string; widthIn: number; lengthIn: number };
                let variantLabel: string | null = null;
                let opts: Opt[] = [];
                if (t.startsWith("bed") || ["king_bed","queen_bed","double_bed","single_bed"].includes(t)) {
                  variantLabel = "Bed Size";
                  opts = [
                    { value: "king_bed",   label: "King",   widthIn: 76, lengthIn: 80 },
                    { value: "queen_bed",  label: "Queen",  widthIn: 60, lengthIn: 80 },
                    { value: "double_bed", label: "Double", widthIn: 54, lengthIn: 75 },
                    { value: "single_bed", label: "Single", widthIn: 38, lengthIn: 75 },
                  ];
                } else if (["bathtub","bath","tub","shower","small_shower","large_shower"].includes(t)) {
                  variantLabel = "Fixture";
                  opts = [
                    { value: "bathtub",      label: "Bathtub",      widthIn: 60, lengthIn: 30 },
                    { value: "small_shower", label: "Small Shower", widthIn: 36, lengthIn: 36 },
                    { value: "large_shower", label: "Large Shower", widthIn: 60, lengthIn: 32 },
                  ];
                } else if (["sink","vanity","single_vanity","double_vanity"].includes(t)) {
                  variantLabel = "Sink Size";
                  opts = [
                    { value: "sink",          label: "Sink",          widthIn: 20, lengthIn: 18 },
                    { value: "single_vanity", label: "Single Vanity", widthIn: 36, lengthIn: 24 },
                    { value: "double_vanity", label: "Double Vanity", widthIn: 60, lengthIn: 24 },
                  ];
                } else if (["couch","sofa","l_couch","single_couch","double_couch","triple_couch"].includes(t)) {
                  variantLabel = "Couch Type";
                  opts = [
                    { value: "l_couch",      label: "L Couch",      widthIn: 96, lengthIn: 36 },
                    { value: "single_couch", label: "Single Couch", widthIn: 36, lengthIn: 36 },
                    { value: "double_couch", label: "Double Couch", widthIn: 60, lengthIn: 36 },
                    { value: "triple_couch", label: "Triple Couch", widthIn: 84, lengthIn: 36 },
                  ];
                } else if (["counter","single_counter","double_counter"].includes(t)) {
                  variantLabel = "Counter Size";
                  opts = [
                    { value: "single_counter", label: "Single Counter", widthIn: 30, lengthIn: 24 },
                    { value: "double_counter", label: "Double Counter", widthIn: 60, lengthIn: 24 },
                  ];
                }
                const currentValue = opts.find((o) => o.value === t)?.value
                  ?? (t.startsWith("bed") ? "queen_bed" : opts[0]?.value);

                const applyVariant = (val: string) => {
                  const opt = opts.find((o) => o.value === val);
                  if (!opt) return;
                  pushHistory();
                  setFurniture((prev) => prev.map((f) => {
                    if (f.id !== selectedFurniture.id) return f;
                    const wPx = opt.widthIn * PIXELS_PER_WORLD_INCH;
                    const lPx = opt.lengthIn * PIXELS_PER_WORLD_INCH;
                    // Back-edge midpoint + direction
                    const be = f.back_edge ?? {
                      p1: f.corners[0],
                      p2: f.corners[1],
                    };
                    const mx = (be.p1.x + be.p2.x) / 2;
                    const my = (be.p1.y + be.p2.y) / 2;
                    let dx = be.p2.x - be.p1.x;
                    let dy = be.p2.y - be.p1.y;
                    let len = Math.hypot(dx, dy);
                    if (len < 1e-6) { dx = 1; dy = 0; len = 1; }
                    const ux = dx / len, uy = dy / len;
                    // Forward normal: pick the side containing the centroid
                    let nx = -uy, ny = ux;
                    const cgx = f.corners.reduce((s, p) => s + p.x, 0) / f.corners.length;
                    const cgy = f.corners.reduce((s, p) => s + p.y, 0) / f.corners.length;
                    if ((cgx - mx) * nx + (cgy - my) * ny < 0) { nx = -nx; ny = -ny; }
                    const bl = { x: mx - ux * wPx / 2,           y: my - uy * wPx / 2 };
                    const br = { x: mx + ux * wPx / 2,           y: my + uy * wPx / 2 };
                    const fr = { x: br.x + nx * lPx,             y: br.y + ny * lPx };
                    const fl = { x: bl.x + nx * lPx,             y: bl.y + ny * lPx };
                    return {
                      ...f,
                      type: opt.value,
                      corners: [bl, br, fr, fl],
                      back_edge: { p1: bl, p2: br },
                    };
                  }));
                };

                return (
                  <div className="space-y-3 rounded-md bg-card border border-border p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold capitalize">
                        {selectedFurniture.type || "Furniture"}
                      </span>
                      <span className="text-[11px] text-muted-foreground font-mono">
                        {selectedFurniture.id.slice(0, 10)}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Type: <span className="text-foreground font-mono capitalize">{selectedFurniture.type}</span>
                    </div>
                    {variantLabel && opts.length > 0 && (
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground">{variantLabel}</label>
                        <Select value={currentValue} onValueChange={applyVariant}>
                          <SelectTrigger className="h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {opts.map((o) => (
                              <SelectItem key={o.value} value={o.value} className="text-xs">
                                {o.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      className="w-full gap-1.5"
                      onClick={() => {
                        pushHistory();
                        setFurniture((prev) =>
                          prev.map((f) =>
                            f.id === selectedFurniture.id ? { ...f, flipLR: !f.flipLR } : f,
                          ),
                        );
                      }}
                    >
                      <FlipHorizontal className="h-3.5 w-3.5" /> Flip L/R
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full gap-2"
                      onClick={deleteSelectedItem}
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete {selectedFurniture.type || "item"}
                    </Button>
                  </div>
                );
              })()}

              {selectedText && (
                <div className="space-y-3 rounded-md bg-card border border-border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Label</span>
                    <span className="text-[11px] text-muted-foreground font-mono">
                      {selectedText.id.slice(0, 10)}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      Text
                    </label>
                    <Input
                      value={selectedText.text}
                      onChange={(e) => {
                        const v = e.target.value;
                        setTexts((prev) =>
                          prev.map((t) => (t.id === selectedText.id ? { ...t, text: v } : t)),
                        );
                      }}
                      className="h-8 text-sm"
                      placeholder="Label text"
                    />
                    <p className="text-[10px] text-muted-foreground">Tip: double-click the label on the canvas to edit it in place.</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        Size
                      </label>
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {(selectedText.fontSize ?? 7).toFixed(1)}"
                      </span>
                    </div>
                    <Slider
                      min={2}
                      max={36}
                      step={0.5}
                      value={[selectedText.fontSize ?? 7]}
                      onValueChange={(v) => {
                        const fs = v[0];
                        setTexts((prev) =>
                          prev.map((t) => (t.id === selectedText.id ? { ...t, fontSize: fs } : t)),
                        );
                      }}
                    />
                  </div>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full gap-2"
                    onClick={deleteSelectedItem}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete label
                  </Button>
                </div>
              )}
            </section>
          )}

          {/* Ceiling height — visible in 3D when nothing is selected */}
          {viewMode === "3D" && !selection3D && (
            <section>
              <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                Ceiling height
              </h2>
              <FtInStepper
                totalIn={ceilingHeightIn}
                onChange={(v) => setCeilingHeightIn(Math.max(12, v))}
                min={12}
              />
            </section>
          )}

          {/* 3D Material Picker — when a wall, floor, or baseboard is selected */}
          {viewMode === "3D" && selection3D && (selection3D.kind === "wall" || selection3D.kind === "floor" || selection3D.kind === "baseboard") && (
            <section>
              <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                {selection3D.kind === "baseboard" ? "Baseboard Material" : "Material Picker"}
              </h2>
              {(() => {
                const kind = selection3D.kind;
                const metadataKey =
                  kind === "baseboard" ? `baseboard_${selection3D.id}` : selection3D.id;
                const currentMaterial = visualMetadata[metadataKey]?.material;
                const currentScale = visualMetadata[metadataKey]?.tile_scale ?? 1;
                const currentTint = visualMetadata[metadataKey]?.tint;
                const materialCategory = kind === "baseboard" ? "baseboard" : kind;
                const filteredMaterials = allMaterials.filter((mat) => mat.category === materialCategory);
                const targetIds =
                  kind === "wall"
                    ? walls.map((w) => w.id)
                    : kind === "floor"
                    ? floors.map((f) => f.id)
                    : walls.map((w) => `baseboard_${w.id}`);
                


                const matToAssignment = (mat: typeof allMaterials[number]) => ({
                  color_url: mat.color_url,
                  roughness_url: mat.roughness_url,
                  normal_url: mat.normal_url,
                  ao_url: mat.ao_url,
                  metallic_url: mat.metallic_url,
                });
                const applyMaterial = (mat: typeof allMaterials[number]) =>
                  setVisualMetadata((m) => ({
                    ...m,

                    [metadataKey]: {
                      ...m[metadataKey],
                      material: matToAssignment(mat),
                    },
                  }));
                const setScale = (s: number) =>
                  setVisualMetadata((m) => ({
                    ...m,
                    [metadataKey]: { ...m[metadataKey], tile_scale: s },
                  }));
                const setTint = (t: string) =>
                  setVisualMetadata((m) => ({
                    ...m,
                    [metadataKey]: { ...m[metadataKey], tint: t },
                  }));
                const clearTint = () =>
                  setVisualMetadata((m) => {
                    const next = { ...m[metadataKey] };
                    delete next.tint;
                    return { ...m, [metadataKey]: next };
                  });
                const clearMaterial = () =>
                  setVisualMetadata((m) => {
                    const next = { ...m[metadataKey] };
                    delete next.material;
                    return { ...m, [metadataKey]: next };
                  });
                const applyToAll = () => {
                  const applyEntry = (map: Record<string, any>, id: string) => {
                    const entry = { ...map[id] };
                    if (currentMaterial) {
                      entry.material = currentMaterial;
                      entry.tile_scale = currentScale;
                    }
                    if (currentTint) {
                      entry.tint = currentTint;
                    } else {
                      delete entry.tint;
                    }
                    map[id] = entry;
                  };
                  setVisualMetadata((m) => {
                    const next = { ...m };
                    for (const id of targetIds) applyEntry(next, id);
                    return next;
                  });
                };

                return (
                  <div className="rounded-md bg-card border border-border p-3 space-y-3">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] text-muted-foreground capitalize">
                          {kind} selected
                        </div>
                        <div className="text-xs font-mono truncate">{selection3D.id}</div>
                      </div>
                      {currentMaterial && (
                        <button
                          type="button"
                          onClick={clearMaterial}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {materialsLoading ? (
                      <p className="text-xs text-muted-foreground rounded-md bg-muted/40 border border-border px-3 py-2.5">
                        Fetching materials...
                      </p>
                    ) : materialsError ? (
                      <p className="text-xs text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                        {materialsError}
                      </p>
                    ) : filteredMaterials.length === 0 ? (
                      <p className="text-xs text-muted-foreground rounded-md bg-muted/40 border border-border px-3 py-2.5">
                        No materials found in database.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {filteredMaterials.map((mat) => {
                          const active = currentMaterial?.color_url === mat.color_url;
                          return (
                            <button
                              key={mat.id}
                              type="button"
                              onClick={() => applyMaterial(mat)}
                              className={cn(
                                "flex flex-col gap-1 rounded-md border-2 overflow-hidden bg-background transition-all text-left",
                                active
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-border hover:border-primary/50",
                              )}
                              title={mat.name}
                            >
                              <div className="aspect-square w-full bg-muted overflow-hidden">
                                <img
                                  src={mat.thumbnail_url}
                                  alt={mat.name}
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div className="px-1.5 pb-1 text-[10px] leading-tight truncate">
                                {mat.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Tile scale
                        </span>
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {currentScale.toFixed(2)}×
                        </span>
                      </div>
                      <Slider
                        value={[currentScale]}
                        min={0.1}
                        max={5}
                        step={0.05}
                        onValueChange={(v) => setScale(v[0])}
                      />
                    </div>
                    <TintPicker
                      presets={MATERIAL_TINT_PRESETS}
                      currentTint={currentTint}
                      setTint={setTint}
                      clearTint={clearTint}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!currentMaterial && !currentTint}
                      onClick={applyToAll}
                    >
                      Apply to all {kind}s
                    </Button>
                  </div>
                );
              })()}
            </section>
          )}


          {/* Model Picker — only when a door or window is selected, scoped to that category */}
          {viewMode === "3D" && selection3D && (selection3D.kind === "door" || selection3D.kind === "window") && !(selection3D.kind === "door" && doors.find((d) => d.id === selection3D.id)?.is_arch) && (
            <section>
              {(() => {
                const selWin =
                  selection3D.kind === "window"
                    ? windows.find((w) => w.id === selection3D.id)
                    : null;
                const selDoor =
                  selection3D.kind === "door"
                    ? doors.find((d) => d.id === selection3D.id)
                    : null;
                const isPatio = !!selWin?.is_patio;
                const isDouble = !!selDoor?.is_double;
                return (
                  <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                    {isPatio ? "Model Picker" : isDouble ? "Model Picker" : "Model Picker"}
                  </h2>
                );
              })()}
              {assetsLoading ? (
                <p className="text-xs text-muted-foreground rounded-md bg-card border border-border px-3 py-2.5">
                  Fetching models...
                </p>
              ) : assetsError ? (
                <p className="text-xs text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                  {assetsError}
                </p>
              ) : (
                ([selection3D.kind] as const).map((cat) => {
                  const selWin =
                    cat === "window" ? windows.find((w) => w.id === selection3D.id) : null;
                  const selDoor =
                    cat === "door" ? doors.find((d) => d.id === selection3D.id) : null;
                  const isDouble = !!selDoor?.is_double;
                  const filterCat: AssetCategory = selWin?.is_patio
                    ? "patio"
                    : isDouble
                      ? "double_door"
                      : cat;
                  const items = allAssets.filter((a) => a.category === filterCat);
                  const selectedItem =
                    cat === "door"
                      ? doors.find((d) => d.id === selection3D.id)
                      : windows.find((w) => w.id === selection3D.id);
                  const activeUrl = selectedItem?.model_url;
                  const setActive = (url: string | undefined) => {
                    if (cat === "door") {
                      setDoors((prev) =>
                        prev.map((d) =>
                          d.id === selection3D.id ? { ...d, model_url: url } : d,
                        ),
                      );
                    } else {
                      setWindows((prev) =>
                        prev.map((w) =>
                          w.id === selection3D.id ? { ...w, model_url: url } : w,
                        ),
                      );
                    }
                  };
                  const currentTint = visualMetadata[selection3D.id]?.tint;
                  const setTint = (t: string) =>
                    setVisualMetadata((m) => ({
                      ...m,
                      [selection3D.id]: { ...m[selection3D.id], tint: t },
                    }));
                  const clearTint = () =>
                    setVisualMetadata((m) => {
                      const next = { ...m[selection3D.id] };
                      delete next.tint;
                      return { ...m, [selection3D.id]: next };
                    });
                  const applyToAll = () => {
                    const isPatio = !!selWin?.is_patio;
                    const targetIds =
                      cat === "door"
                        ? doors.filter((d) => !!d.is_double === isDouble).map((d) => d.id)
                        : windows.filter((w) => !!w.is_patio === isPatio).map((w) => w.id);
                    if (activeUrl) {
                      if (cat === "door") {
                        setDoors((prev) =>
                          prev.map((d) =>
                            !!d.is_double === isDouble ? { ...d, model_url: activeUrl } : d,
                          ),
                        );
                      } else {
                        setWindows((prev) =>
                          prev.map((w) =>
                            !!w.is_patio === isPatio ? { ...w, model_url: activeUrl } : w,
                          ),
                        );
                      }
                    }
                    const applyTint = (map: Record<string, any>, id: string) => {
                      const entry = { ...map[id] };
                      if (currentTint) entry.tint = currentTint;
                      else delete entry.tint;
                      map[id] = entry;
                    };
                    setVisualMetadata((m) => {
                      const next = { ...m };
                      for (const id of targetIds) applyTint(next, id);
                      return next;
                    });
                  };
                  const count =
                    cat === "door"
                      ? doors.filter((d) => !!d.is_double === isDouble).length
                      : windows.filter((w) => !!w.is_patio === !!selWin?.is_patio).length;



                  return (
                    <div key={cat} className="rounded-md bg-card border border-border p-3 space-y-3 mb-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold capitalize">
                          {cat}s
                        </span>
                        {activeUrl && (
                          <button
                            type="button"
                            onClick={() => setActive(undefined)}
                            className="text-[10px] text-muted-foreground hover:text-foreground underline"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground">
                          No {cat} models found in database.
                        </p>
                      ) : (
                        <div className="grid grid-cols-3 gap-2">
                          {items.map((asset: AssetModel) => {
                            const active = activeUrl === asset.model_url;
                            return (
                              <button
                                key={asset.id}
                                type="button"
                                onClick={() => setActive(asset.model_url)}
                                className={cn(
                                  "flex flex-col gap-1 rounded-md border-2 overflow-hidden bg-background transition-all text-left",
                                  active
                                    ? "border-primary ring-2 ring-primary/30"
                                    : "border-border hover:border-primary/50",
                                )}
                                title={asset.name}
                              >
                                <div className="aspect-square w-full bg-white overflow-hidden flex items-center justify-center">
                                  {asset.thumbnail_url ? (
                                    <img
                                      src={asset.thumbnail_url}
                                      alt={asset.name}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  ) : null}
                                </div>
                                <div className="px-1.5 pb-1 text-[10px] leading-tight truncate">
                                  {asset.name}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                      <TintPicker
                        presets={MODEL_TINT_PRESETS}
                        currentTint={currentTint}
                        setTint={setTint}
                        clearTint={clearTint}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full"
                        disabled={!activeUrl && !currentTint}
                        onClick={applyToAll}
                      >
                        Apply to all {filterCat}s ({count})
                      </Button>
                    </div>
                  );
                })
              )}
            </section>
          )}

          {/* Furniture Model Picker — only when a furniture item is selected in 3D */}
          {viewMode === "3D" && selection3D?.kind === "furniture" && (() => {
            const selFurn = furniture.find((f) => f.id === selection3D.id);
            if (!selFurn) return null;
            const cat = FURNITURE_TYPE_TO_CATEGORY[selFurn.type];
            const items = cat ? allAssets.filter((a) => a.category === cat) : [];
            const activeUrl =
              selFurn.model_url ??
              items.find((a) => a.is_default)?.model_url ??
              items[0]?.model_url;
            const setActive = (url: string | undefined) => {
              setFurniture((prev) =>
                prev.map((f) => (f.id === selFurn.id ? { ...f, model_url: url } : f)),
              );
            };
            const applyToAll = () => {
              if (!activeUrl) return;
              setFurniture((prev) =>
                prev.map((f) =>
                  f.type === selFurn.type ? { ...f, model_url: activeUrl } : f,
                ),
              );
            };
            const sameTypeCount = furniture.filter((f) => f.type === selFurn.type).length;

            return (
              <section>
                <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Model Picker
                </h2>
                {assetsLoading ? (
                  <p className="text-xs text-muted-foreground rounded-md bg-card border border-border px-3 py-2.5">
                    Fetching models...
                  </p>
                ) : assetsError ? (
                  <p className="text-xs text-destructive rounded-md bg-destructive/10 border border-destructive/20 px-3 py-2.5">
                    {assetsError}
                  </p>
                ) : (
                  <div className="rounded-md bg-card border border-border p-3 space-y-3 mb-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {selFurn.type.replace(/_/g, " ")}
                      </span>
                      {selFurn.model_url && (
                        <button
                          type="button"
                          onClick={() => setActive(undefined)}
                          className="text-[10px] text-muted-foreground hover:text-foreground underline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    {items.length === 0 ? (
                      <p className="text-xs text-muted-foreground">
                        No {selFurn.type.replace(/_/g, " ")} models found in database.
                      </p>
                    ) : (
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((asset: AssetModel) => {
                          const active = activeUrl === asset.model_url;
                          return (
                            <button
                              key={asset.id}
                              type="button"
                              onClick={() => setActive(asset.model_url)}
                              className={cn(
                                "flex flex-col gap-1 rounded-md border-2 overflow-hidden bg-background transition-all text-left",
                                active
                                  ? "border-primary ring-2 ring-primary/30"
                                  : "border-border hover:border-primary/50",
                              )}
                              title={asset.name}
                            >
                              <div className="aspect-square w-full bg-white overflow-hidden flex items-center justify-center">
                                {asset.thumbnail_url ? (
                                  <img
                                    src={asset.thumbnail_url}
                                    alt={asset.name}
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                ) : null}
                              </div>
                              <div className="px-1.5 pb-1 text-[10px] leading-tight truncate">
                                {asset.name}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="w-full"
                      disabled={!activeUrl}
                      onClick={applyToAll}
                    >
                      Apply to all {selFurn.type.replace(/_/g, " ")} ({sameTypeCount})
                    </Button>
                  </div>
                )}
              </section>
            );
          })()}


          {!isSelected && (
            <>
              <Separator />

              {/* Scale (moved below Overview) */}
              <section>
                <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2 font-semibold">
                  Scale
                </h2>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      onClick={initiateCalibration}
                      className={cn(
                        "w-full gap-2",
                        calibrationState.active && "bg-muted text-foreground hover:bg-muted/80",
                      )}
                    >
                      <RulerDimensionLine className="h-4 w-4" />
                      {calibrationState.active ? "Cancel calibration (Esc)" : "Calibrate scale"}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Set Canvas Scale</p>
                  </TooltipContent>
                </Tooltip>
                {calibrationState.active && (
                  <p className="text-[11px] text-primary mt-2 leading-relaxed">
                    Click two wall endpoints or a window — then enter the
                    known dimension.
                  </p>
                )}
              </section>
            </>
          )}

          {!isSelected && !calibrationState.active && (
            <div className="rounded-md border border-dashed border-border px-3 py-4 text-center">
              <MousePointer2 className="h-4 w-4 text-muted-foreground mx-auto mb-1.5" />
              <p className="text-[11px] text-muted-foreground">
                Click any element on the canvas to edit it.
              </p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-border text-[10px] text-muted-foreground">
          Scroll to zoom · Drag to pan · Click + drag a wall to move · Shift to lock axis
        </div>
      </aside>

      {/* CANVAS */}
      <main
        className="absolute inset-0"
        style={{ backgroundColor: COLORS.canvas }}
      >

        {viewMode === "2D" && (
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          style={{
            cursor: isPanning
              ? "grabbing"
              : activeDrag
                ? "grabbing"
                : calibrationState.active || drawMode
                  ? "crosshair"
                  : hoveredId
                    ? "pointer"
                    : "grab",
            touchAction: "none",
            userSelect: "none",
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onPointerDown={handleBackgroundDown}
          onContextMenu={(e) => e.preventDefault()}
        >

          
          <style>{`
            .calib-handle { fill: transparent; stroke: transparent; transition: all .15s; }
            .calib-handle:hover { fill: ${COLORS.handleFill}; stroke: ${COLORS.itemSelected}; stroke-width: ${CONFIG.handleStrokeWidth}px; }
          `}</style>

          <defs>
            <pattern
              id="dotGrid"
              x={viewport.x}
              y={viewport.y}
              width={CONFIG.grid.size * viewport.zoom}
              height={CONFIG.grid.size * viewport.zoom}
              patternUnits="userSpaceOnUse"
            >
              <circle
                cx={1}
                cy={1}
                r={CONFIG.grid.dotRadius}
                fill={COLORS.gridDot}
              />
            </pattern>
          </defs>

          <rect width="100%" height="100%" fill="url(#dotGrid)" />

          <g
            ref={innerGRef}
            transform={`translate(${viewport.x}, ${viewport.y}) scale(${viewport.zoom})`}
          >
            {/* World-space canvas bounds (50ft x 100ft) */}
            <rect
              x={0}
              y={0}
              width={CANVAS_WORLD_WIDTH_FT * PIXELS_PER_WORLD_FOOT}
              height={CANVAS_WORLD_HEIGHT_FT * PIXELS_PER_WORLD_FOOT}
              fill="none"
              stroke={COLORS.gridDot}
              strokeWidth={1 / viewport.zoom}
              strokeDasharray={`${6 / viewport.zoom},${4 / viewport.zoom}`}
              pointerEvents="none"
            />
            {renderFloors()}
            {renderFurniture()}
            {renderStructures()}
            {renderTexts()}
            {renderWalls()}
            {renderDoors()}
            {renderWindows()}
            {calibrationState.point1 && (
              <line
                x1={calibrationState.point1.x}
                y1={calibrationState.point1.y}
                x2={mousePos.x}
                y2={mousePos.y}
                stroke={COLORS.calibrationLine}
                strokeWidth={CONFIG.calibrationStyles.strokeWidth / viewport.zoom}
                strokeDasharray={CONFIG.calibrationStyles.dashArray}
                style={{ pointerEvents: "none" }}
              />
            )}
            {/* Text placement preview — ghost label follows the cursor */}
            {drawMode === "text" && (
              <text
                x={mousePos.x}
                y={mousePos.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={7 * PIXELS_PER_WORLD_INCH}
                fontWeight={700}
                fill="#6b7280"
                opacity={0.55}
                pointerEvents="none"
                style={{ userSelect: "none" }}
              >
                Label
              </text>
            )}
            {/* Furniture placement preview — ghost rectangle follows the cursor */}
            {drawMode === "furniture" && pendingFurniture && (() => {
              const w = pendingFurniture.widthIn * PIXELS_PER_WORLD_INCH;
              const l = pendingFurniture.lengthIn * PIXELS_PER_WORLD_INCH;
              return (
                <g pointerEvents="none" opacity={0.6}>
                  <rect
                    x={mousePos.x - w / 2}
                    y={mousePos.y}
                    width={w}
                    height={l}
                    fill="oklch(0.9 0.05 45)"
                    fillOpacity={0.5}
                    stroke={COLORS.wall}
                    strokeWidth={2 / viewport.zoom}
                    strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
                  />
                  {/* anchor dot at back-edge center */}
                  <circle cx={mousePos.x} cy={mousePos.y} r={3 / viewport.zoom} fill={COLORS.wall} />
                </g>
              );
            })()}
            {/* Stairs placement preview — ghost shape follows the cursor */}
            {drawMode === "stairs" && pendingStairShape && (() => {
              const widthPx = inchesToPx(DEFAULT_STAIR_WIDTH_IN);
              let bboxW = 0, bboxH = 0;
              if (pendingStairShape === "straight") {
                bboxW = inchesToPx(120); bboxH = widthPx;
              } else if (pendingStairShape === "L") {
                bboxW = inchesToPx(60) + widthPx; bboxH = inchesToPx(60) + widthPx;
              } else {
                bboxW = widthPx * 2 + inchesToPx(24); bboxH = inchesToPx(60) + widthPx;
              }
              const bbox = { x: mousePos.x - bboxW / 2, y: mousePos.y - bboxH / 2, w: bboxW, h: bboxH };
              const poly = buildStairPolygonForShape(pendingStairShape, bbox, widthPx);
              const d = poly.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ") + " Z";
              return (
                <g pointerEvents="none" opacity={0.55}>
                  <path
                    d={d}
                    fill="#ffffff"
                    stroke="#000000"
                    strokeWidth={1.5 / viewport.zoom}
                    strokeDasharray={`${6 / viewport.zoom} ${4 / viewport.zoom}`}
                  />
                </g>
              );
            })()}
            {/* Railing placement preview — render like an actual railing */}
            {drawMode === "railing" && structureDraftStart && (() => {
              const thickness = inchesToPx(DEFAULT_RAILING_THICKNESS_IN);
              const dx = mousePos.x - structureDraftStart.x;
              const dy = mousePos.y - structureDraftStart.y;
              const len = Math.hypot(dx, dy);
              if (len < 0.5) return null;
              const ux = dx / len, uy = dy / len;
              const px = -uy, py = ux;
              const balusterSpacingPx = inchesToPx(5);
              const balusterSizePx = inchesToPx(1.5);
              const balusters: Array<{ cx: number; cy: number }> = [];
              for (let dd = balusterSpacingPx; dd < len - balusterSpacingPx / 2; dd += balusterSpacingPx) {
                balusters.push({ cx: structureDraftStart.x + ux * dd, cy: structureDraftStart.y + uy * dd });
              }
              const sw = 1.2 / viewport.zoom;
              return (
                <g pointerEvents="none" opacity={0.7}>
                  <line
                    x1={structureDraftStart.x} y1={structureDraftStart.y}
                    x2={mousePos.x} y2={mousePos.y}
                    stroke="#ffffff" strokeWidth={thickness} strokeLinecap="square"
                  />
                  {[thickness / 2, -thickness / 2].map((off, i) => (
                    <line key={i}
                      x1={structureDraftStart.x + px * off} y1={structureDraftStart.y + py * off}
                      x2={mousePos.x + px * off} y2={mousePos.y + py * off}
                      stroke="#000000" strokeWidth={sw}
                    />
                  ))}
                  {balusters.map((b, i) => (
                    <rect key={i}
                      x={b.cx - balusterSizePx / 2} y={b.cy - balusterSizePx / 2}
                      width={balusterSizePx} height={balusterSizePx}
                      fill="#000000"
                      transform={`rotate(${(Math.atan2(uy, ux) * 180) / Math.PI} ${b.cx} ${b.cy})`}
                    />
                  ))}
                </g>
              );
            })()}
            {drawMode === "railing" && structureDraftStart && (
              <circle
                cx={structureDraftStart.x}
                cy={structureDraftStart.y}
                r={handleR}
                fill={COLORS.handleFill}
                stroke={COLORS.itemSelected}
                strokeWidth={CONFIG.handleStrokeWidth}
                pointerEvents="none"
              />
            )}
            {renderCalibrationEndpoints()}
            {renderSelectionHandles()}
            {/* Wall draw preview */}
            {drawMode === "wall" && wallDraftStart && drawPreview?.kind === "wall" && (
              <g pointerEvents="none">
                <line
                  x1={wallDraftStart.x}
                  y1={wallDraftStart.y}
                  x2={drawPreview.pt.x}
                  y2={drawPreview.pt.y}
                  stroke={COLORS.itemSelected}
                  strokeWidth={inchesToPx(6)}
                  strokeLinecap="square"
                  opacity={0.6}
                />
                {renderDimensionLine(wallDraftStart, drawPreview.pt)}
              </g>
            )}
            {drawMode === "wall" && wallDraftStart && (
              <circle
                cx={wallDraftStart.x}
                cy={wallDraftStart.y}
                r={handleR}
                fill={COLORS.handleFill}
                stroke={COLORS.itemSelected}
                strokeWidth={CONFIG.handleStrokeWidth}
                pointerEvents="none"
              />
            )}
            {/* Door draft preview */}
            {(drawMode === "door" || drawMode === "double_door") && (drawPreview?.kind === "door" || drawPreview?.kind === "double_door") && (() => {
              const isDouble = drawMode === "double_door";
              const widthPx = isDouble ? inchesToPx(60) : inchesToPx(30);
              const ang = drawPreview.angle;
              const t = drawPreview.thickness;
              const rotDeg = (ang * 180) / Math.PI;
              const leafPx = isDouble ? widthPx / 2 : widthPx;
              return (
                <g
                  pointerEvents="none"
                  transform={`translate(${drawPreview.pt.x}, ${drawPreview.pt.y}) rotate(${rotDeg})`}
                  opacity={0.7}
                >
                  {/* Wall cutout */}
                  <rect
                    x={-widthPx / 2}
                    y={-t / 2 - 1}
                    width={widthPx}
                    height={t + 2}
                    fill={COLORS.white}
                  />
                  {isDouble ? (
                    <>
                      {/* Left leaf — hinged at left end, swings up */}
                      <g transform={`translate(${-widthPx / 2}, 0) rotate(-90)`}>
                        <rect
                          x={0}
                          y={-CONFIG.doorStyles.panelThickness / 2}
                          width={leafPx}
                          height={CONFIG.doorStyles.panelThickness}
                          fill={COLORS.white}
                          stroke={COLORS.itemSelected}
                          strokeWidth={CONFIG.doorStyles.panelStrokeWidth}
                        />
                      </g>
                      {/* Right leaf — hinged at right end, swings up */}
                      <g transform={`translate(${widthPx / 2}, 0) rotate(-90)`}>
                        <rect
                          x={0}
                          y={-CONFIG.doorStyles.panelThickness / 2}
                          width={leafPx}
                          height={CONFIG.doorStyles.panelThickness}
                          fill={COLORS.white}
                          stroke={COLORS.itemSelected}
                          strokeWidth={CONFIG.doorStyles.panelStrokeWidth}
                        />
                      </g>
                      {/* Left swing arc: tip back to midpoint */}
                      <path
                        d={`M ${-widthPx / 2} ${-leafPx} A ${leafPx} ${leafPx} 0 0 1 0 0`}
                        fill="none"
                        stroke={COLORS.doorArc}
                        strokeWidth={CONFIG.doorStyles.arcStrokeWidth}
                        strokeDasharray={CONFIG.doorStyles.arcDashArray}
                      />
                      {/* Right swing arc: tip back to midpoint */}
                      <path
                        d={`M ${widthPx / 2} ${-leafPx} A ${leafPx} ${leafPx} 0 0 0 0 0`}
                        fill="none"
                        stroke={COLORS.doorArc}
                        strokeWidth={CONFIG.doorStyles.arcStrokeWidth}
                        strokeDasharray={CONFIG.doorStyles.arcDashArray}
                      />
                    </>

                  ) : (
                    <>
                      {/* Door panel (hinge at -widthPx/2, opening upward) */}
                      <g transform={`translate(${-widthPx / 2}, 0) rotate(-90)`}>
                        <rect
                          x={0}
                          y={-CONFIG.doorStyles.panelThickness / 2}
                          width={widthPx}
                          height={CONFIG.doorStyles.panelThickness}
                          fill={COLORS.white}
                          stroke={COLORS.itemSelected}
                          strokeWidth={CONFIG.doorStyles.panelStrokeWidth}
                        />
                      </g>
                      {/* Swing arc */}
                      <path
                        d={`M ${-widthPx / 2} ${-widthPx} A ${widthPx} ${widthPx} 0 0 1 ${widthPx / 2} 0`}
                        fill="none"
                        stroke={COLORS.doorArc}
                        strokeWidth={CONFIG.doorStyles.arcStrokeWidth}
                        strokeDasharray={CONFIG.doorStyles.arcDashArray}
                      />
                    </>
                  )}
                </g>
              );
            })()}
            {/* Arch draft preview */}
            {drawMode === "arch" && drawPreview?.kind === "arch" && (() => {
              const widthPx = inchesToPx(36);
              const ang = drawPreview.angle;
              const t = drawPreview.thickness;
              const rotDeg = (ang * 180) / Math.PI;
              return (
                <g
                  pointerEvents="none"
                  transform={`translate(${drawPreview.pt.x}, ${drawPreview.pt.y}) rotate(${rotDeg})`}
                  opacity={0.7}
                >
                  <rect x={-widthPx / 2} y={-t / 2} width={widthPx} height={t} fill={COLORS.white} />
                  <line x1={-widthPx / 2} y1={-t / 2} x2={widthPx / 2} y2={-t / 2} stroke={COLORS.itemSelected} strokeWidth={1} strokeDasharray="4 3" />
                  <line x1={-widthPx / 2} y1={t / 2} x2={widthPx / 2} y2={t / 2} stroke={COLORS.itemSelected} strokeWidth={1} strokeDasharray="4 3" />
                  <line x1={-widthPx / 2} y1={0} x2={widthPx / 2} y2={0} stroke={COLORS.itemSelected} strokeWidth={1} strokeDasharray="4 3" />
                </g>
              );
            })()}
            {/* Window draft preview */}
            {(drawMode === "window" || drawMode === "patio") && (drawPreview?.kind === "window" || drawPreview?.kind === "patio") && (() => {
              const isPatio = drawMode === "patio";
              const widthPx = isPatio ? inchesToPx(72) : inchesToPx(36);
              const ang = drawPreview.angle;
              const t = drawPreview.thickness;
              const rotDeg = (ang * 180) / Math.PI;
              const paneT = Math.max(2, t / 5);
              const overlap = widthPx * 0.04;
              return (
                <g
                  pointerEvents="none"
                  transform={`translate(${drawPreview.pt.x}, ${drawPreview.pt.y}) rotate(${rotDeg})`}
                  opacity={0.7}
                >
                  {isPatio ? (
                    <>
                      <rect
                        x={-widthPx / 2}
                        y={-t / 2}
                        width={widthPx}
                        height={t}
                        fill={COLORS.white}
                        stroke="none"
                      />
                      <rect
                        x={-widthPx / 2}
                        y={-t / 6 - paneT / 2}
                        width={widthPx / 2 + overlap}
                        height={paneT}
                        fill={COLORS.white}
                        stroke={COLORS.itemSelected}
                        strokeWidth={CONFIG.windowStyles.paneStrokeWidth}
                      />
                      <rect
                        x={-overlap}
                        y={t / 6 - paneT / 2}
                        width={widthPx / 2 + overlap}
                        height={paneT}
                        fill={COLORS.white}
                        stroke={COLORS.itemSelected}
                        strokeWidth={CONFIG.windowStyles.paneStrokeWidth}
                      />
                    </>
                  ) : (
                    <>
                      <rect
                        x={-widthPx / 2}
                        y={-t / 2}
                        width={widthPx}
                        height={t}
                        fill={COLORS.white}
                        stroke={COLORS.itemSelected}
                        strokeWidth={CONFIG.windowStyles.frameStrokeWidth}
                      />
                      <line x1={-widthPx / 6} y1={-t / 2} x2={-widthPx / 6} y2={t / 2} stroke={COLORS.itemSelected} strokeWidth={CONFIG.windowStyles.paneStrokeWidth} />
                      <line x1={widthPx / 6} y1={-t / 2} x2={widthPx / 6} y2={t / 2} stroke={COLORS.itemSelected} strokeWidth={CONFIG.windowStyles.paneStrokeWidth} />
                    </>
                  )}

                </g>
              );
            })()}
            {/* No-wall hint icon at cursor for door/window */}
            {(drawMode === "door" || drawMode === "double_door" || drawMode === "arch" || drawMode === "window" || drawMode === "patio") && !drawPreview && (
              <g
                pointerEvents="none"
                transform={`translate(${mousePos.x}, ${mousePos.y})`}
              >
                <circle r={10 / viewport.zoom} fill="none" stroke={COLORS.itemSelected} strokeWidth={1.5 / viewport.zoom} strokeDasharray={`${3 / viewport.zoom},${3 / viewport.zoom}`} />
              </g>
            )}
            {/* Room (polygon) draft preview */}
            {drawMode === "room" && roomDraft.length > 0 && (
              <g pointerEvents="none">
                {roomDraft.length >= 2 && (
                  <polyline
                    points={roomDraft.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={COLORS.itemSelected}
                    strokeWidth={2 / viewport.zoom}
                    opacity={0.85}
                  />
                )}
                {/* Rubber-band line to cursor */}
                <line
                  x1={roomDraft[roomDraft.length - 1].x}
                  y1={roomDraft[roomDraft.length - 1].y}
                  x2={mousePos.x}
                  y2={mousePos.y}
                  stroke={COLORS.itemSelected}
                  strokeWidth={1.5 / viewport.zoom}
                  strokeDasharray={`${4 / viewport.zoom},${3 / viewport.zoom}`}
                  opacity={0.7}
                />
                {/* Filled preview when ≥3 points */}
                {roomDraft.length >= 3 && (
                  <polygon
                    points={roomDraft.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill={COLORS.itemSelected}
                    opacity={0.08}
                  />
                )}
                {/* Vertex dots */}
                {roomDraft.map((p, i) => (
                  <circle
                    key={i}
                    cx={p.x}
                    cy={p.y}
                    r={(i === 0 ? 6 : 4) / viewport.zoom}
                    fill={COLORS.handleFill}
                    stroke={COLORS.itemSelected}
                    strokeWidth={1.5 / viewport.zoom}
                  />
                ))}
              </g>
            )}
            {snapIndicator && (
              <circle
                cx={snapIndicator.x}
                cy={snapIndicator.y}
                r={CONFIG.defaultWallThickness * 0.7}
                fill="none"
                stroke={COLORS.snapGuide}
                strokeWidth={2 / viewport.zoom}
                style={{ pointerEvents: "none" }}
              />
            )}
            {alignmentGuides.length > 0 && (() => {
              const W = CANVAS_WORLD_WIDTH_FT * PIXELS_PER_WORLD_FOOT;
              const H = CANVAS_WORLD_HEIGHT_FT * PIXELS_PER_WORLD_FOOT;
              const dash = `${10 / viewport.zoom},${10 / viewport.zoom}`;
              return (
                <g pointerEvents="none" opacity={0.5}>
                  {alignmentGuides.map((g, i) =>
                    g.axis === "x" ? (
                      <line key={`gx-${i}`} x1={g.coord} y1={-H} x2={g.coord} y2={2 * H}
                        stroke={COLORS.itemSelected} strokeWidth={2 / viewport.zoom} strokeDasharray={dash} />
                    ) : (
                      <line key={`gy-${i}`} x1={-W} y1={g.coord} x2={2 * W} y2={g.coord}
                        stroke={COLORS.itemSelected} strokeWidth={2 / viewport.zoom} strokeDasharray={dash} />
                    ),
                  )}
                </g>
              );
            })()}
          </g>

        </svg>
        
        )}

        {viewMode === "3D" && (
          <div key={scene3DKey} className="absolute inset-0">
            <FloorPlan3D
              floorsData={floorsData3D}
              visibleFloor={visibleFloor}
              furnitureAssets={allAssets}
              pixelsPerFoot={pixelsPerFoot}
              visualMetadata={mergedVisualMetadata3D}
              selection={selection3D}
              onSelect={(s) => {
                if (s) {
                  const inActive = (() => {
                    switch (s.kind) {
                      case "wall":
                      case "baseboard":
                        return walls.some((w) => w.id === s.id);
                      case "floor":
                        return floors.some((f) => f.id === s.id);
                      case "door":
                        return doors.some((d) => d.id === s.id);
                      case "window":
                        return windows.some((w) => w.id === s.id);
                      case "furniture":
                        return furniture.some((f) => f.id === s.id);
                      default:
                        return true;
                    }
                  })();
                  if (!inActive) {
                    const other: 1 | 2 = activeFloor === 1 ? 2 : 1;
                    const snap = floorSnapshotsRef.current[other];
                    const foundInOther = !!snap && (() => {
                      switch (s.kind) {
                        case "wall":
                        case "baseboard":
                          return snap.walls.some((w: any) => w.id === s.id);
                        case "floor":
                          return snap.floors.some((f: any) => f.id === s.id);
                        case "door":
                          return snap.doors.some((d: any) => d.id === s.id);
                        case "window":
                          return snap.windows.some((w: any) => w.id === s.id);
                        case "furniture":
                          return snap.furniture.some((f: any) => f.id === s.id);
                        default:
                          return false;
                      }
                    })();
                    if (foundInOther) switchActiveFloor(other);
                  }
                }
                setSelection3D(s);
                setSelectedId(s?.id ?? null);
              }}
              ambientIntensity={ambientIntensity * exposure}
              directionalIntensity={directionalIntensity * exposure}
              windowIntensity={windowIntensity * exposure}
              roomLightIntensity={roomLightIntensity * exposure}
              nightMode={nightMode}
              sunAzimuthDeg={sunAzimuthDeg}
              sunElevationDeg={sunElevationDeg}
              sunWarmth={sunWarmth}
              exposure={exposure}
              onZoomChange={setZoom3D}
            />
          </div>
        )}

        {/* Floor visibility toggle — 3D only, shows when 2+ floors uploaded */}
        {viewMode === "3D" && floorsData3D.length >= 2 && (
          <div className="absolute top-4 left-4 z-30 flex rounded-xl border border-border bg-card/95 backdrop-blur shadow-md p-1 gap-1">
            {(["ALL", 1, 2] as const).map((v) => (
              <button
                key={String(v)}
                onClick={() => startTransition(() => setVisibleFloor(v))}
                className={cn(
                  "px-3 h-8 rounded-lg text-xs font-semibold tracking-wide transition-colors",
                  visibleFloor === v
                    ? "bg-primary text-primary-foreground shadow"
                    : "text-foreground hover:bg-accent",
                )}
              >
                {v === "ALL" ? "All Floors" : `Floor ${v}`}
              </button>
            ))}
          </div>
        )}


        {/* TOP-CENTER 2D / 3D toggle */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-30 flex rounded-xl border border-border bg-card/95 backdrop-blur shadow-md p-1 gap-1">
          {(["2D", "3D"] as const).map((m) => (
            <Tooltip key={m}>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setViewMode(m);
                    setSelectedId(null);
                    setSelection3D(null);
                    if (m === "3D") {
                      setDrawMode(null);
                      setDrawMenuOpen(false);
                    }
                  }}
                  className={cn(
                    "px-4 h-8 rounded-lg text-xs font-semibold tracking-wide transition-colors",
                    viewMode === m
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  {m}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>{m === "2D" ? "2D View" : "3D View"}</p>
              </TooltipContent>
            </Tooltip>
          ))}
        </div>




        {/* Zoom badge */}
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-card/95 backdrop-blur border border-border text-xs font-mono text-foreground shadow-md">
          {((viewMode === "3D" ? zoom3D : viewport.zoom) * 100).toFixed(0)}%
        </div>

        {/* Floor toggler */}
        {uploadedFloorCount > 0 && viewMode === "2D" && (
          <div className="absolute top-4 left-[348px] z-30 flex items-center gap-2">
            <Select
              value={String(activeFloor)}
              onValueChange={(v) => switchActiveFloor(Number(v) as 1 | 2)}
            >
              <SelectTrigger className="w-40 bg-card shadow-md">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">First Floor</SelectItem>
                <SelectItem value="2" disabled={uploadedFloorCount < 2}>
                  Second Floor
                </SelectItem>
              </SelectContent>
            </Select>
            {uploadedFloorCount === 2 && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="bg-card shadow-md"
                    onClick={() => {
                      // Persist live state so the dialog sees the latest
                      // version of whichever floor is currently active.
                      saveActiveFloorSnapshot();
                      setAlignDialogOpen(true);
                    }}
                  >
                    <Layers className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Align floors</TooltipContent>
              </Tooltip>
            )}
          </div>
        )}


        {/* Floating Map-Style Scale Overlay */}
        {viewMode === "2D" && (
          <div className="absolute bottom-6 left-[348px] z-30 pointer-events-none flex flex-col items-center drop-shadow-sm">
            {(() => {
              const barPx = 120;
              const inches = (barPx / viewport.zoom / pixelsPerFoot) * 12;
              return (
                <>
                  <span className="font-mono text-[12px] font-semibold text-[#bf5518] bg-background/0 backdrop-blur-sm px-1.5 rounded-sm mb-0.5">
                    {formatFtIn(inches)}
                  </span>
                  <div
                    className="h-1.5 border-x-2 border-b-2 border-[#bf5518] rounded-b-[2px]"
                    style={{ width: barPx }}
                  />
                </>
              );
            })()}
          </div>
        )}

        {/* Calibration banner */}
        {calibrationState.active && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-lg flex items-center gap-2">
            <RulerDimensionLine className="h-3.5 w-3.5" />
            {calibrationState.point1
              ? "Click second point to set scale"
              : "Click a wall endpoint or window"}
          </div>
        )}

        {/* Draw mode banner */}
        {drawMode && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-md bg-primary text-primary-foreground text-xs font-medium shadow-lg flex items-center gap-2">
            <PencilLine className="h-3.5 w-3.5" />
            {drawMode === "wall"
              ? wallDraftStart
                ? "Click second endpoint (Esc to cancel, Shift to lock axis)"
                : "Click first endpoint of the wall (Esc to cancel)"
              : drawMode === "door"
                ? "Click on a wall to place a door (Esc to cancel)"
                : drawMode === "double_door"
                  ? "Click on a wall to place a double door (Esc to cancel)"
                  : drawMode === "patio"
                    ? "Click on a wall to place a patio door (Esc to cancel)"
                    : drawMode === "room"
                      ? roomDraft.length >= 3
                        ? "Click points to add — click the start point to close (Esc to cancel)"
                        : roomDraft.length > 0
                          ? "Keep clicking to add points (Esc to cancel)"
                          : "Click to place the first corner of the room (Esc to cancel)"
                      : drawMode === "text"
                        ? "Click anywhere to place a text label (Esc to cancel)"
                        : drawMode === "furniture"
                          ? `Click to place ${pendingFurniture?.label ?? "furniture"} (Esc to cancel)`
                          : drawMode === "stairs"
                            ? `Click to place ${pendingStairShape === "L" ? "L-shaped" : pendingStairShape === "U" ? "U-shaped" : "straight"} stairs (Esc to cancel)`
                            : drawMode === "railing"
                              ? structureDraftStart
                                ? "Click the end point to finish railing — hold Shift to snap to 45° (Esc to cancel)"
                                : "Click the start point of the railing (Esc to cancel)"
                              : "Click on a wall to place a window (Esc to cancel)"}
            <button
              className="ml-2 rounded hover:bg-primary-foreground/20 p-0.5"
              onClick={() => {
                setDrawMode(null);
                setDrawMenuOpen(false);
                setFurnitureMenuOpen(false);
                setFurnitureSubmenu(null);
                setStairsSubmenuOpen(false);
                setPendingStairShape(null);
                setPendingFurniture(null);
                setWallDraftStart(null);
                setRoomDraft([]);
                setStructureDraftStart(null);
                setDrawPreview(null);
                setSnapIndicator(null);
              }}
              aria-label="Cancel draw"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {viewMode === "2D" && (<>
        {/* Floating LEFT drawing toolbar (right of side panel) */}
        <div ref={toolbarRef} className="absolute top-1/2 -translate-y-1/2 left-[348px] z-20">
          <div className="relative flex flex-col gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setDrawMenuOpen((o) => !o);
                    setFurnitureMenuOpen(false);
                    setFurnitureSubmenu(null);
                  }}
                  aria-label="Draw"
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                    drawMenuOpen || drawMode
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <PencilLine className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Build</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setDrawMode((m) => (m === "text" ? null : "text"));
                    setDrawMenuOpen(false);
                    setWallDraftStart(null);
                    setRoomDraft([]);
                    setDrawPreview(null);
                    setSelectedId(null);
                  }}
                  aria-label="Add text label"
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                    drawMode === "text"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <Type className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Text Label</p>
              </TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  ref={furnitureBtnRef}
                  onClick={() => {
                    setFurnitureMenuOpen((o) => !o);
                    setFurnitureSubmenu(null);
                    setDrawMenuOpen(false);
                  }}
                  aria-label="Add furniture"
                  className={cn(
                    "h-10 w-10 rounded-xl flex items-center justify-center transition-colors",
                    furnitureMenuOpen || drawMode === "furniture"
                      ? "bg-primary text-primary-foreground shadow"
                      : "text-foreground hover:bg-accent",
                  )}
                >
                  <Armchair className="h-4 w-4" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Add Furniture</p>
              </TooltipContent>
            </Tooltip>
          </div>
          {drawMenuOpen && (
            <div className="absolute left-full top-0 ml-2 flex items-start gap-1">
              <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-1.5 min-w-[152px]">
                {[
                  { id: "wall" as const, Icon: Slash, label: "Draw Wall" },
                  { id: "door" as const, Icon: DoorOpen, label: "Add Door" },
                  { id: "double_door" as const, Icon: Custom_SlidingDoor, label: "Add Double Door" },
                  { id: "arch" as const, Icon: ArchIcon, label: "Add Arch" },
                  { id: "window" as const, Icon: Custom_Window, label: "Add Window" },
                  { id: "patio" as const, Icon: PanelLeftOpen, label: "Add Patio" },
                  { id: "room" as const, Icon: Custom_Polygon, label: "Draw Room" },
                  { id: "stairs" as const, Icon: ChevronsUp, label: "Add Stairs", hasSubmenu: true },
                  { id: "railing" as const, Icon: Grip, label: "Add Railing" },
                ].map(({ id, Icon, label, hasSubmenu }) => (
                  <button
                    key={id}
                    ref={id === "stairs" ? stairsBtnRef : undefined}
                    onClick={() => {
                      if (id === "stairs") {
                        setStairsSubmenuOpen((o) => !o);
                        return;
                      }
                      setStairsSubmenuOpen(false);
                      setPendingStairShape(null);
                      setDrawMode(id);
                      setWallDraftStart(null);
                      setRoomDraft([]);
                      setStructureDraftStart(null);
                      setDrawPreview(null);
                      setSelectedId(null);
                    }}
                    className={cn(
                      "h-9 px-3 rounded-lg flex items-center gap-2 text-sm transition-colors text-left w-full",
                      (drawMode === id || (id === "stairs" && stairsSubmenuOpen))
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    {label}
                    {hasSubmenu && (
                      <ChevronRight className="h-4 w-4 ml-auto shrink-0 opacity-70" />
                    )}
                  </button>
                ))}
              </div>
              {stairsSubmenuOpen && (
                <div
                  className="flex flex-col gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-1.5 min-w-[168px] self-start"
                  style={{ marginTop: stairsBtnRef.current ? stairsBtnRef.current.offsetTop : 0 }}
                >
                  {[
                    { key: "straight" as const, label: "Straight Stairs" },
                    { key: "L" as const, label: "L-Shaped Stairs" },
                    { key: "U" as const, label: "U-Shaped Stairs" },
                  ].map((opt) => (
                    <button
                      key={opt.key}
                      onClick={() => {
                        setPendingStairShape(opt.key);
                        setDrawMode("stairs");
                        setStairsSubmenuOpen(false);
                        setDrawMenuOpen(false);
                        setWallDraftStart(null);
                        setRoomDraft([]);
                        setStructureDraftStart(null);
                        setDrawPreview(null);
                        setSelectedId(null);
                      }}
                      className={cn(
                        "h-9 px-3 rounded-lg flex items-center gap-2 text-sm transition-colors text-left w-full",
                        pendingStairShape === opt.key
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {furnitureMenuOpen && (
            <div
              className="absolute left-full ml-2 flex items-start gap-1"
              style={{
                top: furnitureBtnRef.current ? furnitureBtnRef.current.offsetTop : 0,
              }}
            >
              <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-1.5 min-w-[152px]">
                {FURNITURE_CATALOG.map(({ category }) => {
                  const CatIcon =
                    category === "Bed" ? Bed :
                    category === "Bathroom" ? Bath :
                    category === "Living Room" ? Sofa :
                    Refrigerator;
                  return (
                    <button
                      key={category}
                      ref={(el) => { catBtnRefs.current[category] = el; }}
                      onClick={() => setFurnitureSubmenu(category)}
                      className={cn(
                        "h-9 px-3 rounded-lg flex items-center gap-2 text-sm transition-colors text-left w-full",
                        furnitureSubmenu === category
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      <CatIcon className="h-4 w-4 shrink-0" />
                      {category}
                      <ChevronRight className="h-4 w-4 ml-auto text-muted-foreground shrink-0" />
                    </button>
                  );
                })}
              </div>
              {furnitureSubmenu && (
                <div
                  className="flex flex-col gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-1.5 min-w-[168px] self-start"
                  style={{
                    marginTop: catBtnRefs.current[furnitureSubmenu]
                      ? catBtnRefs.current[furnitureSubmenu]!.offsetTop
                      : 0,
                  }}
                >
                  {(FURNITURE_CATALOG.find((c) => c.category === furnitureSubmenu)?.items ?? []).map((item) => (
                    <button
                      key={item.key}
                      onClick={() => {
                        setPendingFurniture(item);
                        setDrawMode("furniture");
                        setFurnitureMenuOpen(false);
                        setFurnitureSubmenu(null);
                        setWallDraftStart(null);
                        setRoomDraft([]);
                        setDrawPreview(null);
                        setSelectedId(null);
                      }}
                      className={cn(
                        "h-9 px-3 rounded-lg flex items-center gap-2 text-sm transition-colors text-left w-full",
                        pendingFurniture?.key === item.key
                          ? "bg-primary text-primary-foreground"
                          : "text-foreground hover:bg-accent",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Top-left undo/redo toolbar (right of side panel) */}
        <div className="absolute top-4 left-[516px] z-20 flex gap-1 rounded-xl border border-border bg-card/95 backdrop-blur shadow-md p-1">
          <button
            onClick={undo}
            disabled={historyRef.current.past.length === 0}
            title="Undo (Ctrl+Z)"
            aria-label="Undo"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            onClick={redo}
            disabled={historyRef.current.future.length === 0}
            title="Redo (Ctrl+Y)"
            aria-label="Redo"
            className="h-9 w-9 rounded-lg flex items-center justify-center text-foreground hover:bg-accent disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
          >
            <Redo2 className="h-4 w-4" />
          </button>
        </div>

        {/* Floating right toolbar */}
        <div className="absolute top-1/2 -translate-y-1/2 right-4 z-20 flex flex-col gap-1 rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-1.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                aria-label="Pan"
                className="h-10 w-10 rounded-xl flex items-center justify-center transition-colors bg-primary text-primary-foreground shadow"
              >
                <Hand className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Pan — click an item to select &amp; move</p>
            </TooltipContent>
          </Tooltip>
          <div className="h-px bg-border my-1 mx-1" />
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={zoomIn} aria-label="Zoom in"
                className="h-10 w-10 rounded-xl hover:bg-accent flex items-center justify-center text-foreground transition-colors">
                <ZoomIn className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom In</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={zoomOut} aria-label="Zoom out"
                className="h-10 w-10 rounded-xl hover:bg-accent flex items-center justify-center text-foreground transition-colors">
                <ZoomOut className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom Out</p>
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <button onClick={fitToView} aria-label="Fit to view"
                className="h-10 w-10 rounded-xl hover:bg-accent flex items-center justify-center text-foreground transition-colors">
                <Crosshair className="h-4 w-4" />
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Zoom to Fit</p>
            </TooltipContent>
          </Tooltip>
          <button onClick={fitToView} title="Maximize view" aria-label="Maximize view"
            className="h-10 w-10 rounded-xl hover:bg-accent flex items-center justify-center text-foreground transition-colors">
            <Maximize2 className="h-4 w-4" />
          </button>
        </div>
        </>)}

        {/* 3D right-side scene controls */}
        {viewMode === "3D" && (
          <div className="absolute top-1/2 -translate-y-1/2 right-4 z-20 w-[240px] max-h-[88vh] overflow-y-auto rounded-2xl border border-border bg-card/95 backdrop-blur shadow-xl p-3 space-y-3">
            <div>
              <h3 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">3D Scene</h3>
              <p className="text-[11px] text-muted-foreground leading-snug">Drag to orbit · Right-drag to pan · Scroll to zoom</p>
            </div>

            <Separator />
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Sun</h4>

            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Sun brightness</span><span>{directionalIntensity.toFixed(2)}×</span>
              </div>
              <Slider disabled={nightMode} value={[directionalIntensity]} min={0} max={3} step={0.05} onValueChange={(v) => setDirectionalIntensity(v[0])} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Sun direction (compass)</span><span>{Math.round(sunAzimuthDeg)}°</span>
              </div>
              <Slider disabled={nightMode} value={[sunAzimuthDeg]} min={0} max={360} step={1} onValueChange={(v) => setSunAzimuthDeg(v[0])} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Sun height (horizon → noon)</span><span>{Math.round(sunElevationDeg)}°</span>
              </div>
              <Slider disabled={nightMode} value={[sunElevationDeg]} min={5} max={89} step={1} onValueChange={(v) => setSunElevationDeg(v[0])} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Sun warmth (cool → golden)</span><span>{Math.round(sunWarmth * 100)}%</span>
              </div>
              <Slider disabled={nightMode} value={[sunWarmth]} min={0} max={1} step={0.01} onValueChange={(v) => setSunWarmth(v[0])} />
            </div>

            <Separator />
            <h4 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">Indoor lighting</h4>

            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Sky fill (shadow lift)</span><span>{ambientIntensity.toFixed(2)}×</span>
              </div>
              <Slider value={[ambientIntensity]} min={0} max={2} step={0.05} onValueChange={(v) => setAmbientIntensity(v[0])} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Daylight through windows</span><span>{windowIntensity.toFixed(1)}</span>
              </div>
              <Slider disabled={nightMode} value={[windowIntensity]} min={0} max={20} step={0.5} onValueChange={(v) => setWindowIntensity(v[0])} />
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Ceiling lamps</span><span>{roomLightIntensity.toFixed(2)}</span>
              </div>
              <Slider value={[roomLightIntensity]} min={0} max={10} step={0.1} onValueChange={(v) => setRoomLightIntensity(v[0])} />
            </div>
            <div className="flex items-center justify-between">
              <label className="text-[11px] text-muted-foreground">Night mode (warm lamps)</label>
              <Switch 
                checked={nightMode} 
                onCheckedChange={(checked) => {
                  if (checked) {
                    // Save current values before going to zero
                    savedDaylightRef.current = { sun: directionalIntensity, window: windowIntensity, azimuth: sunAzimuthDeg, elevation: sunElevationDeg, warmth: sunWarmth };
                    setDirectionalIntensity(0);
                    setWindowIntensity(0);
                    setSunAzimuthDeg(0);
                    setSunElevationDeg(0);
                    setSunWarmth(0);
                  } else {
                    // Restore previous daytime values
                    setDirectionalIntensity(savedDaylightRef.current.sun);
                    setWindowIntensity(savedDaylightRef.current.window);
                    setSunAzimuthDeg(savedDaylightRef.current.azimuth);
                    setSunElevationDeg(savedDaylightRef.current.elevation);
                    setSunWarmth(savedDaylightRef.current.warmth);
                  }
                  setNightMode(checked);
                }} 
              />
            </div>


            <Button variant="secondary" className="w-full" onClick={() => setScene3DKey((k) => k + 1)}>
              Reset camera
            </Button>
          </div>
        )}
      </main>

      <UploadPlansDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        initialCeilingIn={ceilingHeightIn}
        initialDoorHeightIn={defaultDoorHeightIn}
        onConfirm={({ count, files, defaults }) => {
          const readFile = (f: File) =>
            new Promise<any>((resolve, reject) => {
              const r = new FileReader();
              r.onload = (e) => {
                try {
                  resolve(JSON.parse(String(e.target?.result)));
                } catch (err) {
                  reject(err);
                }
              };
              r.onerror = () => reject(r.error);
              r.readAsText(f);
            });

          (async () => {
            try {
              const data1 = await readFile(files[0]!);
              const snap1 = buildSnapshotFromPlan(data1, files[0]!.name, {
                ceilingHeightIn: defaults[0].ceilingHeightIn,
                defaultDoorHeightIn: defaults[0].defaultDoorHeightIn,
              }, 1);
              let snap2: FloorSnapshot | null = null;
              if (count === 2 && files[1]) {
                const data2 = await readFile(files[1]);
                snap2 = buildSnapshotFromPlan(data2, files[1].name, {
                  ceilingHeightIn: defaults[1].ceilingHeightIn,
                  defaultDoorHeightIn: defaults[1].defaultDoorHeightIn,
                }, 2);
              }

              // Infer stair directions when the JSON omits them: F1 stairs
              // default to "UP" and F2 stairs default to "DN" so the Master
              // Stair merge pipeline can pair them.
              const inferDirection = (snap: FloorSnapshot, dir: "UP" | "DN") => {
                snap.structures = snap.structures.map((s: any) =>
                  s?.kind === "stairs" && !s.direction ? { ...s, direction: dir } : s,
                );
              };
              if (count === 2) {
                inferDirection(snap1, "UP");
                if (snap2) inferDirection(snap2, "DN");
              }
              // Defer all stair linking / alignment until BOTH floors have
              // been scale-calibrated to world units. Otherwise the math
              // operates on mismatched pixel scales.
              floorSnapshotsRef.current = { 1: snap1, 2: snap2 };
              calibratedFloorsRef.current = new Set();
              pendingMultiFloorLinkRef.current = count === 2;
              setUploadedFloorCount(count);
              setActiveFloor(1);
              hydrateFromSnapshot(snap1);
              setViewMode("2D");
              setSelection3D(null);
              setUploadDialogOpen(false);
              setScalePromptOpen(true);
            } catch (err) {
              alert("Invalid JSON file: " + (err as Error).message);
            }
          })();
        }}
      />

      {/* Manual floor alignment override dialog */}
      <FloorAlignmentDialog
        open={alignDialogOpen}
        onOpenChange={setAlignDialogOpen}
        floor1={floorSnapshotsRef.current[1]}
        floor2={floorSnapshotsRef.current[2]}
        onConfirm={(dx, dy) => {
          // Defensive: re-persist the active floor so `floorSnapshotsRef`
          // reflects the freshest live state before we shift.
          saveActiveFloorSnapshot();
          const snap2 = floorSnapshotsRef.current[2];
          if (!snap2) return;
          const next = shiftFloorCoordinates(snap2 as any, dx, dy) as typeof snap2;
          floorSnapshotsRef.current[2] = next;
          if (activeFloor === 2) {
            hydrateFromSnapshot(next);
            injectMastersForFloor2();
          }

        }}
      />


      {/* Scale calibration prompt (shown right after upload) */}

      <Dialog
        open={scalePromptOpen}
        onOpenChange={(o) => {
          if (!o) setScalePromptOpen(false);
        }}
      >
        <DialogContent 
          className="sm:max-w-sm"
          hideClose // Hides the "X" based on our new prop
          onInteractOutside={(e) => e.preventDefault()} // Stops closing when clicking the background
          onEscapeKeyDown={(e) => e.preventDefault()} // Stops closing when hitting Escape
        >
          <DialogHeader>
            <DialogTitle>
              {uploadedFloorCount === 2
                ? `Calibrate Floor ${activeFloor}`
                : "AI Detection Complete!"}
            </DialogTitle>
            <DialogDescription>
              {uploadedFloorCount === 2
                ? `Please calibrate Floor ${activeFloor} by clicking a wall or window of known length, then enter its real-world dimension. Both floors must be calibrated before stair alignment runs.`
                : "Before editing your plan, please calibrate the scale by clicking a wall or window of known length, then enter its real-world dimension."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => {
                setScalePromptOpen(false);
                initiateCalibration();
              }}
            >
              Calibrate scale
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Calibration dialog */}
      <Dialog
        open={calibDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            setCalibDialog((c) => ({ ...c, open: false }));
            setCalibrationState({ active: false, point1: null });
          }
        }}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{calibDialog.title}</DialogTitle>
            <DialogDescription>
              Enter the real-world dimension. Use formats like <span className="font-mono">10' 6"</span> or <span className="font-mono">3.5</span>.
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={calibDialog.value}
            placeholder={calibDialog.placeholder}
            onChange={(e) => setCalibDialog((c) => ({ ...c, value: e.target.value }))}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmCalibDialog();
            }}
          />
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setCalibDialog((c) => ({ ...c, open: false }));
                setCalibrationState({ active: false, point1: null });
              }}
            >
              Cancel
            </Button>
            <Button onClick={confirmCalibDialog}>Apply</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </TooltipProvider>
  );
}
