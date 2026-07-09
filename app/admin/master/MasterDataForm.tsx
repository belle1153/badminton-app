"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

interface CourtRate {
  id: string;
  name: string;
  pricePerHour: number;
}

interface ShuttlecockType {
  id: string;
  name: string;
  pricePerPiece: number;
}

export default function MasterDataForm({
  courtRates,
  shuttlecockTypes,
  qrImageDataUrl,
}: {
  courtRates: CourtRate[];
  shuttlecockTypes: ShuttlecockType[];
  qrImageDataUrl: string | null;
}) {
  const router = useRouter();
  const [rateName, setRateName] = useState("");
  const [ratePrice, setRatePrice] = useState("");
  const [shuttleName, setShuttleName] = useState("");
  const [shuttlePrice, setShuttlePrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(qrImageDataUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function addCourtRate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/court-rates", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: rateName, pricePerHour: ratePrice }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "เพิ่มไม่สำเร็จ");
    setRateName("");
    setRatePrice("");
    router.refresh();
  }

  async function deleteCourtRate(id: string) {
    const res = await fetch(`/api/admin/court-rates/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "ลบไม่สำเร็จ");
    router.refresh();
  }

  async function addShuttlecock(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/shuttlecocks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: shuttleName, pricePerPiece: shuttlePrice }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "เพิ่มไม่สำเร็จ");
    setShuttleName("");
    setShuttlePrice("");
    router.refresh();
  }

  async function deleteShuttlecock(id: string) {
    const res = await fetch(`/api/admin/shuttlecocks/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "ลบไม่สำเร็จ");
    router.refresh();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      setPreview(dataUrl);
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrImageDataUrl: dataUrl }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error ?? "อัปโหลดไม่สำเร็จ");
      }
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="flex flex-col gap-8">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">ค่าคอร์ท (บาท/ชม.)</h2>
        <ul className="flex flex-col gap-1">
          {courtRates.map((r) => (
            <li key={r.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1">
              <span>
                {r.name} — {r.pricePerHour} บาท/ชม.
              </span>
              <button onClick={() => deleteCourtRate(r.id)} className="text-xs text-red-600 hover:underline">
                ลบ
              </button>
            </li>
          ))}
          {courtRates.length === 0 && <li className="text-sm text-gray-400">ยังไม่มีข้อมูล</li>}
        </ul>
        <form onSubmit={addCourtRate} className="flex gap-2">
          <input
            placeholder="ชื่อ เช่น Copa Sport Club"
            value={rateName}
            onChange={(e) => setRateName(e.target.value)}
            className="input flex-1"
            required
          />
          <input
            type="number"
            min={0}
            placeholder="บาท/ชม."
            value={ratePrice}
            onChange={(e) => setRatePrice(e.target.value)}
            className="input w-28"
            required
          />
          <button type="submit" className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700">
            เพิ่ม
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">ลูกแบด (บาท/ลูก)</h2>
        <ul className="flex flex-col gap-1">
          {shuttlecockTypes.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1">
              <span>
                {s.name} — {s.pricePerPiece} บาท/ลูก
              </span>
              <button onClick={() => deleteShuttlecock(s.id)} className="text-xs text-red-600 hover:underline">
                ลบ
              </button>
            </li>
          ))}
          {shuttlecockTypes.length === 0 && <li className="text-sm text-gray-400">ยังไม่มีข้อมูล</li>}
        </ul>
        <form onSubmit={addShuttlecock} className="flex gap-2">
          <input
            placeholder="ชื่อ เช่น Yonex AS-50"
            value={shuttleName}
            onChange={(e) => setShuttleName(e.target.value)}
            className="input flex-1"
            required
          />
          <input
            type="number"
            min={0}
            placeholder="บาท/ลูก"
            value={shuttlePrice}
            onChange={(e) => setShuttlePrice(e.target.value)}
            className="input w-28"
            required
          />
          <button type="submit" className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700">
            เพิ่ม
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">QR พร้อมเพย์ (สำหรับให้ผู้เล่นโอนเงิน)</h2>
        {preview && (
          <img src={preview} alt="PromptPay QR" className="w-40 h-40 object-contain border border-gray-200 rounded-md" />
        )}
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} className="text-sm" />
      </section>
    </div>
  );
}
