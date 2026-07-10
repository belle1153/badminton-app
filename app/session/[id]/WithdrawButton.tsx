"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Self-service withdrawal: only shown next to the sign-up made from this
 * device (there are no user accounts), and only until the noon deadline —
 * after that the admin withdraws people from the admin page.
 */
export default function WithdrawButton({
  sessionId,
  signUpId,
  deadlinePassed,
}: {
  sessionId: string;
  signUpId: string;
  deadlinePassed: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isSelf, setIsSelf] = useState(false);

  useEffect(() => {
    setIsSelf(localStorage.getItem(`badminton_signup_${sessionId}`) === signUpId);
  }, [sessionId, signUpId]);

  if (!isSelf || deadlinePassed) return null;

  async function handleClick() {
    if (!confirm("ถอนชื่อออกจากรอบนี้ใช่ไหมครับ?")) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/withdraw`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "ถอนชื่อไม่สำเร็จ");
        return;
      }
      localStorage.removeItem(`badminton_signup_${sessionId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-red-600 hover:underline disabled:opacity-50"
    >
      ถอนชื่อ
    </button>
  );
}
