"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function NewSessionForm() {
  const router = useRouter();
  const [date, setDate] = useState("");
  const [venue, setVenue] = useState("");
  const [startTime, setStartTime] = useState("19:00");
  const [maxPlayers, setMaxPlayers] = useState(22);
  const [courtConfigNote, setCourtConfigNote] = useState("");
  const [remark, setRemark] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date, venue, startTime, maxPlayers, courtConfigNote, remark }),
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
        <Field label="เวลาเริ่ม">
          <input
            required
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            className="input"
          />
        </Field>
        <Field label="จำนวนคนสูงสุด">
          <input
            type="number"
            min={1}
            required
            value={maxPlayers}
            onChange={(e) => setMaxPlayers(Number(e.target.value))}
            className="input"
          />
        </Field>
        <Field label="หมายเหตุคอร์ท (ไม่บังคับ)">
          <input
            placeholder="เช่น 1 ทุ่ม 2 คอร์ท / 2 ทุ่ม 3 คอร์ท"
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

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={loading}
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
