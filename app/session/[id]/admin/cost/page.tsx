import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { courtCostByPerson } from "@/lib/billing";
import { buildCostRows, sessionPrices, sessionFees } from "@/lib/costing";
import {
  COST_SIGNUP_INCLUDE,
  costAttendees,
  costDateLabel,
  toExportRows,
} from "@/lib/costReport";
import CostPanel from "../CostPanel";
import CostImageExport from "../CostImageExport";
import CostPersonTable from "../CostPersonTable";

export const dynamic = "force-dynamic";

const timeLabel = (d: Date) =>
  d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

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
          include: COST_SIGNUP_INCLUDE,
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

  // Per-person bill = ค่าแรกเข้า + เกม × ค่าเกม (frozen at close, else current).
  const { entryFee, gameFee } = sessionFees(session, settings);
  const attendees = costAttendees(session.signUps);
  // Everyone who signed up and didn't withdraw is billed. Someone with no
  // check-in and no check-out never came = no-show, shown ไม่มา and charged the
  // flat fine — a waitlist sign-up who didn't turn up owes it just the same.
  const { rows } = buildCostRows(attendees, entryFee, gameFee);

  // What the club itself owes the venue (court rent + shuttlecocks) is a
  // separate record, previewed/frozen by CostPanel. courtHourUnits = Σ (open
  // courts × block-hours) actually played; no-shows never took a court.
  const { rate } = sessionPrices(session, courtRates, shuttlecockTypes);
  const { units: courtHourUnits } = courtCostByPerson(
    session,
    attendees.filter((a) => !a.noShow).map((a) => ({ id: a.id, timeSlot: a.timeSlot, checkedOutAt: a.checkedOutAt })),
    rate,
    new Date()
  );

  const tableRows = rows.map((r) => ({
    id: r.id,
    name: r.name,
    slot: r.slot,
    outLabel: r.noShow ? "ไม่มา" : r.out ? timeLabel(r.out) : "ยังเล่นอยู่",
    games: r.games,
    entryBaht: r.entryBaht,
    gameBaht: r.gameBaht,
    totalBaht: r.totalBaht,
    live: r.live,
    noShow: r.noShow,
    paid: r.paid,
  }));

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
          แต่ละคน = ค่าแรกเข้า {entryFee}฿ + ค่าเกม (เกมละ {gameFee}฿ × จำนวนเกมที่เล่นจบ) · คนไม่มา
          ปรับ 100฿ · ติ๊ก &quot;จ่ายแล้ว&quot; เมื่อเก็บเงินหน้างาน คนที่ยังไม่ติ๊กจะขึ้นยอดค้างในไลน์
        </p>

        {rows.length === 0 ? (
          <p className="text-sm text-gray-400">ยังไม่มีคนเช็คอินวันนี้</p>
        ) : (
          <CostPersonTable sessionId={id} rows={tableRows} />
        )}
        <p className="text-xs text-gray-400">
          * คนที่ยังไม่เช็คเอาท์ = จำนวนเกมยังเพิ่มได้ จะนิ่งเมื่อกดเช็คเอาท์
        </p>

        {rows.length > 0 && (
          <div className="flex flex-wrap gap-2">
            <CostImageExport
              venue={session.venue}
              dateLabel={costDateLabel(session.date)}
              rows={toExportRows(rows)}
              note={`* ยังเล่นอยู่ = จำนวนเกมยังไม่นิ่ง · ค่าแรกเข้า ${entryFee}฿ + เกมละ ${gameFee}฿ · คนไม่มา ปรับ 100฿`}
            />
            {/* A plain link, not an in-browser build: phones refuse to save a
                blob download, so the file comes from the server instead. */}
            <a
              href={`/api/sessions/${id}/cost/xlsx`}
              className="self-start rounded-md border-2 border-green-600 text-green-700 text-sm font-medium px-3 py-1.5 hover:bg-green-50"
            >
              📊 ดาวน์โหลด Excel
            </a>
          </div>
        )}
      </section>
    </>
  );
}
