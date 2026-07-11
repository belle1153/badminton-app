import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
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
    prisma.session.findUnique({ where: { id } }),
    prisma.courtRate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shuttlecockType.findMany({ orderBy: { createdAt: "asc" } }),
  ]);
  if (!session) return null;

  return (
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
  );
}
