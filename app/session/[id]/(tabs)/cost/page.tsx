import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatHours } from "@/lib/billing";
import { buildCostRows, sessionPrices } from "@/lib/costing";

export const dynamic = "force-dynamic";

export default async function SessionCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, settings, courtRates, shuttlecockTypes] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: {
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          include: { matchSlots: { include: { match: { select: { finishedAt: true } } } } },
        },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
    prisma.courtRate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shuttlecockType.findMany({ orderBy: { createdAt: "asc" } }),
  ]);

  if (!session) notFound();

  if (session.status !== "CLOSED") {
    return <p className="text-sm text-gray-500">ยังไม่ปิดยอด รอแอดมินปิดวันก่อนครับ</p>;
  }

  // The day is closed, so bill the fee that was frozen onto it — not the club's
  // current fee, which may have changed since. (Days closed before the fee
  // existed have none, and charged none.)
  const feePerPerson = session.feePerPerson ?? 0;
  const { rate, ballPrice } = sessionPrices(session, courtRates, shuttlecockTypes);

  // Charged per person on what they actually played — the same rows the admin
  // sees, so the number here is the number they're asked for.
  const { rows } = buildCostRows(
    session,
    session.signUps
      .filter((s) => s.checkedInAt != null || s.checkedOutAt != null)
      .map((s) => ({
        id: s.id,
        name: s.name,
        timeSlot: s.timeSlot as "EARLY" | "LATE",
        checkedOutAt: s.checkedOutAt,
        gamesPlayed: s.matchSlots.filter((ms) => ms.match.finishedAt != null).length,
      })),
    rate,
    ballPrice,
    feePerPerson
  );

  const grandTotal = rows.reduce((sum, r) => sum + r.totalBaht, 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">สรุปค่าใช้จ่าย</h2>

      <div className="text-sm flex flex-col gap-1 rounded-md bg-gray-50 border border-gray-100 p-2.5">
        <p>ค่าคอร์ททั้งวัน: {session.courtCost} บาท</p>
        <p>ค่าลูกแบดทั้งวัน: {session.shuttlecockCost} บาท</p>
        <p className="font-semibold pt-0.5">รวมเก็บ: {grandTotal} บาท ({rows.length} คน)</p>
      </div>

      <p className="text-xs text-gray-400">
        คิดตามที่เล่นจริง — ค่าคอร์ท = ค่าสนามแต่ละครึ่งชม. หารกับคนที่อยู่ช่วงนั้น (ขั้นต่ำ 2 ชม.
        ปัดครึ่งชม. เผื่อ 15 นาที){rate > 0 && ` · เรท ${rate} ฿/ชม./สนาม`} · ค่าลูก = เกมที่เล่น ÷ 4 คน
        {ballPrice > 0 && ` × ${ballPrice} ฿/ลูก`}
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">วันนี้ไม่มีคนเช็คอิน</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1.5 font-medium">ชื่อ</th>
                <th className="px-2 py-1.5 font-medium">ช่วง</th>
                <th className="px-2 py-1.5 font-medium text-right">ชม.</th>
                <th className="px-2 py-1.5 font-medium text-right">เกม</th>
                <th className="px-2 py-1.5 font-medium text-right">ค่าคอร์ท</th>
                <th className="px-2 py-1.5 font-medium text-right">ค่าลูก</th>
                <th className="px-2 py-1.5 font-medium text-right">รวม (฿)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-2 py-1.5">{r.name}</td>
                  <td className="px-2 py-1.5 text-gray-500">{r.slot}</td>
                  <td className="px-2 py-1.5 text-right">{r.hours != null ? formatHours(r.hours) : "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.games}</td>
                  <td className="px-2 py-1.5 text-right">{r.courtBaht}</td>
                  <td className="px-2 py-1.5 text-right">{r.ballShareBaht}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{r.totalBaht}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {settings?.qrImageDataUrl && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-sm text-gray-600">สแกนเพื่อโอนเงิน</p>
          <img
            src={settings.qrImageDataUrl}
            alt="PromptPay QR"
            className="w-56 h-56 object-contain border border-gray-200 rounded-md"
          />
        </div>
      )}
    </section>
  );
}
