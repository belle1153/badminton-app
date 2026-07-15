"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface CourtRate {
  id: string;
  name: string;
  pricePerHour: number;
}

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

export default function CostPanel({
  sessionId,
  status,
  courtRates,
  shuttlecockTypes,
  courtHourUnits,
  gamesPlayed,
  defaultCourtRateId,
  defaultShuttlecockTypeId,
  closedSummary,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  courtRates: CourtRate[];
  shuttlecockTypes: ShuttlecockType[];
  /** Σ (open courts × block-hours) actually played — court cost = rate × units. */
  courtHourUnits: number;
  /** Finished games so far — 1 ball per game, so ball cost = games × price. */
  gamesPlayed: number;
  defaultCourtRateId: string | null;
  defaultShuttlecockTypeId: string | null;
  closedSummary: ClosedSummary | null;
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [courtRateId, setCourtRateId] = useState(defaultCourtRateId ?? courtRates[0]?.id ?? "");
  const [shuttlecockTypeId, setShuttlecockTypeId] = useState(
    defaultShuttlecockTypeId ?? shuttlecockTypes[0]?.id ?? ""
  );

  const selectedRate = courtRates.find((r) => r.id === courtRateId);
  const selectedShuttle = shuttlecockTypes.find((s) => s.id === shuttlecockTypeId);
  // Everything is derived from actual play: court units and game count. Admin
  // only picks which rate / ball price applies.
  const previewCourtCost = selectedRate ? Math.round(selectedRate.pricePerHour * courtHourUnits) : 0;
  const previewShuttleCost = selectedShuttle ? selectedShuttle.pricePerPiece * gamesPlayed : 0;

  async function handleClose() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courtRateId, shuttlecockTypeId }),
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
          <p>ค่าคอร์ท: {closedSummary?.courtCost} บาท</p>
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
      ) : courtRates.length === 0 || shuttlecockTypes.length === 0 ? (
        <p className="text-sm text-gray-500">
          ยังไม่มีข้อมูลค่าคอร์ท/ลูกแบด ไปเพิ่มที่{" "}
          <a href="/admin/master" className="text-brand-700 hover:underline">
            หน้า Master ข้อมูล
          </a>{" "}
          ก่อนครับ
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-xs text-gray-400">
            คิดยอดอัตโนมัติจากที่เล่นจริง — เลือกแค่เรทคอร์ท/ลูกแบดที่ใช้ (จำนวนสนาม·ชม. และจำนวนลูกดึงจากระบบ)
          </p>
          <label className="text-sm text-gray-600 flex flex-col gap-1">
            เรทคอร์ท
            <select value={courtRateId} onChange={(e) => setCourtRateId(e.target.value)} className="input">
              {courtRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.pricePerHour} บาท/ชม.)
                </option>
              ))}
            </select>
          </label>
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
              ค่าคอร์ท: {selectedRate?.pricePerHour ?? 0} × {courtHourUnits} (สนาม·ชม.) ={" "}
              <span className="font-medium">{previewCourtCost}</span> บาท
            </p>
            <p>
              ค่าลูกแบด: {selectedShuttle?.pricePerPiece ?? 0} × {gamesPlayed} เกม ={" "}
              <span className="font-medium">{previewShuttleCost}</span> บาท
            </p>
            <p className="font-semibold pt-0.5">รวม: {previewCourtCost + previewShuttleCost} บาท</p>
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
