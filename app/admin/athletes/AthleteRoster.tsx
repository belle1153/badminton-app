"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface Athlete {
  id: string;
  name: string;
  skillLevel: SkillLevel;
}

export default function AthleteRoster({ athletes }: { athletes: Athlete[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  async function deleteAthlete(id: string, name: string) {
    if (!confirm(`ลบ "${name}" ออกจากรายชื่อขาประจำใช่ไหมครับ?`)) return;
    const res = await fetch(`/api/athletes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "ลบไม่สำเร็จ");
    router.refresh();
  }

  const filtered = athletes.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <input
        placeholder="ค้นหาชื่อ..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input"
      />
      <ul className="flex flex-col gap-1">
        {filtered.map((a) => (
          <li key={a.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1">
            <span>
              {a.name} — {SKILL_LABELS[a.skillLevel]}
            </span>
            <button onClick={() => deleteAthlete(a.id, a.name)} className="text-xs text-red-600 hover:underline">
              ลบ
            </button>
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-gray-400">ไม่พบข้อมูล</li>}
      </ul>
      <p className="text-xs text-gray-400">ทั้งหมด {athletes.length} คน</p>
    </div>
  );
}
