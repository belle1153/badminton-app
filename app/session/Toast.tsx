"use client";

import { useEffect } from "react";

export interface ToastMessage {
  text: string;
  ok: boolean;
}

/**
 * Small pop-up that slides in at the top and auto-dismisses. Driven by a
 * `message` prop so a form can just set its result and get a toast for free.
 */
export default function Toast({
  message,
  onDone,
  duration = 3500,
}: {
  message: ToastMessage | null;
  onDone: () => void;
  duration?: number;
}) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, duration);
    return () => clearTimeout(t);
  }, [message, onDone, duration]);

  if (!message) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] max-w-[90vw]">
      <div
        role="status"
        onClick={onDone}
        className={`px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium text-center cursor-pointer border whitespace-pre-line ${
          message.ok
            ? "bg-green-100 text-green-800 border-green-300"
            : "bg-amber-600 text-white border-amber-600"
        }`}
      >
        {message.ok ? "✅ " : "⚠️ "}
        {message.text}
      </div>
    </div>
  );
}
