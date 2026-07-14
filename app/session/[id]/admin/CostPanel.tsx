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
  closedSummary,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  courtRates: CourtRate[];
  shuttlecockTypes: ShuttlecockType[];
  closedSummary: ClosedSummary | null;
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [courtRateId, setCourtRateId] = useState(courtRates[0]?.id ?? "");
  const [courtHours, setCourtHours] = useState("2");
  const [shuttlecockTypeId, setShuttlecockTypeId] = useState(shuttlecockTypes[0]?.id ?? "");
  const [shuttlecockQty, setShuttlecockQty] = useState("0");

  const selectedRate = courtRates.find((r) => r.id === courtRateId);
  const selectedShuttle = shuttlecockTypes.find((s) => s.id === shuttlecockTypeId);
  const previewCourtCost = selectedRate ? selectedRate.pricePerHour * Number(courtHours || 0) : 0;
  const previewShuttleCost = selectedShuttle ? selectedShuttle.pricePerPiece * Number(shuttlecockQty || 0) : 0;

  async function handleClose() {
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtRateId,
          courtHours: Number(courtHours),
          shuttlecockTypeId,
          shuttlecockQty: Number(shuttlecockQty),
        }),
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
          <div className="flex gap-2 items-center">
            <select value={courtRateId} onChange={(e) => setCourtRateId(e.target.value)} className="input flex-1">
              {courtRates.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} ({r.pricePerHour} บาท/ชม.)
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              step={0.5}
              value={courtHours}
              onChange={(e) => setCourtHours(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="input w-24"
              placeholder="ชม."
            />
          </div>
          <div className="flex gap-2 items-center">
            <select
              value={shuttlecockTypeId}
              onChange={(e) => setShuttlecockTypeId(e.target.value)}
              className="input flex-1"
            >
              {shuttlecockTypes.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.pricePerPiece} บาท/ลูก)
                </option>
              ))}
            </select>
            <input
              type="number"
              min={0}
              value={shuttlecockQty}
              onChange={(e) => setShuttlecockQty(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="input w-24"
              placeholder="ลูก"
            />
          </div>
          <p className="text-sm text-gray-600">
            ค่าคอร์ท {previewCourtCost} + ค่าลูกแบด {previewShuttleCost} = รวม{" "}
            <span className="font-semibold">{previewCourtCost + previewShuttleCost} บาท</span>
          </p>
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
