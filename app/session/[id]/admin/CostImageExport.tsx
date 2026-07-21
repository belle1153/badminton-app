"use client";

import { useState } from "react";

export interface ExportRow {
  name: string;
  slot: string;
  hours: string;
  games: number;
  courtBaht: number;
  ballBaht: number;
  totalBaht: number;
  live: boolean;
}

const FONT = '"Noto Sans Thai","Sarabun",system-ui,-apple-system,"Segoe UI",sans-serif';
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/**
 * Save the per-person bill as a PNG the admin can drop straight into the club
 * chat. Drawn on a canvas rather than screenshotting the DOM: no extra
 * dependency, and Thai text renders with the device's own fonts.
 */
export default function CostImageExport({
  venue,
  dateLabel,
  rows,
  note,
}: {
  venue: string;
  dateLabel: string;
  rows: ExportRow[];
  note: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makeImage() {
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const scale = 2; // crisp on phones
      const W = 900;
      const pad = 28;
      const bandH = 76;
      const headH = 32;
      const rowH = 36;
      const totalH = 44;
      const noteH = 46;
      const H = bandH + 18 + headH + rows.length * rowH + totalH + noteH;

      const canvas = document.createElement("canvas");
      canvas.width = W * scale;
      canvas.height = H * scale;
      const g = canvas.getContext("2d");
      if (!g) throw new Error("วาดรูปไม่ได้บนเครื่องนี้");
      g.scale(scale, scale);
      g.textBaseline = "middle";

      g.fillStyle = "#ffffff";
      g.fillRect(0, 0, W, H);

      // Title band
      g.fillStyle = "#1e293b";
      g.fillRect(0, 0, W, bandH);
      g.fillStyle = "#ffffff";
      g.font = font(700, 24);
      g.textAlign = "left";
      g.fillText(venue, pad, 30);
      g.font = font(400, 15);
      g.fillStyle = "rgba(255,255,255,0.75)";
      g.fillText(dateLabel, pad, 56);
      g.textAlign = "right";
      g.font = font(600, 15);
      g.fillStyle = "rgba(255,255,255,0.9)";
      g.fillText("สรุปค่าใช้จ่ายรายคน", W - pad, 30);

      // Columns: [label, x, align]. Right-aligned columns give x as right edge.
      const cols: [string, number, CanvasTextAlign][] = [
        ["ชื่อ", pad, "left"],
        ["เริ่ม", 272, "left"],
        ["ชม.", 400, "right"],
        ["เกม", 462, "right"],
        ["ค่าคอร์ท", 600, "right"],
        ["ค่าลูก", 716, "right"],
        ["รวม (฿)", W - pad, "right"],
      ];

      let y = bandH + 18;
      g.fillStyle = "#f1f5f9";
      g.fillRect(0, y, W, headH);
      g.fillStyle = "#475569";
      g.font = font(600, 13);
      for (const [label, x, align] of cols) {
        g.textAlign = align;
        g.fillText(label, x, y + headH / 2);
      }
      y += headH;

      let sumCourt = 0;
      let sumBall = 0;
      let sumTotal = 0;
      rows.forEach((r, i) => {
        if (i % 2 === 1) {
          g.fillStyle = "#fafafa";
          g.fillRect(0, y, W, rowH);
        }
        const mid = y + rowH / 2;
        const cells: [string, number, CanvasTextAlign, string, number][] = [
          [r.name, pad, "left", "#0f172a", 600],
          [r.slot, 272, "left", "#64748b", 400],
          [r.hours, 400, "right", "#0f172a", 400],
          [String(r.games), 462, "right", "#0f172a", 400],
          [`${r.courtBaht}${r.live ? " *" : ""}`, 600, "right", "#0f172a", 400],
          [String(r.ballBaht), 716, "right", "#0f172a", 400],
          [String(r.totalBaht), W - pad, "right", "#0f172a", 700],
        ];
        for (const [text, x, align, color, weight] of cells) {
          g.textAlign = align;
          g.fillStyle = color;
          g.font = font(weight, 15);
          g.fillText(text, x, mid);
        }
        g.strokeStyle = "#eef2f7";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, y + rowH);
        g.lineTo(W, y + rowH);
        g.stroke();

        sumCourt += r.courtBaht;
        sumBall += r.ballBaht;
        sumTotal += r.totalBaht;
        y += rowH;
      });

      // Total row
      g.fillStyle = "#fff7ed";
      g.fillRect(0, y, W, totalH);
      const tmid = y + totalH / 2;
      g.font = font(700, 15);
      g.fillStyle = "#9a3412";
      g.textAlign = "left";
      g.fillText(`รวม ${rows.length} คน`, pad, tmid);
      g.textAlign = "right";
      g.fillText(String(sumCourt), 600, tmid);
      g.fillText(String(sumBall), 716, tmid);
      g.font = font(700, 18);
      g.fillText(`${sumTotal} ฿`, W - pad, tmid);
      y += totalH;

      // Footnote
      g.font = font(400, 12);
      g.fillStyle = "#94a3b8";
      g.textAlign = "left";
      g.fillText(note, pad, y + 18);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("สร้างรูปไม่สำเร็จ");

      const fileName = `cost-${dateLabel.replace(/[^\w฀-๿]+/g, "-")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      // Phones: hand it to the share sheet (LINE etc). Desktop: download.
      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "สรุปค่าใช้จ่าย" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
      // Share sheet dismissed isn't an error worth showing.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "บันทึกรูปไม่สำเร็จ");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={makeImage}
        disabled={busy || rows.length === 0}
        className="self-start rounded-md border-2 border-brand-600 text-brand-700 text-sm font-medium px-3 py-1.5 hover:bg-brand-50 disabled:opacity-50"
      >
        {busy ? "กำลังสร้างรูป…" : "🖼️ บันทึกเป็นรูป (ส่งให้สมาชิก)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
