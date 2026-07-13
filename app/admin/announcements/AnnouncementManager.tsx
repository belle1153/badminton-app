"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Announcement {
  id: string;
  title: string;
  body: string;
  imageUrl: string | null;
  active: boolean;
}

// Downscale to max 1000px wide as JPEG so a poster image stays a sane size.
async function resizeWide(file: File, max = 1000): Promise<string> {
  const dataUrl = await new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result as string);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = rej;
    i.src = dataUrl;
  });
  const scale = Math.min(1, max / img.width);
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  c.getContext("2d")!.drawImage(img, 0, 0, w, h);
  return c.toDataURL("image/jpeg", 0.7);
}

export default function AnnouncementManager({ announcements }: { announcements: Announcement[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pickImage(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      setImage(await resizeWide(file));
    } catch {
      setError("อ่านรูปไม่สำเร็จ");
    }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/announcements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim(), body, imageUrl: image }),
      });
      if (!res.ok) {
        setError((await res.json()).error ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      setTitle("");
      setBody("");
      setImage(null);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  async function patch(id: string, data: object) {
    await fetch(`/api/announcements/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    router.refresh();
  }

  async function remove(id: string, title: string) {
    if (!confirm(`ลบประกาศ "${title}" ?`)) return;
    await fetch(`/api/announcements/${id}`, { method: "DELETE" });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={create} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
        <span className="text-sm font-semibold">เพิ่มประกาศใหม่</span>
        <input
          placeholder="หัวข้อ"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="input"
        />
        <textarea
          placeholder="รายละเอียด (ไม่บังคับ)"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          className="input"
        />
        <label className="text-sm text-brand-700 cursor-pointer">
          <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0])} />
          {image ? "เปลี่ยนรูป" : "+ แนบรูป (ไม่บังคับ)"}
        </label>
        {image && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt="preview" className="rounded-md max-h-40 object-contain self-start" />
        )}
        <button
          type="submit"
          disabled={busy || !title.trim()}
          className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 self-start"
        >
          {busy ? "กำลังเพิ่ม..." : "เพิ่มประกาศ"}
        </button>
      </form>

      <div className="flex flex-col gap-3">
        {announcements.length === 0 && <p className="text-sm text-gray-400">ยังไม่มีประกาศ</p>}
        {announcements.map((a) => (
          <div key={a.id} className={`rounded-lg border p-3 flex flex-col gap-2 ${a.active ? "border-gray-200" : "border-gray-200 bg-gray-50 opacity-70"}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="font-semibold">{a.title}</span>
              <div className="flex gap-2 shrink-0 text-xs">
                <button onClick={() => patch(a.id, { active: !a.active })} className="text-brand-700 hover:underline">
                  {a.active ? "ซ่อน" : "แสดง"}
                </button>
                <button onClick={() => remove(a.id, a.title)} className="text-red-600 hover:underline">
                  ลบ
                </button>
              </div>
            </div>
            {a.body && <p className="text-sm text-gray-600 whitespace-pre-wrap">{a.body}</p>}
            {a.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={a.imageUrl} alt={a.title} className="rounded-md max-h-40 object-contain self-start" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
