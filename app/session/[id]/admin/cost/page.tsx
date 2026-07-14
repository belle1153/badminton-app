import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { blockStart, billedHours, formatHours } from "@/lib/billing";
import CostPanel from "../CostPanel";

export const dynamic = "force-dynamic";

export default async function SessionCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await isAdmin())) return null; // layout renders the PIN gate

  const [session, courtRates, shuttlecockTypes] = await Promise.all([
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
  ]);
  if (!session) return null;

  const ballPrice = shuttlecockTypes[0]?.pricePerPiece ?? 0;

  // Per-person day summary: everyone who actually showed up (checked in or out).
  const rows = session.signUps
    .filter((s) => s.checkedInAt != null || s.checkedOutAt != null)
    .map((s) => {
      const games = s.matchSlots.filter((ms) => ms.match.finishedAt != null).length;
      const start = blockStart(session.date, s.timeSlot as "EARLY" | "LATE");
      const hours = s.checkedOutAt ? billedHours(start, s.checkedOutAt) : null;
      // 1 ball per game shared by 4 players → each pays a quarter of a ball.
      const ballShareBaht = Math.ceil((games / 4) * ballPrice);
      return {
        id: s.id,
        name: s.name,
        slot: s.timeSlot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม",
        out: s.checkedOutAt,
        hours,
        games,
        ballShareBaht,
      };
    });

  return (
    <>
      <CostPanel
        sessionId={id}
        status={session.status}
        courtRates={courtRates}
        shuttlecockTypes={shuttlecockTypes}
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
          ค่าลูก = เกมละ 1 ลูก หาร 4 คน
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
                  <th className="px-2 py-1.5 font-medium text-right">ค่าลูก (฿)</th>
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
                    <td className="px-2 py-1.5 text-right">{r.ballShareBaht}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-gray-400">
          * ค่าคอร์ทต่อคนยังไม่คิดในตาราง — รอสรุปวิธีหาร (ตามชั่วโมง/เท่ากัน) อีกที
        </p>
      </section>
    </>
  );
}
