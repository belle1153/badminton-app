"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export interface CostTableRow {
  id: string;
  name: string;
  slot: string;
  /** Checkout time label, "ยังเล่นอยู่", or "ไม่มา". */
  outLabel: string;
  games: number;
  entryBaht: number;
  gameBaht: number;
  totalBaht: number;
  live: boolean;
  noShow: boolean;
  paid: boolean;
  /** Popup text when this bill can't be ticked yet (still playing / not
   *  checked out), else null — see paidBlockMessage. */
  payBlock: string | null;
}

/**
 * The per-person bill with a "จ่ายแล้ว" toggle. Ticking marks the sign-up
 * collected (server stamps paidAt); anyone left unticked still shows as ยอดค้าง
 * on the web, the exports and the LINE summary.
 */
export default function CostPersonTable({
  sessionId,
  rows,
}: {
  sessionId: string;
  rows: CostTableRow[];
}) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  // Optimistic paid overlay so the tick flips instantly.
  const [paidOverlay, setPaidOverlay] = useState<Map<string, boolean>>(new Map());

  const isPaid = (r: CostTableRow) => paidOverlay.get(r.id) ?? r.paid;

  async function togglePaid(row: CostTableRow, paid: boolean) {
    const id = row.id;
    // Collect only once they're done for the night — finished on court and
    // checked out — so the bill can't grow after it's marked paid. Popup says
    // which step is missing. (Controlled checkbox, so returning leaves it as is.)
    if (paid && row.payBlock) {
      alert(row.payBlock);
      return;
    }
    // Un-ticking reverses a collected bill back to ยอดค้าง — the box is easy to
    // brush by accident, so confirm before undoing it.
    if (!paid && !confirm('เปลี่ยนสถานะเป็น "ค้างจ่าย" ใช่ไหมครับ?')) return;
    setPaidOverlay((m) => new Map(m).set(id, paid));
    setPending(id);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/signup/${id}/paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paid }),
      });
      if (!res.ok) {
        setPaidOverlay((m) => {
          const n = new Map(m);
          n.delete(id);
          return n;
        });
        // The server re-checks the same rule — e.g. this page was stale and
        // they're back on court — so show why it refused.
        const data = await res.json().catch(() => ({}));
        if (data.error) alert(data.error);
      }
      router.refresh();
    } catch {
      setPaidOverlay((m) => {
        const n = new Map(m);
        n.delete(id);
        return n;
      });
    } finally {
      setPending(null);
    }
  }

  const unpaidCount = rows.filter((r) => !isPaid(r)).length;
  const unpaidBaht = rows.filter((r) => !isPaid(r)).reduce((a, r) => a + r.totalBaht, 0);

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto border border-gray-100 rounded-md">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
              <th className="px-2 py-1.5 font-medium">ชื่อ</th>
              <th className="px-2 py-1.5 font-medium">เริ่ม</th>
              <th className="px-2 py-1.5 font-medium">เช็คเอาท์</th>
              <th className="px-2 py-1.5 font-medium text-right">เกม</th>
              <th className="px-2 py-1.5 font-medium text-right">ค่าสนาม</th>
              <th className="px-2 py-1.5 font-medium text-right">ค่าลูก</th>
              <th className="px-2 py-1.5 font-medium text-right">รวม (฿)</th>
              <th className="px-2 py-1.5 font-medium text-center">จ่ายแล้ว</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const paid = isPaid(r);
              return (
                <tr
                  key={r.id}
                  className={`border-b border-gray-50 ${r.noShow ? "text-gray-400" : ""} ${paid ? "bg-green-50/60" : ""}`}
                >
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.noShow ? "—" : r.slot}</td>
                  <td className="px-2 py-1.5 text-gray-500">
                    {r.noShow ? (
                      <span className="text-amber-600 font-medium">ไม่มา</span>
                    ) : (
                      r.outLabel
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-right">{r.games}</td>
                  <td className="px-2 py-1.5 text-right">{r.entryBaht || "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    {r.gameBaht}
                    {r.live && <span className="text-[10px] text-amber-500"> *</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold">{r.totalBaht}</td>
                  <td className="px-2 py-1.5 text-center">
                    <input
                      type="checkbox"
                      checked={paid}
                      disabled={pending === r.id}
                      onChange={(e) => togglePaid(r, e.target.checked)}
                      className="h-4 w-4 cursor-pointer accent-green-600 disabled:opacity-50"
                      aria-label={`เก็บเงิน ${r.name} แล้ว`}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-500">
        {unpaidCount === 0 ? (
          <span className="text-green-700 font-medium">✅ เก็บครบแล้ว</span>
        ) : (
          <>
            ค้างจ่าย <span className="text-red-600 font-medium">{unpaidCount} คน</span> · {unpaidBaht} ฿
          </>
        )}
      </p>
    </div>
  );
}
