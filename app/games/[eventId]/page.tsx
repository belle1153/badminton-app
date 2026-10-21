import { notFound } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import { ComingSoon } from "../ui";
import GamesHome from "./GamesHome";
import { isTabKey } from "./tabs";

export const dynamic = "force-dynamic";

/** TUA TUENG GAMES player page. Players see "coming soon" until the admin publishes. */
export default async function GamesPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { eventId } = await params;
  const { tab } = await searchParams;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  if (!state.event.published && !(await isAdmin())) return <ComingSoon name={state.event.name} />;
  return <GamesHome initial={state} initialTab={isTabKey(tab) ? tab : null} />;
}
