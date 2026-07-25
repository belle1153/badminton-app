"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type SkillLevel } from "@/lib/matching";
import { addMySignup } from "@/lib/mySignups";
import Toast from "../Toast";
import IdentityConfirm, { type SimilarPlayer } from "../IdentityConfirm";

interface AthleteSuggestion {
  id: string;
  name: string;
  skillLevel: SkillLevel;
}

export default function SignUpForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [timeSlot, setTimeSlot] = useState<"EARLY" | "LATE">("EARLY");
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<AthleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  /** Existing players whose names look like what was typed; null = not asking. */
  const [similar, setSimilar] = useState<SimilarPlayer[] | null>(null);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const clearMessage = useCallback(() => setMessage(null), []);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!name.trim()) {
      setSuggestions([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const res = await fetch(`/api/athletes?q=${encodeURIComponent(name.trim())}`);
      if (res.ok) setSuggestions(await res.json());
    }, 250);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [name]);

  function handleNameChange(value: string) {
    setName(value);
    setAthleteId(null);
    setShowSuggestions(true);
  }

  function handleSelectSuggestion(s: AthleteSuggestion) {
    setName(s.name);
    setAthleteId(s.id);
    setSuggestions([]);
    setShowSuggestions(false);
  }

  async function submit(
    confirmMove: boolean,
    override?: { athleteId?: string; name?: string; confirmNewPlayer?: boolean }
  ) {
    const res = await fetch(`/api/sessions/${sessionId}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        athleteId: override?.athleteId ?? athleteId,
        name: override?.name ?? name,
        timeSlot,
        confirmMove,
        confirmNewPlayer: override?.confirmNewPlayer,
      }),
    });
    const data = await res.json();
    // A name close to an existing player's: ask who they are rather than
    // silently creating a second record and splitting their history.
    if (res.status === 409 && data.needsIdentityConfirm) {
      setSimilar(data.similarPlayers);
      return { kind: "askIdentity" as const };
    }
    if (res.status === 409 && data.alreadySignedUp && !confirmMove) {
      const label = timeSlot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม";
      if (confirm(`${data.error}\nต้องการย้ายมารอบ ${label} ใช่ไหมครับ?`)) {
        return submit(true, override);
      }
      return { kind: "keptSlot" as const };
    }
    if (!res.ok) throw new Error(data.error ?? "ลงชื่อไม่สำเร็จ");
    addMySignup(sessionId, data.id);
    return { kind: "signedUp" as const, data };
  }

  /** Re-submits once the player has said who they are. */
  async function resolveIdentity(override: {
    athleteId?: string;
    name?: string;
    confirmNewPlayer?: boolean;
  }) {
    setError(null);
    setLoading(true);
    setSimilar(null);
    try {
      const r = await submit(false, override);
      if (r.kind === "signedUp") {
        if (override.athleteId) setAthleteId(override.athleteId);
        setName("");
        setAthleteId(null);
        setSuggestions([]);
        setMessage({
          text: `ลงชื่อสำเร็จ${r.data.status === "WAITLIST" ? " (สำรอง)" : ""}`,
          ok: true,
        });
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSimilar(null);
    setLoading(true);
    try {
      const r = await submit(false);
      if (r.kind === "signedUp") {
        setName("");
        setAthleteId(null);
        setSuggestions([]);
        setMessage({
          text: `ลงชื่อสำเร็จ${r.data.status === "WAITLIST" ? " (สำรอง)" : ""}`,
          ok: true,
        });
        router.refresh();
      } else if (r.kind === "keptSlot") {
        setMessage({ text: "คงรอบเดิมไว้", ok: true });
      }
      // askIdentity → the confirm panel is showing; wait for the player.
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="relative">
        <input
          required
          placeholder="ชื่อของคุณ (พิมพ์เพื่อค้นหา)"
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={() => setShowSuggestions(true)}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
          className="input"
          autoComplete="off"
        />
        {showSuggestions && suggestions.length > 0 && (
          <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-sm mt-1 max-h-48 overflow-y-auto">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={() => handleSelectSuggestion(s)}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["EARLY", "LATE"] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setTimeSlot(slot)}
            className={`rounded-md border py-2.5 text-sm font-medium ${
              timeSlot === slot
                ? "bg-brand-600 text-white border-brand-600"
                : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {slot === "EARLY" ? "🕖 1 ทุ่ม" : "🕗 2 ทุ่ม"}
          </button>
        ))}
      </div>

      {similar && (
        <IdentityConfirm
          typedName={name}
          players={similar}
          busy={loading}
          onPick={(p) => resolveIdentity({ athleteId: p.id })}
          onCreateNew={() => resolveIdentity({ confirmNewPlayer: true })}
          onCancel={() => setSimilar(null)}
        />
      )}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700 disabled:opacity-50"
      >
        {loading ? "กำลังลง..." : "ลงชื่อ"}
      </button>
      {error && <p className="text-red-600 text-sm">{error}</p>}
      <Toast message={message} onDone={clearMessage} />
    </form>
  );
}
