"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

const SKILLS = Object.keys(SKILL_LABELS) as SkillLevel[];

/**
 * Quick-add a walk-in player (name + admin-assessed skill) straight into the
 * session, checked in, so they drop into the waiting queue right away.
 */
export default function AddPlayerForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<SkillLevel>("RK");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), skillLevel: skill }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "เพิ่มไม่สำเร็จ", ok: false });
        return;
      }
      setMessage({
        text: data.alreadyExisted
          ? `"${name.trim()}" มีอยู่แล้ว — เช็คอินให้แล้ว`
          : `เพิ่ม "${name.trim()}" (${SKILL_LABELS[skill]}) เข้าคิวแล้ว`,
        ok: true,
      });
      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">เพิ่มผู้เล่นใหม่ (เข้าคิวเลย)</h2>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="ชื่อผู้เล่น"
          className="input flex-1"
          autoComplete="off"
        />
        <select
          value={skill}
          onChange={(e) => setSkill(e.target.value as SkillLevel)}
          className="input sm:w-28"
        >
          {SKILLS.map((k) => (
            <option key={k} value={k}>
              {SKILL_LABELS[k]}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={loading || !name.trim()}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "กำลังเพิ่ม..." : "เพิ่ม + เช็คอิน"}
        </button>
      </form>
      {message && (
        <p className={`text-sm ${message.ok ? "text-brand-700" : "text-amber-600"}`}>{message.text}</p>
      )}
    </section>
  );
}
