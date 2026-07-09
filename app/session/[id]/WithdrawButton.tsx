"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function WithdrawButton({
  sessionId,
  signUpId,
}: {
  sessionId: string;
  signUpId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    try {
      await fetch(`/api/sessions/${sessionId}/signup/${signUpId}/withdraw`, {
        method: "POST",
      });
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
