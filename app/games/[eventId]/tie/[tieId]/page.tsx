import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import { ComingSoon } from "../../../ui";
import GamesTie from "./GamesTie";

export const dynamic = "force-dynamic";

export default async function GamesTiePage({ params }: { params: Promise<{ eventId: string; tieId: string }> }) {
  const { eventId, tieId } = await params;
  const state = await loadGamesState(eventId);
  if (!state || !state.ties.some((t) => t.id === tieId)) notFound();
  if (!state.event.published && !(await isAdmin())) return <ComingSoon name={state.event.name} />;
  return <GamesTie initial={state} tieId={tieId} />;
}
