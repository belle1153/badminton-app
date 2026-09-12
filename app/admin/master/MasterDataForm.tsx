"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function MasterDataForm({
  qrImageDataUrl,
  entryFee,
  gameFee,
}: {
  qrImageDataUrl: string | null;
  entryFee: number;
  gameFee: number;
}) {
  const router = useRouter();
  const [entry, setEntry] = useState(String(entryFee));
  const [game, setGame] = useState(String(gameFee));
  const [priceMsg, setPriceMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(qrImageDataUrl);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function savePricing(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPriceMsg(null);
    const res = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryFee: Number(entry), gameFee: Number(game) }),
    });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "บันทึกไม่สำเร็จ");
    setPriceMsg("บันทึกแล้ว");
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
        <h2 className="font-semibold">ราคาเก็บรายคน</h2>
        <p className="text-xs text-gray-400">
          แต่ละคนจ่าย = <strong>ค่าสนาม</strong> + (<strong>ค่าลูก</strong> × จำนวนเกมที่เล่นจบ) ·
          ปรับได้ตลอด ใช้ค่าล่าสุดกับวันที่ยังไม่ปิด (วันปิดแล้วล็อกราคาที่ใช้ตอนนั้นไว้)
        </p>
        <form onSubmit={savePricing} className="flex flex-wrap gap-3 items-end">
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            ค่าสนาม / ค่าแรกเข้า (บาท)
            <input
              type="number"
              min={0}
              value={entry}
              onChange={(e) => setEntry(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="input w-32"
              required
            />
          </label>
          <label className="flex flex-col gap-1 text-sm text-gray-600">
            ค่าลูก / ค่าเกม (บาท/เกม)
            <input
              type="number"
              min={0}
              value={game}
              onChange={(e) => setGame(e.target.value)}
              onFocus={(e) => e.target.select()}
              className="input w-32"
              required
            />
          </label>
          <button type="submit" className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700">
            บันทึก
          </button>
          {priceMsg && <span className="text-sm text-brand-700 pb-2">{priceMsg}</span>}
        </form>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">QR พร้อมเพย์ (สำหรับให้ผู้เล่นโอนเงิน)</h2>
        {preview && (
          <img src={preview} alt="PromptPay QR" className="w-40 h-40 object-contain border border-gray-200 rounded-md" />
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="self-start rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700"
        >
          {preview ? "เปลี่ยนรูป QR" : "อัปโหลดรูป QR"}
        </button>
      </section>
    </div>
  );
}
