"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { adminApi } from "./api";

interface EventRow {
  id: string;
  name: string;
  date: string;
  published: boolean;
}

export default function GamesEventList({ events }: { events: EventRow[] }) {
  const router = useRouter();
  const [name, setName] = useState("TUA TUENG GAMES 2026");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await adminApi<{ id: string }>("/api/admin/games", "POST", { name, date });
    setBusy(false);
    if (!res.ok) return setError(res.error);
    router.push(`/admin/games/${res.data.id}/setup`);
  }

  async function patch(id: string, body: object) {
    const res = await adminApi(`/api/admin/games/${id}`, "PATCH", body);
    if (!res.ok) setError(res.error);
    router.refresh();
  }

  async function remove(id: string) {
    const res = await adminApi(`/api/admin/games/${id}`, "DELETE");
    if (!res.ok) setError(res.error);
    setConfirmDelete(null);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={create} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
        <h2 className="font-semibold">สร้างงานใหม่</h2>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          ชื่องาน
          <input id="games-new-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm text-gray-600">
          วันที่แข่ง
          <input id="games-new-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <p className="text-xs text-gray-500">ระบบสร้าง 6 ทีมตามโปสเตอร์ และตาราง 15 + 5 แมตซ์ให้เลย แก้ชื่อ สี และผู้เล่นได้ทีหลัง</p>
        <button
          type="submit"
          disabled={busy || !date}
          className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {busy ? "กำลังสร้าง..." : "สร้างงาน"}
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <ul className="flex flex-col gap-3">
        {events.length === 0 && <li className="text-sm text-gray-500">ยังไม่มีงานแข่ง</li>}
        {events.map((ev) => (
          <li key={ev.id} className="flex flex-col gap-3 rounded-lg border border-gray-200 p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-semibold">{ev.name}</span>
              <span className="text-sm text-gray-500">{ev.date}</span>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                id={`games-published-${ev.id}`}
                type="checkbox"
                checked={ev.published}
                onChange={(e) => patch(ev.id, { published: e.target.checked })}
                className="h-5 w-5"
              />
              {ev.published ? "เปิดให้ผู้เล่นดูแล้ว" : "ผู้เล่นเห็น \"Coming soon\" (ยังไม่เปิด)"}
            </label>
            <div className="flex flex-wrap gap-2 text-sm">
              <Link href={`/admin/games/${ev.id}`} className="rounded-md bg-brand-600 px-3 py-1.5 font-medium text-white hover:bg-brand-700">
                คุมรอบ · กรอกผล
              </Link>
              <Link href={`/admin/games/${ev.id}/lineups`} className="rounded-md border border-brand-300 px-3 py-1.5 font-medium text-brand-700">
                ใบส่งตัว
              </Link>
              <Link href={`/admin/games/${ev.id}/setup`} className="rounded-md border border-brand-300 px-3 py-1.5 font-medium text-brand-700">
                ตั้งค่างาน / ทีม
              </Link>
              <Link href={`/games/${ev.id}`} className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700">
                หน้าผู้เล่น
              </Link>
              <Link href={`/admin/games/${ev.id}/slips`} className="rounded-md border border-gray-300 px-3 py-1.5 text-gray-700">
                พิมพ์ใบผล
              </Link>
            </div>
            {confirmDelete === ev.id ? (
              <div className="flex flex-wrap items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-800">
                ลบงานนี้และผลทั้งหมด? กู้คืนไม่ได้
                <button type="button" onClick={() => remove(ev.id)} className="rounded-md bg-red-600 px-3 py-1 font-medium text-white">
                  ลบเลย
                </button>
                <button type="button" onClick={() => setConfirmDelete(null)} className="rounded-md border border-red-300 px-3 py-1">
                  ยกเลิก
                </button>
              </div>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(ev.id)} className="self-start text-xs text-red-600 hover:underline">
                ลบงาน
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
