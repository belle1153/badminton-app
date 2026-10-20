import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import RoundBoard from "./RoundBoard";

export const dynamic = "force-dynamic";

/** Admin's event-day page: lineups status and result entry, round by round. */
export default async function GamesRoundPage({ params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { eventId } = await params;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  return (
    <main className="max-w-2xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-5">
      <RoundBoard initial={state} />
    </main>
  );
}
