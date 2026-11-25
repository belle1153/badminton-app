"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { COURT_OPTIONS, DEFAULT_MAX_PLAYERS, capacityFor, parseMaxPlayers } from "@/lib/capacity";
import { DEFAULT_START_TIME, normalizeStartTime, slotLabel } from "@/lib/sessionTime";
import { WAITLIST_LIMIT } from "@/lib/signup";

export default function NewSessionForm() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [startTime, setStartTime] = useState(DEFAULT_START_TIME);
  const [maxPlayers, setMaxPlayers] = useState(String(DEFAULT_MAX_PLAYERS));
  const [courtsEarly, setCourtsEarly] = useState("3");
  const [courtsLate, setCourtsLate] = useState("5");
  const [courtConfigNote, setCourtConfigNote] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const earlyCapacity = capacityFor(Number(courtsEarly));
  const totalCapacity = parseMaxPlayers(maxPlayers);
  // Blocks are named by clock time: 19:00 น. / 20:00 น. on a 19:00 day.
  const validStart = normalizeStartTime(startTime);
  const early = slotLabel(validStart, "EARLY");
  const late = slotLabel(validStart, "LATE");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          venue,
          startTime,
          maxPlayers,
          courtsEarly,
          courtsLate,
          courtConfigNote,
          remark,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สร้างรอบไม่สำเร็จ");

      router.push(`/session/${data.id}/admin`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-lg mx-auto w-full p-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold">สร้างรอบเล่นแบดใหม่</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <Field label="วันที่">
          <input
            type="date"
            required
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="สนาม">
          <input
            required
            placeholder="เช่น Copa Sport Club"
            value={venue}
            onChange={(e) => setVenue(e.target.value)}
            className="input"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="เวลาเริ่ม">
            <input
              type="time"
              required
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              className="input"
            />
          </Field>
          <Field label="รับกี่คน">
            <input
              type="number"
              inputMode="numeric"
              required
              min={1}
              max={200}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(e.target.value)}
              className="input"
            />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label={`คอร์ทช่วง ${early}`}>
            <select value={courtsEarly} onChange={(e) => setCourtsEarly(e.target.value)} className="input">
              {COURT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c} คอร์ท
                </option>
              ))}
            </select>
          </Field>
          <Field label={`คอร์ทช่วง ${late}`}>
            <select value={courtsLate} onChange={(e) => setCourtsLate(e.target.value)} className="input">
              {COURT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c} คอร์ท
                </option>
              ))}
            </select>
          </Field>
        </div>
        {totalCapacity == null ? (
          <p className="text-xs text-amber-600 -mt-2">จำนวนคนที่รับต้องเป็นเลข 1–200</p>
        ) : (
          <p className="text-xs text-gray-500 -mt-2">
            รับรวม <span className="font-semibold text-brand-700">{totalCapacity} คน</span> — รอบ {early}{" "}
            {Math.min(earlyCapacity, totalCapacity)} คน / รอบ {late} เพิ่มอีก{" "}
            {Math.max(0, totalCapacity - earlyCapacity)} คน + สำรอง {WAITLIST_LIMIT} คน
          </p>
        )}
        <Field label="หมายเหตุคอร์ท (ไม่บังคับ)">
          <input
            placeholder={`เช่น ${early} 2 คอร์ท / ${late} 3 คอร์ท`}
            value={courtConfigNote}
            onChange={(e) => setCourtConfigNote(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="Remark (ไม่บังคับ)">
          <textarea
            value={remark}
            onChange={(e) => setRemark(e.target.value)}
            className="input"
            rows={2}
          />
        </Field>

        {error && <p className="ui-msg text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading || totalCapacity == null || !validStart}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
        >
          {loading ? "กำลังสร้าง..." : "สร้างรอบ"}
        </button>
      </form>
    </main>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="font-medium text-gray-700">{label}</span>
      {children}
    </label>
  );
}
