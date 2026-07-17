"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";

const SKILLS = Object.keys(SKILL_LABELS) as SkillLevel[];

type Slot = "EARLY" | "LATE";

interface AthleteSuggestion {
  id: string;
  name: string;
  skillLevel: SkillLevel;
}

/**
 * Quick-add a walk-in player straight into the session, checked in, so they drop
 * into the waiting queue right away. Typing searches the saved roster (ข้อมูลผู้เล่น)
 * — picking someone fills in their canonical spelling and their assessed skill,
 * which keeps "NW"/"nw" from becoming two athletes and saves re-grading them.
 * A name that matches nobody is still fine: it creates a new athlete.
 *
 * The 1 ทุ่ม / 2 ทุ่ม choice is what they get billed from (19:00 vs 20:00), so it
 * has to be here — `defaultSlot` is pre-picked from the clock (2 ทุ่ม once 20:00
 * has passed) because that's almost always right for a walk-in, but the admin
 * can flip it before adding.
 */
export default function AddPlayerForm({
  sessionId,
  defaultSlot,
}: {
  sessionId: string;
  defaultSlot: Slot;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [skill, setSkill] = useState<SkillLevel>("RK");
  const [slot, setSlot] = useState<Slot>(defaultSlot);
  const [suggestions, setSuggestions] = useState<AthleteSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [picked, setPicked] = useState<AthleteSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
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

  function selectAthlete(a: AthleteSuggestion) {
    setName(a.name);
    setSkill(a.skillLevel);
    setPicked(a);
    setShowSuggestions(false);
    setMessage(null);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/players`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), skillLevel: skill, timeSlot: slot }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ text: data.error ?? "เพิ่มไม่สำเร็จ", ok: false });
        return;
      }
      setMessage({
        text: data.alreadyExisted
          ? `"${name.trim()}" มีอยู่แล้ว — เช็คอินให้แล้ว (ใช้ช่วงเวลาเดิมที่เขาลงไว้)`
          : `เพิ่ม "${name.trim()}" (${SKILL_LABELS[skill]}) ${
              slot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม"
            } เข้าคิวแล้ว`,
        ok: true,
      });
      setName("");
      setPicked(null);
      setSuggestions([]);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-semibold">เพิ่มผู้เล่นใหม่ (เข้าคิวเลย)</h2>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative flex-1">
          <input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setPicked(null);
              setShowSuggestions(true);
            }}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
            placeholder="ชื่อผู้เล่น (พิมพ์เพื่อค้นหาคนที่มีอยู่)"
            className="input w-full"
            autoComplete="off"
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-sm mt-1 max-h-48 overflow-y-auto">
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={() => selectAthlete(s)}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 flex items-center justify-between gap-2"
                  >
                    <span>{s.name}</span>
                    <span className="text-xs text-gray-400">{SKILL_LABELS[s.skillLevel]}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked ? (
            <p className="text-xs text-brand-700 mt-1">
              ✓ คนเดิมในระบบ — ใช้มือที่บันทึกไว้ ({SKILL_LABELS[picked.skillLevel]}) แก้ได้ถ้าจะประเมินใหม่
            </p>
          ) : (
            name.trim() !== "" &&
            suggestions.length === 0 && <p className="text-xs text-gray-400 mt-1">คนใหม่ — จะเพิ่มเข้าระบบให้</p>
          )}
        </div>
        <div className="flex rounded-md border border-gray-300 overflow-hidden shrink-0">
          {(["EARLY", "LATE"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSlot(s)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap ${
                slot === s ? "bg-brand-600 text-white" : "bg-white text-gray-600 hover:bg-gray-50"
              }`}
            >
              {s === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม"}
            </button>
          ))}
        </div>
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
