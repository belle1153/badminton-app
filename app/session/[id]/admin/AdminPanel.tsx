"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";
import ManualMatchForm from "./ManualMatchForm";

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
  confirmedSignUps,
  courtRates,
  shuttlecockTypes,
  closedSummary,
  hasMatches,
  sessionCourts,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  confirmedSignUps: ConfirmedSignUp[];
  courtRates: CourtRate[];
  shuttlecockTypes: ShuttlecockType[];
  closedSummary: ClosedSummary | null;
  hasMatches: boolean;
  sessionCourts: number;
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";
  const confirmedCount = confirmedSignUps.length;

  // Courts this session actually uses (from its court config), numbered 1..N.
  const courtOptions = Array.from({ length: sessionCourts }, (_, i) => i + 1);
  // Default to every configured court selected; admin unticks for an early-block
  // round that opens fewer courts than the late block.
  const [selectedCourts, setSelectedCourts] = useState<Set<number>>(new Set(courtOptions));
  const checkedInIds = confirmedSignUps.filter((s) => s.checkedIn).map((s) => s.id);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<
    "matches" | "clearMatches" | "pair" | "unpair" | "close" | null
  >(null);
  const [benchNames, setBenchNames] = useState<string[] | null>(null);
  const [createdRounds, setCreatedRounds] = useState<number[] | null>(null);
  // Guards against double-fired clicks (e.g. mobile double-tap) landing before
  // React re-renders with the disabled state — state alone isn't synchronous.
  const busyRef = useRef(false);

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

  async function handleGenerateMatches() {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setLoading("matches");
    setBenchNames(null);
    setCreatedRounds(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Guard against a stale selection lingering above the configured
          // court count (e.g. after the court count was lowered mid-session).
          courtNumbers: [...selectedCourts].filter((c) => c <= sessionCourts),
          signUpIds: checkedInIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "รันรอบไม่สำเร็จ");
      setCreatedRounds(data.rounds);
      setBenchNames(data.bench.map((p: { name: string }) => p.name));
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      busyRef.current = false;
      setLoading(null);
    }
  }

  async function handleClearMatches() {
    if (busyRef.current) return;
    if (!confirm("ล้างการจับคู่ทั้งหมดของรอบนี้ใช่ไหมครับ? ทุกรอบที่รันไปแล้วจะหายไป")) return;
    busyRef.current = true;
    setError(null);
    setLoading("clearMatches");
    setBenchNames(null);
    setCreatedRounds(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/clear`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ล้างจับคู่ไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      busyRef.current = false;
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

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold">จับคู่ตี — กดครั้งเดียว จัดให้ทุกคนได้เล่นครบ</h2>

        <div>
          <p className="text-sm text-gray-600 mb-1">สนามที่ใช้ได้รอบนี้</p>
          <div className="flex flex-wrap gap-2">
            {courtOptions.map((court) => (
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

        <p className="text-sm text-gray-600">
          จะจัดจากคนที่เช็คอินแล้ว{" "}
          <span className="font-semibold text-brand-700">
            {checkedInIds.length}/{confirmedCount}
          </span>{" "}
          คน — ติ๊กเช็คอินด้านบนก่อนกดรัน
        </p>

        <div className="flex gap-2">
          <button
            onClick={handleGenerateMatches}
            disabled={isClosed || loading === "matches" || checkedInIds.length === 0}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
          >
            {loading === "matches" ? "กำลังรัน..." : "รันรอบ (จัดครบทุกคน)"}
          </button>
          {hasMatches && (
            <button
              onClick={handleClearMatches}
              disabled={isClosed || loading === "clearMatches"}
              className="rounded-md border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 self-start"
            >
              {loading === "clearMatches" ? "กำลังล้าง..." : "ล้างจับคู่ทั้งหมด"}
            </button>
          )}
        </div>

        {createdRounds && createdRounds.length > 0 && (
          <p className="text-xs text-brand-700">
            สร้างรอบที่ {createdRounds.join(", ")} แล้ว — ทุกคนได้ลงเล่นครบ
            {benchNames && benchNames.length > 0 ? " ยกเว้นสแปร์ด้านล่าง" : ""}
          </p>
        )}
        {benchNames && benchNames.length > 0 && (
          <p className="text-xs text-amber-600">
            สแปร์ (จับคู่ไม่ครบ 4 คน — สลับลงเล่นได้ในส่วน &quot;แก้ไขการจับคู่&quot; ด้านล่าง): {benchNames.join(", ")}
          </p>
        )}
      </section>

      {!isClosed && (
        <ManualMatchForm
          sessionId={sessionId}
          sessionCourts={sessionCourts}
          players={confirmedSignUps
            .filter((s) => s.checkedIn)
            .map((s) => ({ id: s.id, name: s.name }))}
        />
      )}

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
