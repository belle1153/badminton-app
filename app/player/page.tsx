"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";
import { getMyPlayerId } from "@/lib/myPlayer";
import BackLink from "../BackLink";

interface Suggestion {
  id: string;
  name: string;
  skillLevel: SkillLevel;
}

/**
 * Find your own profile by name. There are no player accounts — identity is the
 * profile URL, and this page is how you get to yours the first time. Once you
 * mark a profile as "me" the home page links straight to it.
 */
export default function PlayerPickerPage() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setMyId(getMyPlayerId()), []);

  useEffect(() => {
    if (debounce.current) clearTimeout(debounce.current);
    const term = q.trim();
    if (!term) {
      setResults([]);
      setSearched(false);
      return;
    }
    setLoading(true);
    debounce.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/athletes?q=${encodeURIComponent(term)}`);
        setResults(res.ok ? await res.json() : []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
        setSearched(true);
      }
    }, 250);
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
    };
  }, [q]);

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-5">
      <BackLink href="/" label="หน้าแรก" exact />

      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">📊 สถิติผู้เล่น</h1>
        <p className="text-sm text-gray-500">พิมพ์ชื่อเพื่อดูสถิติ — ดูของตัวเองหรือของเพื่อนก็ได้</p>
      </div>

      {myId && (
        <Link
          href={`/player/${myId}`}
          className="rounded-lg border-2 border-brand-300 bg-brand-50/60 px-4 py-3 text-sm font-medium text-brand-800 hover:border-brand-400"
        >
          ⭐ ไปที่สถิติของฉัน
        </Link>
      )}

      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="พิมพ์ชื่อ (เช่น NW)"
        className="input"
        autoComplete="off"
      />

      {loading && <p className="text-sm text-gray-400">กำลังค้นหา…</p>}

      {!loading && searched && results.length === 0 && (
        <p className="text-sm text-gray-500">ไม่พบชื่อนี้ — ลองพิมพ์สั้นลง หรือเช็คตัวสะกดครับ</p>
      )}

      {results.length > 0 && (
        <ul className="flex flex-col divide-y divide-gray-100 border border-gray-200 rounded-lg overflow-hidden">
          {results.map((r) => (
            <li key={r.id}>
              <Link
                href={`/player/${r.id}`}
                className="flex items-center gap-2 px-4 py-3 text-sm hover:bg-gray-50"
              >
                <span className="font-medium">{r.name}</span>
                <span className="ml-auto text-xs text-gray-400">
                  มือ {SKILL_LABELS[r.skillLevel] ?? r.skillLevel}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
