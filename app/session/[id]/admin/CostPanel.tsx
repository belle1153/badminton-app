"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface ShuttlecockType {
  id: string;
  name: string;
  pricePerPiece: number;
}

interface ClosedSummary {
  courtCost: number | null;
  shuttlecockCost: number | null;
  totalCost: number | null;
}

/**
 * Closing the day freezes the club's own cost record — the shuttlecocks used
 * (finished games × price). Players are billed separately (flat entry + per-game
 * fee); court rent is not tracked here.
 */
export default function CostPanel({
  sessionId,
  status,
  shuttlecockTypes,
  gamesPlayed,
  defaultShuttlecockTypeId,
  closedSummary,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  shuttlecockTypes: ShuttlecockType[];
  /** Finished games so far — 1 ball per game, so ball cost = games × price. */
  gamesPlayed: number;
  defaultShuttlecockTypeId: string | null;
  closedSummary: ClosedSummary | null;
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [shuttlecockTypeId, setShuttlecockTypeId] = useState(
    defaultShuttlecockTypeId ?? shuttlecockTypes[0]?.id ?? ""
  );

  const selectedShuttle = shuttlecockTypes.find((s) => s.id === shuttlecockTypeId);
  const previewShuttleCost = selectedShuttle ? selectedShuttle.pricePerPiece * gamesPlayed : 0;

  async function handleClose() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shuttlecockTypeId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ปิดวันไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleReopen() {
    if (!confirm("เปิดวันนี้อีกครั้ง? ยอดที่คำนวณไว้จะถูกล้าง")) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/reopen`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "เปิดวันไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">ค่าใช้จ่าย{isClosed ? " (ปิดวันแล้ว)" : " & ปิดวัน"}</h2>
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {isClosed ? (
        <div className="text-sm flex flex-col gap-2">
          {(closedSummary?.courtCost ?? 0) > 0 && <p>ค่าคอร์ท: {closedSummary?.courtCost} บาท</p>}
          <p>ค่าลูกแบด: {closedSummary?.shuttlecockCost} บาท</p>
          <p className="font-semibold">รวม: {closedSummary?.totalCost} บาท</p>
          <button
            onClick={handleReopen}
            disabled={loading}
            className="rounded-md border border-brand-400 text-brand-700 px-4 py-2 text-sm font-medium hover:bg-brand-50 disabled:opacity-50 self-start"
          >
            {loading ? "กำลังเปิด..." : "เปิดวันอีกครั้ง"}
          </button>
        </div>
      ) : shuttlecockTypes.length === 0 ? (
        <p className="text-sm text-gray-500">
          ยังไม่มีข้อมูลลูกแบด ไปเพิ่มที่{" "}
          <a href="/admin/master" className="text-brand-700 hover:underline">
            หน้า Master ข้อมูล
          </a>{" "}
          ก่อนครับ
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">
            ต้นทุนก๊วน = ค่าลูกแบด (จำนวนลูกดึงจากเกมที่เล่นจบ) — เลือกแค่รุ่นลูกที่ใช้
          </p>
          <label className="text-sm text-gray-600 flex flex-col gap-1">
            ลูกแบด
            <select
              value={shuttlecockTypeId}
              onChange={(e) => setShuttlecockTypeId(e.target.value)}
              className="input"
            >
              {shuttlecockTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.pricePerPiece} บาท/ลูก)
                </option>
              ))}
            </select>
          </label>
          <div className="text-sm text-gray-600 rounded-md bg-gray-50 border border-gray-100 p-2.5 flex flex-col gap-0.5">
            <p>
              ค่าลูกแบด: {selectedShuttle?.pricePerPiece ?? 0} × {gamesPlayed} เกม ={" "}
              <span className="font-medium">{previewShuttleCost}</span> บาท
            </p>
            <p className="font-semibold pt-0.5">รวม: {previewShuttleCost} บาท</p>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 self-start"
          >
            {loading ? "กำลังปิดวัน..." : "คำนวณและปิดวัน"}
          </button>
        </div>
      )}
    </section>
  );
}
