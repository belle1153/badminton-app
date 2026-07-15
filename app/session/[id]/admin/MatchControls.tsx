"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

interface ConfirmedSignUp {
  id: string;
  name: string;
  skillLevel: string;
  fixedPartnerId: string | null;
  checkedIn: boolean;
}

export default function MatchControls({
  sessionId,
  status,
  confirmedSignUps,
  hasMatches,
}: {
  sessionId: string;
  status: "OPEN" | "CLOSED";
  confirmedSignUps: ConfirmedSignUp[];
  hasMatches: boolean;
}) {
  const router = useRouter();
  const isClosed = status === "CLOSED";

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"clearMatches" | "pair" | "unpair" | null>(null);
  const busyRef = useRef(false);

  const [partnerA, setPartnerA] = useState("");
  const [partnerB, setPartnerB] = useState("");

  const unpaired = confirmedSignUps.filter((s) => !s.fixedPartnerId);
  const pairs = useMemo(() => {
    const seen = new Set<string>();
    const result: [ConfirmedSignUp, ConfirmedSignUp][] = [];
    for (const s of confirmedSignUps) {
      if (!s.fixedPartnerId || seen.has(s.id)) continue;
      const partner = confirmedSignUps.find((p) => p.id === s.fixedPartnerId);
      if (!partner) continue;
      seen.add(s.id);
      seen.add(partner.id);
      result.push([s, partner]);
    }
    return result;
  }, [confirmedSignUps]);

  async function handleClearMatches() {
    if (busyRef.current) return;
    if (!confirm("ล้างแมทช์ทั้งหมดของวันนี้ใช่ไหมครับ? ทุกเกมที่บันทึกไว้จะหายไป")) return;
    busyRef.current = true;
    setError(null);
    setLoading("clearMatches");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/matches/clear`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "ล้างแมทช์ไม่สำเร็จ");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      busyRef.current = false;
      setLoading(null);
    }
  }

  async function handlePair(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading("pair");
    try {
      const res = await fetch(`/api/sessions/${sessionId}/pairs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signUpIdA: partnerA, signUpIdB: partnerB }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "จับคู่ไม่สำเร็จ");
      setPartnerA("");
      setPartnerB("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(null);
    }
  }

  async function handleUnpair(signUpId: string) {
    setError(null);
    setLoading("unpair");
    try {
      await fetch(`/api/sessions/${sessionId}/pairs/unpair`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signUpId }),
      });
      router.refresh();
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">คู่ซ้อมแข่ง (จับคู่ตายตัว)</h2>
        {pairs.length > 0 && (
          <ul className="flex flex-col gap-1">
            {pairs.map(([a, b]) => (
              <li key={a.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1">
                <span>
                  {a.name} + {b.name}
                </span>
                {!isClosed && (
                  <button
                    onClick={() => handleUnpair(a.id)}
                    disabled={loading === "unpair"}
                    className="text-xs text-red-600 hover:underline disabled:opacity-50"
                  >
                    ยกเลิก
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        {!isClosed && (
          <form onSubmit={handlePair} className="flex gap-2 items-center">
            <select value={partnerA} onChange={(e) => setPartnerA(e.target.value)} required className="input">
              <option value="">เลือกคนที่ 1</option>
              {unpaired.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]})
                </option>
              ))}
            </select>
            <select value={partnerB} onChange={(e) => setPartnerB(e.target.value)} required className="input">
              <option value="">เลือกคนที่ 2</option>
              {unpaired
                .filter((s) => s.id !== partnerA)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({SKILL_LABELS[s.skillLevel as SkillLevel]})
                  </option>
                ))}
            </select>
            <button
              type="submit"
              disabled={loading === "pair"}
              className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
            >
              จับคู่
            </button>
          </form>
        )}
      </section>

      {hasMatches && !isClosed && (
        <button
          onClick={handleClearMatches}
          disabled={loading === "clearMatches"}
          className="rounded-md border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 self-start"
        >
          {loading === "clearMatches" ? "กำลังล้าง..." : "ล้างแมทช์ทั้งหมด"}
        </button>
      )}
    </div>
  );
}
