import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { blockStart, billedHours, formatHours, billingBlocks, courtsOpenAt } from "@/lib/billing";
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
  // Court rate/hr: the session's chosen rate if set, else the first master rate.
  const rate =
    (session.courtRateId
      ? courtRates.find((c) => c.id === session.courtRateId)
      : courtRates[0])?.pricePerHour ?? 0;

  const attendees = session.signUps.filter(
    (s) => s.checkedInAt != null || s.checkedOutAt != null
  );

  // Court cost split per half-hour block: each block's court cost
  // (open courts × rate × block-hours) is divided among everyone present in that
  // block, summed across the blocks each person attended. A person's billed
  // interval runs from their slot start (19:00 / 20:00) to their billed checkout
  // (min 2h, half-hour steps); still-playing people count up to "now".
  const now = new Date();
  const startOf = (s: (typeof attendees)[number]) =>
    blockStart(session.date, s.timeSlot as "EARLY" | "LATE");
  const billedEndOf = (s: (typeof attendees)[number]) => {
    const start = startOf(s);
    if (!s.checkedOutAt) return now;
    return new Date(start.getTime() + billedHours(start, s.checkedOutAt) * 3_600_000);
  };
  const courtShare = new Map<string, number>();
  for (const b of billingBlocks(session.date)) {
    const present = attendees.filter(
      (s) => startOf(s).getTime() < b.end.getTime() && billedEndOf(s).getTime() > b.start.getTime()
    );
    if (present.length === 0) continue;
    const perPlayer = (courtsOpenAt(session, b.start) * rate * b.hours) / present.length;
    for (const s of present) courtShare.set(s.id, (courtShare.get(s.id) ?? 0) + perPlayer);
  }

  // Per-person day summary: everyone who actually showed up (checked in or out).
  const rows = attendees
    .map((s) => {
      const games = s.matchSlots.filter((ms) => ms.match.finishedAt != null).length;
      const start = blockStart(session.date, s.timeSlot as "EARLY" | "LATE");
      const hours = s.checkedOutAt ? billedHours(start, s.checkedOutAt) : null;
      // 1 ball per game shared by 4 players → each pays a quarter of a ball.
      const ballShareBaht = Math.ceil((games / 4) * ballPrice);
      const courtBaht = Math.ceil(courtShare.get(s.id) ?? 0);
      return {
        id: s.id,
        name: s.name,
        slot: s.timeSlot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม",
        out: s.checkedOutAt,
        hours,
        games,
        ballShareBaht,
        courtBaht,
        live: s.checkedOutAt == null,
        totalBaht: courtBaht + ballShareBaht,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

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
          ค่าลูก = เกมละ 1 ลูก หาร 4 คน · ค่าคอร์ท = ค่าคอร์ทแต่ละครึ่งชม. หารคนที่อยู่ช่วงนั้น
          {rate > 0 && ` (เรท ${rate} ฿/ชม./สนาม)`}
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
