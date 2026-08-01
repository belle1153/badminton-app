"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { QUEST_KINDS, isPerDayKind, overlappingQuests, type QuestKind } from "@/lib/quests";

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
  /** Which quest the form is editing, or null when it is creating a new one. */
  const [editingId, setEditingId] = useState<string | null>(null);

  const spec = QUEST_KINDS.find((k) => k.kind === kind)!;

  // Switching a quest off hides it but does NOT stop it paying, so "turn the old
  // one off and make a replacement" quietly pays both. Warn while the dates are
  // being typed, when it is still cheap to press แก้ไข on the old one instead.
  const clashes =
    startDate && endDate
      ? overlappingQuests(
          initial.map((q) => ({ ...q, startDate: new Date(q.startDate), endDate: new Date(q.endDate) })),
          new Date(startDate),
          new Date(endDate),
          editingId ?? undefined
        ).filter((q) => !q.active)
      : [];

  function reset() {
    setEditingId(null);
    setTitle("");
    setKind("perfect-attendance");
    setIcon("🎯");
    setStartDate("");
    setEndDate("");
    setTarget("");
    setExpReward("200");
    setError(null);
  }

  function startEdit(q: QuestRow) {
    setEditingId(q.id);
    setTitle(q.title);
    setKind(q.kind as QuestKind);
    setIcon(q.icon);
    // <input type="date"> wants yyyy-mm-dd; the dates are UTC midnight already.
    setStartDate(q.startDate.slice(0, 10));
    setEndDate(q.endDate.slice(0, 10));
    setTarget(q.target == null ? "" : String(q.target));
    setExpReward(String(q.expReward));
    setError(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(
        editingId ? `/api/admin/quests/${editingId}` : "/api/admin/quests",
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, kind, icon, startDate, endDate, target, expReward }),
        }
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? (editingId ? "แก้ไขไม่สำเร็จ" : "สร้างไม่สำเร็จ"));
      reset();
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
    // Delete is the only action that takes EXP back — ปิด just hides. Say so,
    // because the two buttons sit next to each other.
    if (
      !confirm(
        `ลบเควส "${q.title}" ใช่ไหมครับ?\n\n` +
          `+${q.expReward} EXP ของทุกคนที่ทำสำเร็จจะหายไปด้วย และเลเวลอาจตกลง\n` +
          `ถ้าแค่อยากซ่อนจากหน้าผู้เล่น ให้กด "ปิด" แทน`
      )
    )
      return;
    await fetch(`/api/admin/quests/${q.id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form
        onSubmit={submit}
        className={`flex flex-col gap-3 rounded-lg border p-4 ${
          editingId ? "border-brand-400 bg-brand-50" : "border-gray-200"
        }`}
      >
        <h2 className="font-semibold">{editingId ? "แก้ไขเควส" : "สร้างเควสใหม่"}</h2>
        {editingId && (
          <p className="rounded-md bg-white px-3 py-2 text-xs text-gray-600">
            เปลี่ยนเงื่อนไขหรือ EXP ได้เลย — ระบบคิดผู้ผ่านและ EXP ใหม่ให้ทันที
            ไม่มีใครเสีย EXP ที่ได้ไปแล้ว
          </p>
        )}

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
            <span className="font-medium text-gray-700">
              รางวัล EXP{spec.perDay && " (ต่อ 1 วัน)"}
            </span>
            <input
              required
              type="number"
              min={1}
              value={expReward}
              onChange={(e) => setExpReward(e.target.value)}
              className="input"
            />
            <span className="text-xs text-gray-500">
              {spec.perDay
                ? "ได้ทุกวันที่ทำสำเร็จ เช่น ติดอันดับ 8 วัน = คูณ 8"
                : "มาเล่น 1 ครั้งได้ราว 236 EXP"}
            </span>
          </label>
        </div>

        {clashes.length > 0 && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-semibold">
              ⚠️ ช่วงเวลานี้ทับกับเควสที่ปิดอยู่ {clashes.length} อัน
            </p>
            <ul className="mt-1 list-disc pl-4">
              {clashes.map((q) => (
                <li key={q.id}>
                  {q.icon} {q.title}
                </li>
              ))}
            </ul>
            <p className="mt-1.5">
              เควสที่ปิดยัง<b>จ่าย EXP อยู่</b> (ปิด = ซ่อนจากหน้าผู้เล่นเท่านั้น)
              ถ้าตั้งใจจะเปลี่ยนเควสเดิม ให้กด <b>แก้ไข</b> อันนั้นแทน —
              สร้างใหม่ทับจะได้ EXP สองก้อน
            </p>
          </div>
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy
              ? editingId
                ? "กำลังบันทึก…"
                : "กำลังสร้าง…"
              : editingId
                ? "บันทึกการแก้ไข"
                : "+ สร้างเควส"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={reset}
              className="rounded-md px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
            >
              ยกเลิก
            </button>
          )}
        </div>
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
                      +{q.expReward} EXP{isPerDayKind(q.kind) && " ต่อวัน"}
                    </span>
                  </Link>
                  <div className="ml-auto flex items-center gap-2">
                    <button
                      onClick={() => startEdit(q)}
                      className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100"
                    >
                      แก้ไข
                    </button>
                    <button
                      onClick={() => toggle(q)}
                      // "ปิดอยู่" reads as retired, but EXP keeps being paid —
                      // say so here, where the admin decides.
                      title={
                        q.active
                          ? "กดเพื่อซ่อนจากหน้าผู้เล่น (EXP ที่แจกไปแล้วไม่หาย)"
                          : "ซ่อนอยู่ แต่ยังจ่าย EXP — ถ้าจะยกเลิกจริงต้องกดลบ"
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium ${
                        q.active ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {q.active ? "เปิดอยู่" : "ซ่อนอยู่ · ยังจ่าย EXP"}
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
