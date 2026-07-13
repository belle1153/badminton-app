"use client";

import { useEffect, useRef, useState } from "react";

const VIEW = 260; // on-screen square crop window (px)
const OUT = 200; // exported avatar size (px)

/**
 * Square-crop a chosen image before upload: pan by dragging, zoom with the
 * slider, then confirm to get a resized JPEG data URL. No external library —
 * the visible square is mapped straight onto an output canvas.
 */
export default function PhotoCropModal({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (dataUrl: string) => void;
}) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => setImg(image);
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Base scale = "cover" so the image always fills the window at zoom 1.
  const base = img ? VIEW / Math.min(img.width, img.height) : 1;
  const k = base * zoom;
  const dw = img ? img.width * k : 0;
  const dh = img ? img.height * k : 0;

  function clamp(x: number, y: number) {
    return {
      x: Math.min(0, Math.max(VIEW - dw, x)),
      y: Math.min(0, Math.max(VIEW - dh, y)),
    };
  }

  // Re-center / re-clamp whenever zoom (and therefore dw/dh) changes.
  useEffect(() => {
    if (!img) return;
    setOffset((o) => clamp(o.x, o.y));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom, img]);

  function onPointerDown(e: React.PointerEvent) {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!drag.current) return;
    const nx = drag.current.ox + (e.clientX - drag.current.x);
    const ny = drag.current.oy + (e.clientY - drag.current.y);
    setOffset(clamp(nx, ny));
  }
  function onPointerUp() {
    drag.current = null;
  }

  function confirm() {
    if (!img) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT;
    canvas.height = OUT;
    const ctx = canvas.getContext("2d")!;
    // Source rectangle = the part of the image under the crop window.
    const sx = -offset.x / k;
    const sy = -offset.y / k;
    const s = VIEW / k;
    ctx.drawImage(img, sx, sy, s, s, 0, 0, OUT, OUT);
    onCropped(canvas.toDataURL("image/jpeg", 0.75));
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl p-4 flex flex-col gap-3 w-full max-w-xs">
        <h3 className="font-semibold text-center">ปรับรูป</h3>
        <div
          className="relative mx-auto overflow-hidden rounded-full bg-gray-100 touch-none select-none"
          style={{ width: VIEW, height: VIEW }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
        >
          {img && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={img.src}
              alt="crop"
              draggable={false}
              style={{
                position: "absolute",
                left: offset.x,
                top: offset.y,
                width: dw,
                height: dh,
                maxWidth: "none",
              }}
            />
          )}
        </div>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="w-full"
        />
        <p className="text-xs text-gray-400 text-center">ลากเพื่อเลื่อน · สไลด์เพื่อซูม</p>
        <div className="flex gap-2">
          <button
            onClick={confirm}
            disabled={!img}
            className="flex-1 rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            ใช้รูปนี้
          </button>
          <button
            onClick={onCancel}
            className="rounded-md border border-gray-300 text-gray-600 px-4 py-2 text-sm font-medium hover:bg-gray-50"
          >
            ยกเลิก
          </button>
        </div>
      </div>
    </div>
  );
}
