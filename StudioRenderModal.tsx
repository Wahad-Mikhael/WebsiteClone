import { useEffect, useRef, useState } from "react";
import { X, Download, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StudioSession } from "@/components/FloorPlan3D";

type Phase = "building" | "rendering" | "complete" | "error";

type Props = {
  open: boolean;
  width: number;
  height: number;
  targetSamples: number;
  /** Bridge factory — invoked on mount to create the session. */
  createSession: () => StudioSession | null;
  onClose: () => void;
};

export default function StudioRenderModal({ open, width, height, targetSamples, createSession, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sessionRef = useRef<StudioSession | null>(null);
  const [phase, setPhase] = useState<Phase>("building");
  const [samples, setSamples] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const targetRef = useRef(targetSamples);
  targetRef.current = targetSamples;

  useEffect(() => {
    if (!open) return;
    const session = createSession();
    if (!session) {
      setPhase("error");
      setErrorMsg("Renderer not ready");
      return;
    }
    sessionRef.current = session;
    setPhase("building");
    setSamples(0);
    setErrorMsg(null);

    // Ensure 2D canvas is sized correctly.
    const c = canvasRef.current;
    if (c) {
      c.width = width;
      c.height = height;
      const ctx = c.getContext("2d");
      if (ctx) ctx.clearRect(0, 0, width, height);
    }

    let cancelled = false;

    session.start(
      targetRef.current,
      (n) => {
        if (cancelled) return;
        if (n === 0) setPhase("rendering");
        setSamples(n);
        if (n >= targetRef.current) setPhase("complete");
      },
      (srcCanvas) => {
        if (cancelled) return;
        const target = canvasRef.current;
        if (!target) return;
        const ctx = target.getContext("2d");
        if (!ctx) return;
        try {
          ctx.drawImage(srcCanvas, 0, 0, target.width, target.height);
        } catch {
          /* noop */
        }
      },
      () => {
        if (cancelled) return;
        setPhase("complete");
      },
      (err) => {
        if (cancelled) return;
        console.error("[Studio] render error:", err);
        setPhase("error");
        setErrorMsg("Render failed — try lower resolution");
      },
    );

    return () => {
      cancelled = true;
      try { session.cancel(); } catch { /* noop */ }
      sessionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, width, height]);

  const handleSave = () => {
    const s = sessionRef.current;
    if (!s) return;
    const url = s.save();
    if (!url) return;
    const a = document.createElement("a");
    a.href = url;
    a.download = `studio_render_${width}x${height}_${samples}spp.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleCancel = () => {
    try { sessionRef.current?.cancel(); } catch { /* noop */ }
    onClose();
  };

  if (!open) return null;

  const pct = Math.min(100, Math.round((samples / Math.max(1, targetSamples)) * 100));
  const statusText =
    phase === "building" ? "Building scene geometry…"
    : phase === "rendering" ? `Rendering — sample ${samples} / ${targetSamples}`
    : phase === "complete" ? `Complete — ${samples} samples`
    : (errorMsg ?? "Render failed");

  return (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col text-white">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="text-sm font-semibold tracking-wide">Studio Render</div>
          <div className="text-[11px] text-white/60">{width} × {height}</div>
        </div>
        <button
          aria-label="Close"
          onClick={handleCancel}
          className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 flex items-center justify-center p-6 min-h-0">
        <div
          className="relative border border-white/10 rounded-md overflow-hidden bg-black shadow-2xl"
          style={{ aspectRatio: `${width} / ${height}`, maxWidth: "100%", maxHeight: "100%", width: "min(100%, calc((100vh - 220px) * " + (width / height) + "))" }}
        >
          <canvas ref={canvasRef} className="block w-full h-full" />
          {phase === "building" && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <Loader2 className="h-8 w-8 animate-spin text-white/80" />
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/10 px-6 py-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="text-xs text-white/70 flex-1">{statusText}</div>
          <div className="text-[11px] uppercase tracking-wider text-white/50">Target: {targetSamples} samples</div>
        </div>

        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
          <div
            className={cn(
              "h-full transition-all duration-200",
              phase === "error" ? "bg-red-500" : "bg-primary",
            )}
            style={{ width: `${pct}%` }}
          />
        </div>

        <div className="flex items-center justify-end gap-2">
          <button
            onClick={handleCancel}
            className="h-9 px-4 rounded-md text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={samples < 1 || phase === "error"}
            className="h-9 px-4 rounded-md text-xs font-semibold bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Save Image
          </button>
        </div>
      </div>
    </div>
  );
}
