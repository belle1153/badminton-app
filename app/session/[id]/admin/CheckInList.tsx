"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

const SKILLS = Object.keys(SKILL_LABELS) as SkillLevel[];

interface CheckInSignUp {
  id: string;
  name: string;
  skillLevel: string;
  status: "CONFIRMED" | "WAITLIST";
  checkedInAt: string | null;
}

export default function CheckInList({
  sessionId,
  signUps,
}: {
  sessionId: string;
  signUps: CheckInSignUp[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [bulkLoading, setBulkLoading] = useState(false);

  async function toggle(signUpId: string, checkedIn: boolean) {
    setPendingId(signUpId);
    try {
      await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function toggleAll(checkedIn: boolean) {
    setBulkLoading(true);
    try {
      await Promise.all(
        signUps.map((s) =>
          fetch(`/api/sessions/${sessionId}/signup/${s.id}/checkin`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ checkedIn }),
          })
        )
      );
      router.refresh();
    } finally {
      setBulkLoading(false);
    }
  }

  async function setSkill(signUpId: string, skillLevel: string) {
    setPendingId(signUpId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/skill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skillLevel }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "บันทึกระดับไม่สำเร็จ");
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function withdraw(signUpId: string, name: string) {
    if (!confirm(`ถอนชื่อ "${name}" ออกจากรอบนี้ใช่ไหมครับ?`)) return;
    setPendingId(signUpId);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "ถอนชื่อไม่สำเร็จ");
      }
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  const checkedInCount = signUps.filter((s) => s.checkedInAt).length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">
          เช็คอิน ({checkedInCount}/{signUps.length})
        </h2>
        <div className="flex gap-2">
          <button
            onClick={() => toggleAll(true)}
            disabled={bulkLoading || signUps.length === 0}
            className="text-xs text-brand-700 hover:underline disabled:opacity-50"
          >
            เลือกทั้งหมด
          </button>
          <button
            onClick={() => toggleAll(false)}
            disabled={bulkLoading || signUps.length === 0}
            className="text-xs text-gray-400 hover:underline disabled:opacity-50"
          >
            ไม่เลือกเลย
          </button>
        </div>
      </div>
      <p className="text-xs text-gray-400">แอดมินประเมินระดับมือของแต่ละคนได้จาก dropdown ท้ายชื่อ</p>
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border border-gray-100 rounded-md p-2">
        {signUps.map((s) => (
          <div key={s.id} className="flex items-center gap-2 text-sm py-0.5">
            <label className="flex items-center gap-2 flex-1 min-w-0">
              <input
                type="checkbox"
                checked={s.checkedInAt != null}
                disabled={pendingId === s.id}
                onChange={(e) => toggle(s.id, e.target.checked)}
              />
              <span className="truncate">{s.name}</span>
              {s.status === "WAITLIST" && (
                <span className="text-xs rounded-full bg-gray-200 text-gray-600 px-1.5 py-0.5 shrink-0">
                  สำรอง
                </span>
              )}
            </label>
            <select
              value={s.skillLevel}
              disabled={pendingId === s.id}
              onChange={(e) => setSkill(s.id, e.target.value)}
              className="text-xs border border-gray-200 rounded px-1 py-0.5 text-gray-600 shrink-0"
            >
              {SKILLS.map((k) => (
                <option key={k} value={k}>
                  {SKILL_LABELS[k]}
                </option>
              ))}
            </select>
            <button
              onClick={() => withdraw(s.id, s.name)}
              disabled={pendingId === s.id}
              className="text-xs text-red-600 hover:underline disabled:opacity-50 shrink-0"
            >
              ถอน
            </button>
          </div>
        ))}
        {signUps.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีคนลงชื่อ</p>}
      </div>
    </section>
  );
}
