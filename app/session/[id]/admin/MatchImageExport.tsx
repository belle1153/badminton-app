"use client";

import { useState } from "react";

export interface ResultRow {
  seq: number;
  court: number;
  team1: string[];
  team2: string[];
  winnerTeam: number | null; // 1 = team A, 2 = team B, null = draw
}

const FONT = '"Noto Sans Thai","Sarabun",system-ui,-apple-system,"Segoe UI",sans-serif';
const font = (weight: number, size: number) => `${weight} ${size}px ${FONT}`;

/**
 * Save the day's match results as a PNG the admin can drop into the club chat —
 * same canvas approach (no dependency, device fonts render Thai) as the cost
 * image export. One row per finished game: เกม · สนาม · ทีม A · ผล · ทีม B, the
 * winning team in green.
 */
export default function MatchImageExport({
  venue,
  dateLabel,
  rows,
}: {
  venue: string;
  dateLabel: string;
  rows: ResultRow[];
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function makeImage() {
    if (rows.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      const scale = 2;
      const W = 900;
      const pad = 28;
      const bandH = 76;
      const headH = 32;
      const rowH = 52;
      const footH = 40;
      const H = bandH + 14 + headH + rows.length * rowH + footH;

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
      g.fillText("ผลการแข่งขัน", W - pad, 30);

      // Column anchors
      const xSeq = 46; // center
      const xCourt = 96; // center
      const xTeamA = 400; // right edge
      const xResult = 450; // center
      const xTeamB = 500; // left edge

      // Header
      let y = bandH + 14;
      g.fillStyle = "#f1f5f9";
      g.fillRect(0, y, W, headH);
      g.fillStyle = "#475569";
      g.font = font(600, 13);
      const heads: [string, number, CanvasTextAlign][] = [
        ["เกม", xSeq, "center"],
        ["สนาม", xCourt, "center"],
        ["ทีม A", xTeamA, "right"],
        ["ผล", xResult, "center"],
        ["ทีม B", xTeamB, "left"],
      ];
      for (const [label, x, align] of heads) {
        g.textAlign = align;
        g.fillText(label, x, y + headH / 2);
      }
      y += headH;

      rows.forEach((r, i) => {
        if (i % 2 === 1) {
          g.fillStyle = "#fafafa";
          g.fillRect(0, y, W, rowH);
        }
        const mid = y + rowH / 2;
        const l1 = mid - 10;
        const l2 = mid + 10;

        g.fillStyle = "#64748b";
        g.font = font(600, 14);
        g.textAlign = "center";
        g.fillText(String(r.seq), xSeq, mid);
        g.font = font(400, 13);
        g.fillText(String(r.court), xCourt, mid);

        const drawTeam = (names: string[], x: number, align: CanvasTextAlign, won: boolean) => {
          g.textAlign = align;
          g.fillStyle = won ? "#16a34a" : "#0f172a";
          g.font = font(won ? 700 : 400, 14);
          g.fillText(names[0] ?? "", x, l1);
          g.fillText(names[1] ?? "", x, l2);
        };
        drawTeam(r.team1, xTeamA, "right", r.winnerTeam === 1);
        drawTeam(r.team2, xTeamB, "left", r.winnerTeam === 2);

        // Result label
        g.textAlign = "center";
        if (r.winnerTeam == null) {
          g.fillStyle = "#d97706";
          g.font = font(700, 12);
          g.fillText("เสมอ", xResult, mid);
        } else {
          g.fillStyle = "#16a34a";
          g.font = font(700, 12);
          g.fillText(r.winnerTeam === 1 ? "◀ A" : "B ▶", xResult, mid);
        }

        g.strokeStyle = "#eef2f7";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(0, y + rowH);
        g.lineTo(W, y + rowH);
        g.stroke();
        y += rowH;
      });

      // Footnote
      g.font = font(400, 12);
      g.fillStyle = "#94a3b8";
      g.textAlign = "left";
      g.fillText(`รวม ${rows.length} เกม · ทีมที่ชนะแสดงเป็นสีเขียว`, pad, y + 18);

      const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
      if (!blob) throw new Error("สร้างรูปไม่สำเร็จ");

      const fileName = `results-${dateLabel.replace(/[^\w฀-๿]+/g, "-")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });

      const nav = navigator as Navigator & {
        canShare?: (d: { files: File[] }) => boolean;
        share?: (d: { files: File[]; title?: string }) => Promise<void>;
      };
      if (nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: "ผลการแข่งขัน" });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch (err) {
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
        {busy ? "กำลังสร้างรูป…" : "🖼️ บันทึกผลเป็นรูป (ส่งให้สมาชิก)"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
