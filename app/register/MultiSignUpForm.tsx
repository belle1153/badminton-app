"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

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
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [slots, setSlots] = useState<Record<string, Slot>>({});
  const [suggestions, setSuggestions] = useState<AthleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);
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

  async function signUpDay(day: DayOption, slot: Slot, confirmMove: boolean): Promise<string> {
    const res = await fetch(`/api/sessions/${day.id}/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ athleteId, name, timeSlot: slot, confirmMove }),
    });
    const data = await res.json();
    if (res.status === 409 && data.alreadySignedUp && !confirmMove) {
      const label = slot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม";
      if (confirm(`${day.label}: ${data.error}\nต้องการย้ายมารอบ ${label} ใช่ไหมครับ?`)) {
        return signUpDay(day, slot, true);
      }
      return `${day.label}: คงรอบเดิมไว้`;
    }
    if (!res.ok) return `${day.label}: ${data.error ?? "ลงชื่อไม่สำเร็จ"}`;
    localStorage.setItem(`badminton_signup_${day.id}`, data.id);
    return `${day.label}: ลงชื่อสำเร็จ${data.status === "WAITLIST" ? " (สำรอง)" : ""}`;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const chosen = days.filter((d) => checked[d.id]);
    if (chosen.length === 0) {
      setMessages(["เลือกอย่างน้อย 1 วันครับ"]);
      return;
    }
    setMessages([]);
    setLoading(true);
    try {
      const results: string[] = [];
      for (const day of chosen) {
        results.push(await signUpDay(day, slots[day.id] ?? "EARLY", false));
      }
      setMessages(results);
      setName("");
      setAthleteId(null);
      setSuggestions([]);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
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

      {days.map((d) => (
        <div key={d.id} className="flex items-center justify-between gap-2 text-sm">
          <label className="flex items-center gap-2 flex-1 min-w-0">
            <input
              type="checkbox"
              checked={checked[d.id] ?? false}
              onChange={(e) => setChecked({ ...checked, [d.id]: e.target.checked })}
            />
            <span className="truncate">{d.label}</span>
          </label>
          <div
            className={`flex rounded-md border border-gray-300 overflow-hidden text-xs shrink-0 ${
              checked[d.id] ? "" : "opacity-40 pointer-events-none"
            }`}
          >
            {(["EARLY", "LATE"] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setSlots({ ...slots, [d.id]: slot })}
                className={`px-2.5 py-1.5 font-medium ${
                  (slots[d.id] ?? "EARLY") === slot
                    ? "bg-brand-600 text-white"
                    : "bg-white text-gray-600 hover:bg-gray-50"
                }`}
              >
                {slot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม"}
              </button>
            ))}
          </div>
        </div>
      ))}

      <button
        type="submit"
        disabled={loading}
        className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
      >
        {loading ? "กำลังลง..." : "ลงชื่อ"}
      </button>

      {messages.length > 0 && (
        <ul className="text-sm flex flex-col gap-0.5">
          {messages.map((m, i) => (
            <li key={i} className={m.includes("สำเร็จ") ? "text-brand-700" : "text-amber-600"}>
              {m}
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
