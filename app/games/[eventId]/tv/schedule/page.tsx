import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import { ComingSoon } from "../../../ui";
import { TvSchedule } from "../TvScreens";

export const dynamic = "force-dynamic";

/** Big-screen schedule and results (TV / projector). */
export default async function TvSchedulePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  if (!state.event.published && !(await isAdmin())) return <ComingSoon name={state.event.name} />;
  return <TvSchedule initial={state} />;
}
