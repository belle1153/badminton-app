"use client";

import { useState } from "react";
import { buildXlsxBlob, type Cell } from "@/lib/xlsx";
import type { ExportRow } from "./CostImageExport";

/**
 * Download the per-person bill as a real .xlsx the admin can open in Excel /
 * Google Sheets. Built from the same rows as the PNG export, with a bold
 * header and a totals row; numbers stay numeric so the admin can re-sum.
 */
export default function CostExcelExport({
  venue,
  dateLabel,
  rows,
}: {
  venue: string;
  dateLabel: string;
  rows: ExportRow[];
}) {
  const [error, setError] = useState<string | null>(null);

  function makeExcel() {
    if (rows.length === 0) return;
    setError(null);
    try {
      const header: Cell[] = ["ชื่อ", "เริ่ม", "เช็คเอาท์", "ชม.คิด", "เกม", "ค่าคอร์ท (฿)", "ค่าลูก (฿)", "รวม (฿)"];
      const body: Cell[][] = rows.map((r) => [
        r.name,
        r.slot,
        r.out,
        r.hours,
        r.games,
        r.courtBaht,
        r.ballBaht,
        r.totalBaht,
      ]);
      const totalRow: Cell[] = [
        `รวม ${rows.length} คน`,
        "",
        "",
        "",
        rows.reduce((a, r) => a + r.games, 0),
        rows.reduce((a, r) => a + r.courtBaht, 0),
        rows.reduce((a, r) => a + r.ballBaht, 0),
        rows.reduce((a, r) => a + r.totalBaht, 0),
      ];

      const blob = buildXlsxBlob(`สรุป ${dateLabel}`.slice(0, 31), [header, ...body, totalRow], {
        colWidths: [18, 8, 10, 9, 6, 13, 11, 11],
        boldFirstRow: true,
        boldLastRow: true,
      });

      const safe = `${venue}-${dateLabel}`.replace(/[^\w฀-๿]+/g, "-").replace(/^-+|-+$/g, "");
      const fileName = `cost-${safe || "export"}.xlsx`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "สร้างไฟล์ Excel ไม่สำเร็จ");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={makeExcel}
        disabled={rows.length === 0}
        className="self-start rounded-md border-2 border-green-600 text-green-700 text-sm font-medium px-3 py-1.5 hover:bg-green-50 disabled:opacity-50"
      >
        📊 ดาวน์โหลด Excel
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
