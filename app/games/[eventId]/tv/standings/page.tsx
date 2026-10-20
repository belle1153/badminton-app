import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import { ComingSoon } from "../../../ui";
import { TvStandings } from "../TvScreens";

export const dynamic = "force-dynamic";

/** Big-screen standings (TV / projector). */
export default async function TvStandingsPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  if (!state.event.published && !(await isAdmin())) return <ComingSoon name={state.event.name} />;
  return <TvStandings initial={state} />;
}
