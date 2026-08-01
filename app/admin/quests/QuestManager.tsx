"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUEST_KINDS, type QuestKind } from "@/lib/quests";

interface QuestRow {
  id: string;
  title: string;
  kind: string;
  icon: string;
  startDate: string;
  endDate: string;
  target: number | null;
  expReward: number;
  active: boolean;
}

const thaiRange = (start: string, end: string) => {
  const fmt = (s: string) =>
    new Date(s).toLocaleDateString("th-TH", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  // endDate is exclusive; show the last day people can actually play.
  const lastDay = new Date(new Date(end).getTime() - 24 * 60 * 60 * 1000).toISOString();
  return `${fmt(start)} – ${fmt(lastDay)}`;
};

export default function QuestManager({ initial }: { initial: QuestRow[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<QuestKind>("perfect-attendance");
  const [icon, setIcon] = useState("🎯");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [target, setTarget] = useState("");
  const [expReward, setExpReward] = useState("200");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const spec = QUEST_KINDS.find((k) => k.kind === kind)!;

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/admin/quests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, kind, icon, startDate, endDate, target, expReward }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "สร้างไม่สำเร็จ");
      setTitle("");
      setTarget("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setBusy(false);
    }
  }

  async function toggle(q: QuestRow) {
    await fetch(`/api/admin/quests/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !q.active }),
    });
    router.refresh();
  }

  async function remove(q: QuestRow) {
    if (!confirm(`ลบเควส "${q.title}" ใช่ไหมครับ?`)) return;
    await fetch(`/api/admin/quests/${q.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold">สร้างเควสใหม่</h2>

        <div className="flex gap-2">
          <input
            value={icon}
            onChange={(e) => setIcon(e.target.value)}
            className="input w-16 text-center text-lg"
            aria-label="ไอคอน"
          />
          <input
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="ชื่อเควส (เช่น เหรียญสิงหา)"
            className="input flex-1"
          />
        </div>

        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium text-gray-700">เงื่อนไข</span>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as QuestKind)}
            className="input"
          >
            {QUEST_KINDS.map((k) => (
              <option key={k.kind} value={k.kind}>
                {k.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-gray-500">{spec.hint}</span>
        </label>

        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">เริ่ม</span>
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="input"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">ถึง (ไม่รวมวันนี้)</span>
            <input
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="input"
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {spec.targetLabel && (
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-gray-700">{spec.targetLabel}</span>
              <input
                required
                type="number"
                min={1}
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="input"
              />
            </label>
          )}
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-gray-700">รางวัล EXP</span>
            <input
              required
              type="number"
              min={1}
              value={expReward}
              onChange={(e) => setExpReward(e.target.value)}
              className="input"
            />
            <span className="text-xs text-gray-500">มาเล่น 1 ครั้งได้ราว 236 EXP</span>
          </label>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy}
          className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "กำลังสร้าง…" : "+ สร้างเควส"}
        </button>
      </form>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">เควสทั้งหมด ({initial.length})</h2>
        {initial.length === 0 ? (
          <p className="text-sm text-gray-500">ยังไม่มีเควส — สร้างอันแรกด้านบนได้เลยครับ</p>
        ) : (
          <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
            {initial.map((q) => {
              const label = QUEST_KINDS.find((k) => k.kind === q.kind)?.label ?? q.kind;
              return (
                <li key={q.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="text-xl">{q.icon}</span>
                  {/* Only the name block links through — เปิด/ปิด and ลบ sit in
                      the same row and must stay their own hit areas. */}
                  <Link
                    href={`/admin/quests/${q.id}`}
                    className="group flex min-w-0 flex-col rounded hover:bg-gray-50"
                  >
                    <span className="font-medium group-hover:underline">
                      {q.title} <span className="text-gray-400">›</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {label}
                      {q.target != null && ` (${q.target})`} · {thaiRange(q.startDate, q.endDate)} ·
                      +{q.expReward} EXP
                    </span>
                  </Link>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => toggle(q)}
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        q.active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {q.active ? "เปิดอยู่" : "ปิดอยู่"}
                    </button>
                    <button
                      onClick={() => remove(q)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      ลบ
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

export type { QuestRow };
