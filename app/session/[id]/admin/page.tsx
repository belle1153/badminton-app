import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { lateStartAt } from "@/lib/billing";
import CheckInList from "./CheckInList";
import RegistrationToggle from "./RegistrationToggle";
import AddPlayerForm from "./AddPlayerForm";
import SessionSettingsEditor from "./SessionSettingsEditor";

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
        <SessionSettingsEditor
          sessionId={id}
          startTime={session.startTime}
          maxPlayers={session.maxPlayers}
          courtsEarly={session.courtsEarly}
          activeCount={session.signUps.length}
        />
      )}

      {session.status === "OPEN" && (
        <RegistrationToggle sessionId={id} registrationClosed={session.registrationClosedAt != null} />
      )}

      {session.status === "OPEN" && (
        <AddPlayerForm
          sessionId={id}
          // Once the second block has started (20:00 on a 19:00 day) a walk-in is
          // almost certainly playing it — pre-pick that so the common case is
          // right without the admin thinking about it.
          defaultSlot={Date.now() >= lateStartAt(session).getTime() ? "LATE" : "EARLY"}
          startTime={session.startTime}
        />
      )}

      <CheckInList
        sessionId={id}
        startTime={session.startTime}
        signUps={session.signUps.map((s) => ({
          id: s.id,
          name: s.name,
          skillLevel: s.skillLevel,
          status: s.status as "CONFIRMED" | "WAITLIST",
          timeSlot: s.timeSlot as "EARLY" | "LATE",
          preferredSlot: s.preferredSlot as "EARLY" | "LATE",
          checkedInAt: s.checkedInAt ? s.checkedInAt.toISOString() : null,
          checkedOutAt: s.checkedOutAt ? s.checkedOutAt.toISOString() : null,
        }))}
      />
    </>
  );
}
