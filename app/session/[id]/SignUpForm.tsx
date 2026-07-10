"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

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

  async function submit(confirmMove: boolean) {
    const res = await fetch(`/api/sessions/${sessionId}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId, name, timeSlot, confirmMove }),
    });
    const data = await res.json();
    if (res.status === 409 && data.alreadySignedUp && !confirmMove) {
      const label = timeSlot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม";
      if (confirm(`${data.error}\nต้องการย้ายมารอบ ${label} ใช่ไหมครับ?`)) {
        return submit(true);
      }
      return null;
    }
    if (!res.ok) throw new Error(data.error ?? "ลงชื่อไม่สำเร็จ");
    return data;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await submit(false);
      if (data) {
        localStorage.setItem(`badminton_signup_${sessionId}`, data.id);
        setName("");
        setAthleteId(null);
        setSuggestions([]);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 items-stretch">
      <div className="relative flex-1">
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
                  className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between"
                >
                  <span>{s.name}</span>
                  <span className="text-xs text-gray-400">{SKILL_LABELS[s.skillLevel]}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex rounded-md border border-gray-300 overflow-hidden text-sm shrink-0">
        {(["EARLY", "LATE"] as const).map((slot) => (
          <button
            key={slot}
            type="button"
            onClick={() => setTimeSlot(slot)}
            className={`px-3 py-2 font-medium ${
              timeSlot === slot ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
            }`}
          >
            {slot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม"}
          </button>
        ))}
      </div>
      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
      >
        {loading ? "กำลังลง..." : "ลงชื่อ"}
      </button>
      {error && <p className="text-red-600 text-sm sm:ml-2 self-center">{error}</p>}
    </form>
  );
}
