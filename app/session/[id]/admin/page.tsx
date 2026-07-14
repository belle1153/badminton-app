import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import CheckInList from "./CheckInList";
import RegistrationToggle from "./RegistrationToggle";
import AddPlayerForm from "./AddPlayerForm";

export const dynamic = "force-dynamic";

export default async function SessionCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await isAdmin())) return null; // layout renders the PIN gate

  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      signUps: {
        where: { status: { not: "WITHDRAWN" } },
        orderBy: [{ status: "asc" }, { slotNumber: "asc" }, { createdAt: "asc" }],
      },
    },
  });

  if (!session) return null;

  return (
    <>
      {session.status === "OPEN" && (
        <RegistrationToggle sessionId={id} registrationClosed={session.registrationClosedAt != null} />
      )}

      {session.status === "OPEN" && <AddPlayerForm sessionId={id} />}

      <CheckInList
        sessionId={id}
        signUps={session.signUps.map((s) => ({
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel,
          status: s.status as "CONFIRMED" | "WAITLIST",
          preferredSlot: s.preferredSlot as "EARLY" | "LATE",
          checkedInAt: s.checkedInAt ? s.checkedInAt.toISOString() : null,
          checkedOutAt: s.checkedOutAt ? s.checkedOutAt.toISOString() : null,
        }))}
      />
    </>
  );
}
