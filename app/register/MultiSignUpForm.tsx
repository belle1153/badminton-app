"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";
import { addMySignup } from "@/lib/mySignups";

interface DayOption {
  id: string;
  label: string;
}

interface AthleteSuggestion {
  id: string;
  name: string;
  skillLevel: SkillLevel;
}

type Slot = "EARLY" | "LATE";

export default function MultiSignUpForm({ days }: { days: DayOption[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [athleteId, setAthleteId] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState(days[0]?.id ?? "");
  const [timeSlot, setTimeSlot] = useState<Slot>("EARLY");
  const [doneDays, setDoneDays] = useState<Set<string>>(new Set());
  const [suggestions, setSuggestions] = useState<AthleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
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

  async function signUp(confirmMove: boolean): Promise<{ text: string; ok: boolean } | null> {
    const day = days.find((d) => d.id === selectedDay);
    if (!day) return { text: "เลือกวันก่อนครับ", ok: false };
    const res = await fetch(`/api/sessions/${day.id}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId, name, timeSlot, confirmMove }),
    });
    const data = await res.json();
    if (res.status === 409 && data.alreadySignedUp && !confirmMove) {
      const label = timeSlot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม";
      if (confirm(`${day.label}: ${data.error}\nต้องการย้ายมารอบ ${label} ใช่ไหมครับ?`)) {
        return signUp(true);
      }
      return { text: `${day.label}: คงรอบเดิมไว้`, ok: true };
    }
    if (!res.ok) return { text: `${day.label}: ${data.error ?? "ลงชื่อไม่สำเร็จ"}`, ok: false };
    addMySignup(day.id, data.id);
    setDoneDays((prev) => new Set(prev).add(day.id));
    return {
      text: `${day.label}: ลงชื่อสำเร็จ${data.status === "WAITLIST" ? " (สำรอง)" : ""}`,
      ok: true,
    };
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setLoading(true);
    try {
      const result = await signUp(false);
      setMessage(result);
      if (result?.ok) {
        // Keep the name so signing up for the other day is one tap away;
        // auto-jump to a day not yet signed up, if any.
        const remaining = days.find((d) => d.id !== selectedDay && !doneDays.has(d.id));
        if (remaining) setSelectedDay(remaining.id);
        setSuggestions([]);
        router.refresh();
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 rounded-lg border border-gray-200 p-4">
      <div className="relative">
        <input
          required
          placeholder="ชื่อของคุณ (พิมพ์เพื่อค้นหา)"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setAthleteId(null);
            setShowSuggestions(true);
          }}
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
                  onMouseDown={() => {
                    setName(s.name);
                    setAthleteId(s.id);
                    setSuggestions([]);
                    setShowSuggestions(false);
                  }}
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

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">เลือกวัน</span>
        <div className="flex flex-wrap gap-2">
          {days.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setSelectedDay(d.id)}
              className={`rounded-md border px-3 py-2 text-sm font-medium ${
                selectedDay === d.id
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {doneDays.has(d.id) ? "✓ " : ""}
              {d.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium text-gray-700">เลือกเวลา</span>
        <div className="flex gap-2">
          {(["EARLY", "LATE"] as const).map((slot) => (
            <button
              key={slot}
              type="button"
              onClick={() => setTimeSlot(slot)}
              className={`rounded-md border px-4 py-2 text-sm font-medium ${
                timeSlot === slot
                  ? "bg-brand-600 text-white border-brand-600"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {slot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม"}
            </button>
          ))}
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
      >
        {loading ? "กำลังลง..." : "ลงชื่อ"}
      </button>

      {message && (
        <p className={`text-sm ${message.ok ? "text-brand-700" : "text-amber-600"}`}>{message.text}</p>
      )}
      {doneDays.size > 0 && days.some((d) => !doneDays.has(d.id)) && (
        <p className="text-xs text-gray-400">
          มาอีกวันด้วยใช่ไหมครับ? เลือกวันที่เหลือแล้วกด &quot;ลงชื่อ&quot; ได้เลย (ไม่ต้องพิมพ์ชื่อใหม่)
        </p>
      )}
    </form>
  );
}
