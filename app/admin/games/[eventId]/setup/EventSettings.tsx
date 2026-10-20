"use client";

import { useState } from "react";
import type { GamesState } from "@/lib/games/state";
import { adminApi } from "../../api";

/** Name, date, minutes per rubber, publish switch, timetable rebuild, manual rank order. */
export default function EventSettings({ state, onSaved }: { state: GamesState; onSaved: () => Promise<void> }) {
  const ev = state.event;
  const [name, setName] = useState(ev.name);
  const [date, setDate] = useState(ev.date);
  const [qMin, setQMin] = useState(String(ev.qualifierMinutes));
  const [kMin, setKMin] = useState(String(ev.knockoutMinutes));
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(p: Promise<{ ok: true } | { ok: false; error: string }>, okText: string) {
    const res = await p;
    setMsg(res.ok ? { ok: true, text: okText } : { ok: false, text: res.error });
    await onSaved();
  }

  const save = () =>
    run(
      adminApi(`/api/admin/games/${ev.id}`, "PATCH", {
        name,
        date,
        qualifierRubberMinutes: Number(qMin),
        knockoutRubberMinutes: Number(kMin),
      }),
      "บันทึกแล้ว"
    );

  // Teams level on every tiebreak — only then does a manual order matter.
  const rows = state.standings;
  const level = rows.filter((r, i) =>
    rows.some((o, j) => j !== i && o.points === r.points && o.won === r.won && o.h2h === r.h2h && o.diff === r.diff)
  );
  const teamName = (id: string) => state.teams.find((t) => t.id === id)?.name ?? "?";
  const move = (i: number, d: -1 | 1) => {
    const order = rows.map((r) => r.teamId);
    const j = i + d;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    void run(adminApi(`/api/admin/games/${ev.id}`, "PATCH", { rankOverride: order }), "สลับอันดับแล้ว");
  };

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          id="games-published"
          type="checkbox"
          className="h-5 w-5"
          checked={ev.published}
          onChange={(e) => run(adminApi(`/api/admin/games/${ev.id}`, "PATCH", { published: e.target.checked }), "อัปเดตแล้ว")}
        />
        {ev.published ? "เปิดให้ผู้เล่นดูแล้ว" : "ยังไม่เปิด · ผู้เล่นเห็น \"Coming soon\""}
      </label>
      <label className="flex flex-col gap-1 text-sm text-gray-600">
        ชื่องาน
        <input id="games-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <div className="grid grid-cols-3 gap-3">
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          วันที่
          <input id="games-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          รอบคัดเลือก (นาที)
          <input id="games-qmin" inputMode="numeric" className="input" value={qMin} onChange={(e) => setQMin(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          น็อกเอาต์ (นาที)
          <input id="games-kmin" inputMode="numeric" className="input" value={kMin} onChange={(e) => setKMin(e.target.value)} />
        </label>
      </div>
      <p className="text-xs text-gray-500">
        เวลามีไว้ดูเฉยๆ ไม่มีผลต่อผลแข่ง · รอบคัดเลือก 2 เซต (เสมอ 1–1 ได้) · รอบน็อกเอาต์ 2 ใน 3 เซต เซตละ 21 ดิวส์ไม่เกิน 30
      </p>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          บันทึก
        </button>
        <button
          type="button"
          onClick={() => run(adminApi(`/api/admin/games/${ev.id}/schedule`, "POST"), "สร้างตารางแข่งใหม่แล้ว")}
          className="rounded-md border border-brand-300 px-4 py-2 text-sm font-medium text-brand-700"
        >
          สร้างตารางแข่งใหม่ (ตามลำดับทีม)
        </button>
      </div>
      {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}

      {level.length > 0 && (
        <div className="flex flex-col gap-2 rounded-md bg-amber-50 p-3">
          <p className="text-sm font-medium text-amber-900">มีทีมที่เท่ากันทุกข้อ (คะแนน คู่ชนะ ผลเจอกัน ผลต่างแต้ม) · สลับอันดับเองได้</p>
          <ol className="flex flex-col gap-1">
            {rows.map((r, i) => (
              <li key={r.teamId} className="flex items-center gap-2 text-sm">
                <span className="w-5 text-gray-500">{r.rank}</span>
                <span className="flex-1">{teamName(r.teamId)}</span>
                <button type="button" aria-label={`เลื่อน ${teamName(r.teamId)} ขึ้น`} onClick={() => move(i, -1)} className="rounded border px-2">↑</button>
                <button type="button" aria-label={`เลื่อน ${teamName(r.teamId)} ลง`} onClick={() => move(i, 1)} className="rounded border px-2">↓</button>
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={() => run(adminApi(`/api/admin/games/${ev.id}`, "PATCH", { rankOverride: null }), "ล้างการสลับแล้ว")}
            className="self-start text-xs text-amber-900 underline"
          >
            ล้างการสลับเอง
          </button>
        </div>
      )}
    </section>
  );
}
