import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import LineupEditor from "./LineupEditor";

export const dynamic = "force-dynamic";

/** Key in a team's paper lineup (pairs 1–5) for one tie. */
export default async function GamesLineupPage({ params }: { params: Promise<{ eventId: string; tieId: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { eventId, tieId } = await params;
  const state = await loadGamesState(eventId);
  if (!state || !state.ties.some((t) => t.id === tieId)) notFound();
  return (
    <main className="max-w-md mx-auto w-full p-4 sm:p-6 flex flex-col gap-4">
      <LineupEditor initial={state} tieId={tieId} />
    </main>
  );
}
