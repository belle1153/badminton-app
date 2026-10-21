import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import { ComingSoon } from "../../ui";
import { TvShow, type TvMode } from "./TvScreens";

export const dynamic = "force-dynamic";

const MODES: TvMode[] = ["rotate", "matches", "standings"];

/** The main big screen: matches in play and the table, switching every 10 s (?mode= to hold one). */
export default async function TvShowPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const { eventId } = await params;
  const { mode } = await searchParams;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  if (!state.event.published && !(await isAdmin())) return <ComingSoon name={state.event.name} />;
  return <TvShow initial={state} initialMode={MODES.find((m) => m === mode) ?? "rotate"} />;
}
