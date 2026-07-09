"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface ConfirmedSignUp {
  id: string;
  name: string;
  skillLevel: string;
  fixedPartnerId: string | null;
  checkedIn: boolean;
}

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

export default function AdminPanel({
  sessionId,
  status,
  registrationClosed,
  confirmedSignUps,
  courtRates,
  shuttlecockTypes,
  closedSummary,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  registrationClosed: boolean;
  confirmedSignUps: ConfirmedSignUp[];
  courtRates: CourtRate[];
  shuttlecockTypes: ShuttlecockType[];
  closedSummary: ClosedSummary | null;
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";
  const confirmedCount = confirmedSignUps.length;

  const [selectedCourts, setSelectedCourts] = useState<Set<number>>(new Set());
  const checkedInIds = confirmedSignUps.filter((s) => s.checkedIn).map((s) => s.id);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set(checkedInIds));

  useEffect(() => {
    setSelectedPlayerIds(new Set(checkedInIds));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkedInIds.join(",")]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"matches" | "pair" | "unpair" | "close" | "registration" | null>(
    null
  );
  const [benchNames, setBenchNames] = useState<string[] | null>(null);

  const [partnerA, setPartnerA] = useState("");
  const [partnerB, setPartnerB] = useState("");

  const [courtRateId, setCourtRateId] = useState(courtRates[0]?.id ?? "");
  const [courtHours, setCourtHours] = useState("2");
  const [shuttlecockTypeId, setShuttlecockTypeId] = useState(shuttlecockTypes[0]?.id ?? "");
  const [shuttlecockQty, setShuttlecockQty] = useState("0");

  const unpaired = confirmedSignUps.filter((s) => !s.fixedPartnerId);
  const pairs = useMemo(() => {
    const seen = new Set<string>();
    const result: [ConfirmedSignUp, ConfirmedSignUp][] = [];
    for (const s of confirmedSignUps) {
      if (!s.fixedPartnerId || seen.has(s.id)) continue;
      const partner = confirmedSignUps.find((p) => p.id === s.fixedPartnerId);
      if (!partner) continue;
      seen.add(s.id);
      seen.add(partner.id);
      result.push([s, partner]);
    }
    return result;
  }, [confirmedSignUps]);

  const selectedRate = courtRates.find((r) => r.id === courtRateId);
  const selectedShuttle = shuttlecockTypes.find((s) => s.id === shuttlecockTypeId);
  const previewCourtCost = selectedRate ? selectedRate.pricePerHour * Number(courtHours || 0) : 0;
  const previewShuttleCost = selectedShuttle ? selectedShuttle.pricePerPiece * Number(shuttlecockQty || 0) : 0;

  function toggleCourt(court: number) {
    setSelectedCourts((prev) => {
      const next = new Set(prev);
      if (next.has(court)) next.delete(court);
      else next.add(court);
      return next;
    });
  }

  function togglePlayer(id: string) {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleToggleRegistration() {
    setError(null);
    setLoading("registration");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/registration`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ closed: !registrationClosed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ทำรายการไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function handleGenerateMatches() {
    setError(null);
    setLoading("matches");
    setBenchNames(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courtNumbers: [...selectedCourts],
          signUpIds: [...selectedPlayerIds],
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "รันรอบไม่สำเร็จ");
      setBenchNames(data.bench.map((p: { name: string }) => p.name));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("pair");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signUpIdA: partnerA, signUpIdB: partnerB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "จับคู่ไม่สำเร็จ");
      setPartnerA("");
      setPartnerB("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function handleUnpair(signUpId: string) {
    setError(null);
    setLoading("unpair");
    try {
      await fetch(`/api/sessions/${sessionId}/pairs/unpair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signUpId }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  async function handleClose() {
    setError(null);
    setLoading("close");
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
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      {!isClosed && (
        <section className="flex items-center justify-between gap-3 rounded-md border border-gray-200 p-3">
          <div>
            <h2 className="font-semibold">การรับสมัคร</h2>
            <p className="text-xs text-gray-500">
              {registrationClosed ? "ปิดรับสมัครแล้ว — ผู้เล่นใหม่ลงชื่อไม่ได้" : "เปิดรับสมัครอยู่"}
            </p>
          </div>
          <button
            onClick={handleToggleRegistration}
            disabled={loading === "registration"}
            className={`rounded-md px-4 py-2 text-sm font-medium disabled:opacity-50 whitespace-nowrap ${
              registrationClosed
                ? "bg-brand-600 text-white hover:bg-brand-700"
                : "bg-gray-200 text-gray-700 hover:bg-gray-300"
            }`}
          >
            {loading === "registration"
              ? "กำลังทำรายการ..."
              : registrationClosed
                ? "เปิดรับสมัครอีกครั้ง"
                : "ปิดรับสมัคร"}
          </button>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">จับคู่ตี (รอบถัดไป)</h2>

        <div>
          <p className="text-sm text-gray-600 mb-1">สนามที่ใช้ได้รอบนี้</p>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 3, 4, 5, 6].map((court) => (
              <label
                key={court}
                className={`text-sm rounded-md border px-3 py-1.5 cursor-pointer select-none ${
                  selectedCourts.has(court)
                    ? "bg-brand-600 text-white border-brand-600"
                    : "bg-white text-gray-700 border-gray-300"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedCourts.has(court)}
                  onChange={() => toggleCourt(court)}
                  disabled={isClosed}
                  className="sr-only"
                />
                สนาม {court}
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-gray-600 mb-1">
            คนที่มาเล่นรอบนี้ ({selectedPlayerIds.size}/{confirmedCount}) — ดีฟอลต์เลือกเฉพาะคนที่เช็คอินแล้ว
          </p>
          <div className="flex flex-col gap-1 max-h-48 overflow-y-auto border border-gray-100 rounded-md p-2">
            {confirmedSignUps.map((s) => (
              <label key={s.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedPlayerIds.has(s.id)}
                  onChange={() => togglePlayer(s.id)}
                  disabled={isClosed}
                />
                {s.name} <span className="text-xs text-gray-400">{SKILL_LABELS[s.skillLevel as SkillLevel]}</span>
                {!s.checkedIn && <span className="text-xs text-amber-600">ยังไม่เช็คอิน</span>}
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerateMatches}
          disabled={isClosed || loading === "matches"}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
        >
          {loading === "matches" ? "กำลังรัน..." : "รันรอบ"}
        </button>

        {benchNames && benchNames.length > 0 && (
          <p className="text-xs text-gray-500">พักรอบนี้: {benchNames.join(", ")}</p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">คู่ซ้อมแข่ง (จับคู่ตายตัว)</h2>
        {pairs.length > 0 && (
          <ul className="flex flex-col gap-1">
            {pairs.map(([a, b]) => (
              <li key={a.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1">
                <span>
                  {a.name} + {b.name}
                </span>
                {!isClosed && (
                  <button
                    onClick={() => handleUnpair(a.id)}
                    disabled={loading === "unpair"}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!isClosed && (
          <form onSubmit={handlePair} className="flex gap-2 items-center">
            <select value={partnerA} onChange={(e) => setPartnerA(e.target.value)} required className="input">
              <option value="">เลือกคนที่ 1</option>
              {unpaired.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]})
                </option>
              ))}
            </select>
            <select value={partnerB} onChange={(e) => setPartnerB(e.target.value)} required className="input">
              <option value="">เลือกคนที่ 2</option>
              {unpaired
                .filter((s) => s.id !== partnerA)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]})
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={loading === "pair"}
              className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
            >
              จับคู่
            </button>
          </form>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">ค่าใช้จ่าย{isClosed ? " (ปิดวันแล้ว)" : " & ปิดวัน"}</h2>

        {isClosed ? (
          <div className="text-sm flex flex-col gap-1">
            <p>ค่าคอร์ท: {closedSummary?.courtCost} บาท</p>
            <p>ค่าลูกแบด: {closedSummary?.shuttlecockCost} บาท</p>
            <p className="font-semibold">รวม: {closedSummary?.totalCost} บาท</p>
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
              disabled={loading === "close"}
              className="rounded-md bg-red-600 text-white px-4 py-2 text-sm font-medium hover:bg-red-700 disabled:opacity-50 self-start"
            >
              {loading === "close" ? "กำลังปิดวัน..." : "คำนวณและปิดวัน"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
