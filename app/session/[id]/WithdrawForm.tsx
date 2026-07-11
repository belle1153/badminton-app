"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getMySignups, removeMySignup } from "@/lib/mySignups";

interface ActiveSignUp {
  id: string;
  name: string;
}

/**
 * Self-withdrawal without a per-row button: type your own name and submit.
 * Only names signed up from THIS device (localStorage) can be withdrawn, so
 * others can't remove your name from their own phone even though the list is
 * public. After the noon deadline this form is hidden and the admin handles it.
 */
export default function WithdrawForm({
  sessionId,
  signUps,
}: {
  sessionId: string;
  signUps: ActiveSignUp[];
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    const typed = name.trim();
    if (!typed) return;

    const mine = new Set(getMySignups(sessionId));
    const match = signUps.find((s) => s.name === typed && mine.has(s.id));
    if (!match) {
      setMessage({
        text: "ไม่พบชื่อนี้ในรายชื่อที่ลงจากเครื่องนี้ — ถอนได้เฉพาะชื่อที่คุณลงเองจากเครื่องนี้ครับ",
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
      <p className="text-xs text-gray-400">
        พิมพ์ชื่อของคุณให้ตรงกับในรายชื่อ แล้วกด &quot;ถอนชื่อ&quot; — ถอนได้เฉพาะชื่อที่ลงจากเครื่องนี้
      </p>
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          placeholder="พิมพ์ชื่อของคุณ"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="input flex-1"
          autoComplete="off"
        />
        <button
          type="submit"
          disabled={loading}
          className="rounded-md border border-red-300 text-red-600 px-4 py-2 text-sm font-medium hover:bg-red-50 disabled:opacity-50 whitespace-nowrap"
        >
          {loading ? "กำลังถอน..." : "ถอนชื่อ"}
        </button>
      </form>
      {message && (
        <p className={`text-sm ${message.ok ? "text-brand-700" : "text-amber-600"}`}>{message.text}</p>
      )}
    </section>
  );
}
