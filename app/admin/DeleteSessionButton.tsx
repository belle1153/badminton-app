"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteSessionButton({ sessionId, venue }: { sessionId: string; venue: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleDelete(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`ลบรอบเล่น "${venue}" ทิ้งถาวรใช่ไหมครับ? ข้อมูลรายชื่อและผลจับคู่ทั้งหมดจะหายไปด้วย`)) return;
    setLoading(true);
    const res = await fetch(`/api/sessions/${sessionId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      alert(data.error ?? "ลบไม่สำเร็จ");
      setLoading(false);
      return;
    }
    router.refresh();
  }

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      {loading ? "กำลังลบ..." : "ลบ"}
    </button>
  );
}
