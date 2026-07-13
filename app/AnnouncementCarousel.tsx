"use client";

import { useEffect, useState } from "react";

interface Item {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
}

/**
 * Announcement board shown to players: one card at a time, auto-rotating every
 * few seconds when there is more than one, with dots to jump manually.
 */
export default function AnnouncementCarousel({ items }: { items: Item[] }) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (items.length <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [items.length]);

  if (items.length === 0) return null;
  const a = items[Math.min(idx, items.length - 1)];

  return (
    <section className="rounded-lg border border-brand-200 bg-brand-50/60 p-3 flex flex-col gap-2">
      <p className="font-semibold text-brand-800">📣 {a.title}</p>
      {a.body && <p className="text-sm text-gray-700 whitespace-pre-wrap">{a.body}</p>}
      {a.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.imageUrl} alt={a.title} className="rounded-md w-full object-contain" />
      )}
      {items.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-1">
          {items.map((it, i) => (
            <button
              key={it.id}
              onClick={() => setIdx(i)}
              aria-label={`ประกาศที่ ${i + 1}`}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                i === idx ? "bg-brand-600" : "bg-gray-300 hover:bg-gray-400"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}
