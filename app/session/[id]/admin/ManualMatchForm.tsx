"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Player {
  id: string;
  name: string;
}

/**
 * Place a match on a chosen court by hand: pick a court and four checked-in
 * players (two per team). The API works out the round — starting round 1 if
 * none exists, adding to the latest round if the court is free there, or
 * opening a new round if that court is taken.
 */
export default function ManualMatchForm({
  sessionId,
  players,
  sessionCourts,
}: {
  sessionId: string;
  players: Player[];
  sessionCourts: number;
}) {
  const router = useRouter();
  const courtOptions = Array.from({ length: sessionCourts }, (_, i) => i + 1);
  const [court, setCourt] = useState("1");
  const [picks, setPicks] = useState<string[]>(["", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  const chosen = new Set(picks.filter(Boolean));
  const ready = picks.every(Boolean) && chosen.size === 4;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          court: Number(court),
          team1: [picks[0], picks[1]],
          team2: [picks[2], picks[3]],
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "จัดลงสนามไม่สำเร็จ", ok: false });
        return;
      }
      setMessage({ text: `จัดลงสนาม ${data.court} (รอบที่ ${data.round}) แล้ว`, ok: true });
      setPicks(["", "", "", ""]);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  function playerSelect(i: number, label: string) {
    return (
      <label className="flex flex-col gap-1 text-xs text-gray-600">
        {label}
        <select
          value={picks[i]}
          onChange={(e) => {
            const next = [...picks];
            next[i] = e.target.value;
            setPicks(next);
          }}
          className="input py-1.5 text-sm"
        >
          <option value="">เลือกผู้เล่น...</option>
          {players
            .filter((p) => p.id === picks[i] || !picks.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
        </select>
      </label>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">จัดลงสนามเอง</h2>
      {players.length < 4 ? (
        <p className="text-sm text-gray-400">ต้องมีคนเช็คอินอย่างน้อย 4 คนก่อนครับ</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-600">สนาม</span>
            <div className="flex flex-wrap gap-1.5">
              {courtOptions.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCourt(String(c))}
                  className={`rounded-md border w-9 h-9 text-sm font-medium ${
                    court === String(c)
                      ? "bg-brand-600 text-white border-brand-600"
                      : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-2">
              <span className="text-xs font-medium text-gray-500">ทีมซ้าย</span>
              {playerSelect(0, "คนที่ 1")}
              {playerSelect(1, "คนที่ 2")}
            </div>
            <div className="flex flex-col gap-2 rounded-md border border-gray-200 p-2">
              <span className="text-xs font-medium text-gray-500">ทีมขวา</span>
              {playerSelect(2, "คนที่ 1")}
              {playerSelect(3, "คนที่ 2")}
            </div>
          </div>
          <button
            type="submit"
            disabled={!ready || loading}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
          >
            {loading ? "กำลังจัด..." : "จัดลงสนาม"}
          </button>
          {message && (
            <p className={`text-sm ${message.ok ? "text-brand-700" : "text-amber-600"}`}>{message.text}</p>
          )}
        </form>
      )}
    </section>
  );
}
