"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getMySignups, removeMySignup } from "@/lib/mySignups";

interface ActiveSignUp {
  id: string;
  name: string;
}

/**
 * Self-withdrawal without a per-row button: pick or type your own name.
 * Only names signed up from THIS device (localStorage) can be withdrawn, so
 * others can't remove your name from their own phone even though the list is
 * public — which is also why the type-ahead only ever offers YOUR names, never
 * the whole day's list. After the noon deadline this form is hidden and the
 * admin handles it.
 */
export default function WithdrawForm({
  sessionId,
  signUps,
  deadlinePassed,
}: {
  sessionId: string;
  signUps: ActiveSignUp[];
  deadlinePassed: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // localStorage is client-only, so read it after mount.
  const [myIds, setMyIds] = useState<Set<string> | null>(null);

  useEffect(() => {
    setMyIds(new Set(getMySignups(sessionId)));
  }, [sessionId]);

  const myNames = myIds ? signUps.filter((s) => myIds.has(s.id)) : [];
  const query = name.trim().toLowerCase();
  const suggestions = query
    ? myNames.filter((s) => s.name.toLowerCase().includes(query))
    : myNames;
  const nothingToWithdraw = myIds != null && myNames.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const typed = name.trim();
    if (!typed) return;

    if (deadlinePassed) {
      setMessage({
        text: "เลยเวลาถอนชื่อด้วยตัวเอง (12.00 น. ของวันตี) แล้ว — ถอนเองไม่ได้ ติดต่อแอดมินครับ",
        ok: false,
      });
      return;
    }

    const mine = new Set(getMySignups(sessionId));
    const match = signUps.find(
      (s) => s.name.toLowerCase() === typed.toLowerCase() && mine.has(s.id)
    );
    if (!match) {
      setMessage({
        text: "ไม่พบชื่อนี้ในรายชื่อที่ลงจากเครื่องนี้ — ถ้าลงชื่อจากเครื่องอื่นหรือผ่าน LINE ให้ถอนจากที่เดิม หรือแจ้งแอดมินครับ",
        ok: false,
      });
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/signup/${match.id}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setMessage({ text: data.error ?? "ถอนชื่อไม่สำเร็จ", ok: false });
        return;
      }
      removeMySignup(sessionId, match.id);
      // Drop it from the picker too, or the name you just withdrew keeps showing.
      setMyIds((prev) => {
        const next = new Set(prev);
        next.delete(match.id);
        return next;
      });
      setMessage({ text: `ถอนชื่อ "${typed}" เรียบร้อยแล้วครับ`, ok: true });
      setName("");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-lg border border-gray-200 p-4 flex flex-col gap-2">
      <h2 className="font-semibold text-sm">ถอนชื่อ</h2>
      {/* The withdraw rules live here, per day — and they cost money, so they get
          a red frame rather than a note the eye slides past. */}
      {deadlinePassed ? (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 flex flex-col gap-1.5">
          <p className="font-bold">⚠️ เลยเวลาถอนชื่อเองแล้ว</p>
          <p>• ถอนชื่อเองได้ถึง <strong>12.00 น. ของวันที่ตี</strong> เท่านั้น</p>
          <p>
            • ถอนหลัง 12.00 น. <strong>ขออนุญาตหารค่าคอร์ท 100 บาท</strong> (ยกเว้นหาคนมาแทนได้) —
            ติดต่อแอดมินเพื่อกด accept การถอนชื่อครับ
          </p>
        </div>
      ) : (
        <div className="rounded-lg border-2 border-red-400 bg-red-50 p-3 text-sm text-red-900 flex flex-col gap-1.5">
          <p className="font-bold">📌 กติกาการถอนชื่อ</p>
          <p>• ถอนชื่อเองได้ถึง <strong>12.00 น. ของวันที่ตี</strong> เท่านั้น</p>
          <p>
            • ถอนหลัง 12.00 น. <strong>ขออนุญาตหารค่าคอร์ท 100 บาท</strong> (ยกเว้นหาคนมาแทนได้) —
            ติดต่อแอดมินเพื่อกด accept การถอนชื่อครับ
          </p>
          <p className="text-xs text-red-800/80">
            พิมพ์ชื่อให้ตรงกับในรายชื่อ แล้วกด &quot;ถอนชื่อ&quot; — ถอนได้เฉพาะชื่อที่ลงจากเครื่องนี้
          </p>
        </div>
      )}
      {/* No names signed up from this browser → nothing to withdraw here.
          Storage can still silently fail to record a real signup even after
          the addMySignup fix (browser blocks the write without throwing) —
          leaving this fully blank reads as broken with no way forward, so a
          one-liner points to the admin instead. */}
      {nothingToWithdraw ? (
        <p className="text-xs text-gray-500">
          ไม่พบชื่อที่ลงจากเครื่องนี้ — แจ้งแอดมินถอนให้ได้เลยครับ
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <input
              placeholder={myNames.length > 1 ? "แตะเพื่อเลือกชื่อ / พิมพ์ค้นหา" : "แตะเพื่อเลือกชื่อของคุณ"}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
              className="input w-full"
              autoComplete="off"
              disabled={deadlinePassed}
            />
            {/* Only ever YOUR names from this device — never the day's full list. */}
            {showSuggestions && !deadlinePassed && suggestions.length > 0 && (
              <ul className="absolute z-10 top-full left-0 right-0 bg-white border border-gray-200 rounded-md shadow-sm mt-1 max-h-48 overflow-y-auto">
                {suggestions.map((s) => (
                  <li key={s.id}>
                    <button
                      type="button"
                      onMouseDown={() => {
                        setName(s.name);
                        setShowSuggestions(false);
                      }}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50"
                    >
                      {s.name}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <button
            type="submit"
            disabled={loading || deadlinePassed || !name.trim()}
            className="rounded-md border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
          >
            {loading ? "กำลังถอน..." : "ถอนชื่อ"}
          </button>
        </form>
      )}
      {message && (
        <p className={`text-sm ${message.ok ? "text-brand-700" : "text-amber-600"}`}>{message.text}</p>
      )}
    </section>
  );
}
