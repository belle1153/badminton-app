import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { buildCostRows, sessionFees } from "@/lib/costing";
import { COST_SIGNUP_INCLUDE, costAttendees } from "@/lib/costReport";

export const dynamic = "force-dynamic";

export default async function SessionCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, settings] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: {
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          include: COST_SIGNUP_INCLUDE,
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!session) notFound();

  if (session.status !== "CLOSED") {
    return <p className="text-sm text-gray-500">ยังไม่ปิดยอด รอแอดมินปิดวันก่อนครับ</p>;
  }

  // Closed day bills at the fees frozen onto it. Everyone who signed up and
  // didn't withdraw is charged; a no-show (no check-in/out) pays the flat fine.
  const { entryFee, gameFee } = sessionFees(session, settings);
  const { rows } = buildCostRows(costAttendees(session.signUps), entryFee, gameFee);

  const grandTotal = rows.reduce((sum, r) => sum + r.totalBaht, 0);
  const unpaidBaht = rows.filter((r) => !r.paid).reduce((sum, r) => sum + r.totalBaht, 0);

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">สรุปค่าใช้จ่าย</h2>

      <div className="text-sm flex flex-col gap-1 rounded-md bg-gray-50 border border-gray-100 p-2.5">
        <p className="font-semibold">รวมเก็บ: {grandTotal} บาท ({rows.length} คน)</p>
        {unpaidBaht > 0 && <p className="text-red-600">ค้างจ่าย: {unpaidBaht} บาท</p>}
        <p className="text-xs text-gray-400 pt-0.5">
          (ต้นทุนสนามวันนี้ — ค่าคอร์ท {session.courtCost} ฿ · ค่าลูก {session.shuttlecockCost} ฿)
        </p>
      </div>

      <p className="text-xs text-gray-400">
        แต่ละคน = ค่าแรกเข้า {entryFee}฿ + ค่าเกม (เกมละ {gameFee}฿ × จำนวนเกม) · คนไม่มา ปรับ 100฿
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
                <th className="px-2 py-1.5 font-medium text-right">เกม</th>
                <th className="px-2 py-1.5 font-medium text-right">ค่าแรกเข้า</th>
                <th className="px-2 py-1.5 font-medium text-right">ค่าเกม</th>
                <th className="px-2 py-1.5 font-medium text-right">รวม (฿)</th>
                <th className="px-2 py-1.5 font-medium text-center">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={`border-b border-gray-50 ${r.noShow ? "text-gray-400" : ""}`}>
                  <td className="px-2 py-1.5">
                    {r.name}
                    {r.noShow && <span className="ml-1.5 text-amber-600 font-medium">ไม่มา</span>}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500">{r.noShow ? "—" : r.slot}</td>
                  <td className="px-2 py-1.5 text-right">{r.games}</td>
                  <td className="px-2 py-1.5 text-right">{r.entryBaht || "—"}</td>
                  <td className="px-2 py-1.5 text-right">{r.gameBaht}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{r.totalBaht}</td>
                  <td className="px-2 py-1.5 text-center">
                    {r.paid ? (
                      <span className="text-green-700">จ่ายแล้ว</span>
                    ) : (
                      <span className="text-red-500">ค้าง</span>
                    )}
                  </td>
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
