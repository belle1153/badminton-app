import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import LiveScorer from "./LiveScorer";

export const dynamic = "force-dynamic";

/** Full-screen live counting for one rubber (important rounds with a counter courtside). */
export default async function GamesLivePage({ params }: { params: Promise<{ eventId: string; rubberId: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { eventId, rubberId } = await params;
  const state = await loadGamesState(eventId, { revealCards: true });
  if (!state || !state.ties.some((t) => t.rubbers.some((r) => r.id === rubberId))) notFound();
  return <LiveScorer key={rubberId} initial={state} rubberId={rubberId} />;
}
