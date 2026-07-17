import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { formatHours } from "@/lib/billing";
import { buildCostRows, sessionPrices } from "@/lib/costing";
import CostPanel from "../CostPanel";

export const dynamic = "force-dynamic";

export default async function SessionCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await isAdmin())) return null; // layout renders the PIN gate

  const [session, courtRates, shuttlecockTypes, gamesPlayed, settings] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: {
        signUps: {
          where: { status: { not: "WITHDRAWN" } },
          include: { matchSlots: { include: { match: { select: { finishedAt: true } } } } },
          orderBy: { name: "asc" },
        },
      },
    }),
    prisma.courtRate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shuttlecockType.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.match.count({ where: { sessionId: id, finishedAt: { not: null } } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!session) return null;

  // Closed day → the fee frozen at close (what was actually charged). Still
  // open → the club's current fee, since that's what closing it now would use.
  const feePerPerson =
    session.status === "CLOSED" ? (session.feePerPerson ?? 0) : (settings?.feePerPerson ?? 0);
  const { rate, ballPrice } = sessionPrices(session, courtRates, shuttlecockTypes);

  // Everyone who actually showed up (checked in or out) — same rows the players'
  // own cost tab renders, so both sides always agree.
  const { rows, courtHourUnits } = buildCostRows(
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

  return (
    <>
      <CostPanel
        sessionId={id}
        status={session.status}
        courtRates={courtRates}
        shuttlecockTypes={shuttlecockTypes}
        courtHourUnits={courtHourUnits}
        gamesPlayed={gamesPlayed}
        defaultCourtRateId={session.courtRateId}
        defaultShuttlecockTypeId={session.shuttlecockTypeId}
        closedSummary={
          session.status === "CLOSED"
            ? {
                courtCost: session.courtCost,
                shuttlecockCost: session.shuttlecockCost,
                totalCost: session.totalCost,
              }
            : null
        }
      />

      <section className="flex flex-col gap-2">
        <h2 className="font-semibold">สรุปรายคน (วันนี้)</h2>
        <p className="text-xs text-gray-400">
          เวลาเริ่มนับตามช่วงที่ลง (1 ทุ่ม/2 ทุ่ม) · ขั้นต่ำ 2 ชม. · ปัดครึ่งชม. (เผื่อ 10 นาที) ·
          ค่าลูก = เกมละ 1 ลูก หาร 4 คน · ค่าคอร์ท = ค่าคอร์ทแต่ละครึ่งชม. หารคนที่อยู่ช่วงนั้น
          {rate > 0 && ` (เรท ${rate} ฿/ชม./สนาม)`}
          {feePerPerson > 0 && ` · ค่าคอร์ทรวมค่าธรรมเนียม ${feePerPerson} ฿/คน ไว้แล้ว`}
        </p>
        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีคนเช็คอินวันนี้</p>
        ) : (
          <div className="overflow-x-auto border border-gray-100 rounded-md">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                  <th className="px-2 py-1.5 font-medium">ชื่อ</th>
                  <th className="px-2 py-1.5 font-medium">ช่วง</th>
                  <th className="px-2 py-1.5 font-medium">เช็คเอาท์</th>
                  <th className="px-2 py-1.5 font-medium text-right">ชม.คิด</th>
                  <th className="px-2 py-1.5 font-medium text-right">เกม</th>
                  <th className="px-2 py-1.5 font-medium text-right">ค่าคอร์ท (฿)</th>
                  <th className="px-2 py-1.5 font-medium text-right">ค่าลูก (฿)</th>
                  <th className="px-2 py-1.5 font-medium text-right">รวม (฿)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-gray-50">
                    <td className="px-2 py-1.5">{r.name}</td>
                    <td className="px-2 py-1.5 text-gray-500">{r.slot}</td>
                    <td className="px-2 py-1.5 text-gray-500">
                      {r.out
                        ? r.out.toLocaleTimeString("th-TH", {
                            hour: "2-digit",
                            minute: "2-digit",
                            timeZone: "Asia/Bangkok",
                          })
                        : "ยังเล่นอยู่"}
                    </td>
                    <td className="px-2 py-1.5 text-right">
                      {r.hours != null ? formatHours(r.hours) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-right">{r.games}</td>
                    <td className="px-2 py-1.5 text-right">
                      {r.courtBaht}
                      {r.live && <span className="text-[10px] text-amber-500"> *</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right">{r.ballShareBaht}</td>
                    <td className="px-2 py-1.5 text-right font-semibold">{r.totalBaht}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400">
          * คนที่ยังไม่เช็คเอาท์ = ค่าคอร์ทยังไม่นิ่ง (คิดถึงตอนนี้) จะนิ่งเมื่อกดเช็คเอาท์
        </p>
      </section>
    </>
  );
}
