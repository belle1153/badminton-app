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
  preferredSlot: "EARLY" | "LATE";
  checkedInAt: string | null;
  checkedOutAt: string | null;
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
  // Optimistic check-in overlay so the button flips instantly (server catches up).
  const [optimistic, setOptimistic] = useState<Map<string, boolean>>(new Map());

  async function toggleOut(signUpId: string, checkedOut: boolean) {
    setPendingId(signUpId);
    try {
      await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedOut }),
      });
      router.refresh();
    } finally {
      setPendingId(null);
    }
  }

  async function toggle(signUpId: string, checkedIn: boolean) {
    setOptimistic((m) => new Map(m).set(signUpId, checkedIn));
    try {
      const res = await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checkedIn }),
      });
      if (!res.ok) {
        setOptimistic((m) => {
          const n = new Map(m);
          n.delete(signUpId);
          return n;
        });
      }
      router.refresh();
    } catch {
      setOptimistic((m) => {
        const n = new Map(m);
        n.delete(signUpId);
        return n;
      });
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

  const checkedInCount = signUps.filter((s) => optimistic.get(s.id) ?? s.checkedInAt != null).length;

  return (
    <section className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">เช็คอิน</h2>
        <span className="text-sm">
          มาแล้ว{" "}
          <span className="font-semibold text-brand-700">
            {checkedInCount}/{signUps.length}
          </span>{" "}
          คน
        </span>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => toggleAll(true)}
          disabled={bulkLoading || signUps.length === 0}
          className="text-xs text-brand-700 hover:underline disabled:opacity-50"
        >
          มาครบทุกคน
        </button>
        <span className="text-gray-300">·</span>
        <button
          onClick={() => toggleAll(false)}
          disabled={bulkLoading || signUps.length === 0}
          className="text-xs text-gray-400 hover:underline disabled:opacity-50"
        >
          ล้างทั้งหมด
        </button>
      </div>
      <p className="text-xs text-gray-400">
        กดปุ่มสถานะเพื่อสลับ &quot;ยังไม่มา / มาแล้ว&quot; · ปรับระดับมือได้จาก dropdown
      </p>
      {(["EARLY", "LATE"] as const).map((slot) => {
        const group = signUps.filter((s) => s.preferredSlot === slot);
        if (group.length === 0) return null;
        const isHere = (s: CheckInSignUp) => optimistic.get(s.id) ?? s.checkedInAt != null;
        // Not-arrived on top; arrived sink down; checked-out at the very bottom.
        const ordered = [...group].sort((a, b) => {
          const rank = (x: CheckInSignUp) => (x.checkedOutAt ? 2 : isHere(x) ? 1 : 0);
          return rank(a) - rank(b);
        });
        return (
          <div key={slot} className="flex flex-col gap-1">
            <h3 className="text-sm font-semibold text-gray-600">
              {slot === "EARLY" ? "🕖 รอบ 1 ทุ่ม" : "🕗 รอบ 2 ทุ่ม"}{" "}
              <span className="font-normal text-gray-400">
                ({group.filter(isHere).length}/{group.length} มาแล้ว)
              </span>
            </h3>
            <div className="flex flex-col divide-y divide-gray-100 border border-gray-100 rounded-md">
              {ordered.map((s) => {
          const here = optimistic.get(s.id) ?? s.checkedInAt != null;
          const busy = pendingId === s.id;
          return (
            <div key={s.id} className="flex items-center gap-2 text-sm px-2 py-2">
              {s.checkedOutAt ? (
                <button
                  onClick={() => toggleOut(s.id, false)}
                  disabled={busy}
                  className="shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border bg-gray-200 text-gray-600 border-gray-300 disabled:opacity-50"
                  title="กดเพื่อยกเลิกเช็คเอาท์"
                >
                  🏁 กลับแล้ว{" "}
                  {new Date(s.checkedOutAt).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })}
                </button>
              ) : (
                <button
                  onClick={() => toggle(s.id, !here)}
                  disabled={busy}
                  aria-pressed={here}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors disabled:opacity-50 ${
                    here
                      ? "bg-green-500 text-white border-green-500"
                      : "bg-white text-gray-400 border-gray-300"
                  }`}
                >
                  {here ? "✓ มาแล้ว" : "ยังไม่มา"}
                </button>
              )}
              {here && !s.checkedOutAt && (
                <button
                  onClick={() => toggleOut(s.id, true)}
                  disabled={busy}
                  className="shrink-0 text-[11px] text-gray-500 hover:underline disabled:opacity-50"
                >
                  เช็คเอาท์
                </button>
              )}
              <span className={`flex-1 min-w-0 truncate ${here ? "font-medium" : "text-gray-500"}`}>
                {s.name}
              </span>
              {s.status === "WAITLIST" && (
                <span className="text-xs rounded-full bg-gray-200 text-gray-600 px-1.5 py-0.5 shrink-0">
                  สำรอง
                </span>
              )}
              <select
                value={s.skillLevel}
                disabled={busy}
                onChange={(e) => setSkill(s.id, e.target.value)}
                className="text-xs border border-gray-200 rounded px-1 py-1 text-gray-600 shrink-0"
              >
                {SKILLS.map((k) => (
                  <option key={k} value={k}>
                    {SKILL_LABELS[k]}
                  </option>
                ))}
              </select>
              <button
                onClick={() => withdraw(s.id, s.name)}
                disabled={busy}
                className="text-xs text-red-500 hover:underline disabled:opacity-50 shrink-0"
              >
                ถอน
              </button>
            </div>
          );
              })}
            </div>
          </div>
        );
      })}
      {signUps.length === 0 && <p className="text-sm text-gray-400 p-3">ยังไม่มีคนลงชื่อ</p>}

    </section>
  );
}
