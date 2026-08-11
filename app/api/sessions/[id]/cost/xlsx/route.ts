import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { buildCostRows, sessionPrices } from "@/lib/costing";
import {
  COST_SIGNUP_INCLUDE,
  costAttendees,
  costDateLabel,
  toExportRows,
  xlsxFileName,
  xlsxSheetRows,
  XLSX_COL_WIDTHS,
} from "@/lib/costReport";
import { buildXlsxBytes } from "@/lib/xlsx";

/**
 * The per-person bill as a real .xlsx, built on the server.
 *
 * This is a plain download link on purpose. Building the file in the browser
 * worked on desktop but not on phones: a blob `a[download]` is refused by the
 * in-app browsers (LINE especially), and the Web Share fallback depends on the
 * OS offering a share target for .xlsx — neither is something the admin can fix
 * from their phone. A normal GET with Content-Disposition always saves.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "ต้องเป็นแอดมิน" }, { status: 403 });
  }
  const { id } = await params;

  const [session, courtRates, shuttlecockTypes, settings] = await Promise.all([
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
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);
  if (!session) return NextResponse.json({ error: "ไม่พบรอบเล่นนี้" }, { status: 404 });

  // Same rule as the page: a closed day bills at the fee frozen when it closed.
  const feePerPerson =
    session.status === "CLOSED" ? (session.feePerPerson ?? 0) : (settings?.feePerPerson ?? 0);
  const { rate, ballPrice } = sessionPrices(session, courtRates, shuttlecockTypes);
  const { rows } = buildCostRows(
    session,
    costAttendees(session.signUps),
    rate,
    ballPrice,
    feePerPerson
  );

  const dateLabel = costDateLabel(session.date);
  const bytes = buildXlsxBytes(
    `สรุป ${dateLabel}`.slice(0, 31),
    xlsxSheetRows(toExportRows(rows)),
    { colWidths: XLSX_COL_WIDTHS, boldFirstRow: true, boldLastRow: true }
  );

  const fileName = xlsxFileName(session.venue, dateLabel);
  return new NextResponse(bytes as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // Both forms: the ASCII fallback for old clients, the UTF-8 one for the
      // Thai date in the real name.
      "Content-Disposition": `attachment; filename="cost.xlsx"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      "Cache-Control": "no-store",
    },
  });
}
