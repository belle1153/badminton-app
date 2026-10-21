import { prisma } from "@/lib/db";
import { buildGamesState, type GamesState } from "./state";

/**
 * Read one event and build its snapshot. Logos and photos are only checked for
 * presence — the data-URL blobs stay in the database and are served by their
 * own cached routes, because this snapshot is polled every couple of seconds.
 * SECRET CARDs stay hidden until their pair is finished; admin pages pass
 * `revealCards` to see them all.
 */
export async function loadGamesState(
  eventId: string,
  { revealCards = false, now = new Date() }: { revealCards?: boolean; now?: Date } = {}
): Promise<GamesState | null> {
  const event = await prisma.gamesEvent.findUnique({
    where: { id: eventId },
    select: {
      id: true,
      name: true,
      date: true,
      qualifierRubberMinutes: true,
      knockoutRubberMinutes: true,
      published: true,
      rankOverride: true,
      teams: {
        select: { id: true, seed: true, name: true, color: true, updatedAt: true, members: { select: { athleteId: true } } },
      },
      ties: {
        select: {
          id: true,
          stage: true,
          round: true,
          slot: true,
          startsAt: true,
          courtA: true,
          courtB: true,
          teamAId: true,
          teamBId: true,
          rubbers: {
            select: {
              id: true,
              order: true,
              court: true,
              a1Id: true,
              a2Id: true,
              b1Id: true,
              b2Id: true,
              set1A: true,
              set1B: true,
              set2A: true,
              set2B: true,
              set3A: true,
              set3B: true,
              finishedAt: true,
              liveSet: true,
              liveStartedAt: true,
            },
          },
          cards: { select: { teamId: true, kind: true, order: true, swapWith: true } },
        },
      },
    },
  });
  if (!event) return null;

  const athleteIds = [
    ...new Set([
      ...event.teams.flatMap((t) => t.members.map((m) => m.athleteId)),
      ...event.ties.flatMap((t) => t.rubbers.flatMap((r) => [r.a1Id, r.a2Id, r.b1Id, r.b2Id])),
    ]),
  ].filter((id): id is string => id != null);

  const [withLogo, athletes, withPhoto] = await Promise.all([
    prisma.gamesTeam.findMany({ where: { eventId, logoUrl: { not: null } }, select: { id: true } }),
    prisma.athlete.findMany({ where: { id: { in: athleteIds } }, select: { id: true, name: true, updatedAt: true } }),
    prisma.athlete.findMany({ where: { id: { in: athleteIds }, photoUrl: { not: null } }, select: { id: true } }),
  ]);
  const logoIds = new Set(withLogo.map((t) => t.id));
  const photoIds = new Set(withPhoto.map((a) => a.id));

  return buildGamesState(
    {
      event: { ...event, teams: event.teams.map((t) => ({ ...t, hasLogo: logoIds.has(t.id) })) },
      athletes: athletes.map((a) => ({ ...a, hasPhoto: photoIds.has(a.id) })),
    },
    now,
    { revealCards }
  );
}

/** The newest event, for the home-page card: a link once published, "coming soon" before. */
export async function latestEventForHome(): Promise<{ id: string; name: string; published: boolean } | null> {
  return prisma.gamesEvent.findFirst({
    orderBy: [{ published: "desc" }, { date: "desc" }],
    select: { id: true, name: true, published: true },
  });
}
