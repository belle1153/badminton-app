"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

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
      <div className="flex flex-col gap-1 max-h-64 overflow-y-auto border border-gray-100 rounded-md p-2">
        {signUps.map((s) => (
          <label key={s.id} className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={s.checkedInAt != null}
              disabled={pendingId === s.id}
              onChange={(e) => toggle(s.id, e.target.checked)}
            />
            {s.name}
            <span className="text-xs text-gray-400">{SKILL_LABELS[s.skillLevel as SkillLevel]}</span>
            {s.status === "WAITLIST" && (
              <span className="text-xs rounded-full bg-gray-200 text-gray-600 px-1.5 py-0.5">สำรอง</span>
            )}
          </label>
        ))}
        {signUps.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีคนลงชื่อ</p>}
      </div>
    </section>
  );
}
