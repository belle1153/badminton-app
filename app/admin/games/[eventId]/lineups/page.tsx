import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import LineupsBoard, { type Tab } from "./LineupsBoard";

export const dynamic = "force-dynamic";

/** The lineups menu: every tie's paper lineups, one round per tab. */
export default async function GamesLineupsPage({
  params,
  searchParams,
}: {
  params: Promise<{ eventId: string }>;
  searchParams: Promise<{ round?: string }>;
}) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { eventId } = await params;
  const { round } = await searchParams;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  const n = Number(round);
  const tab: Tab | null = round === "KO" ? "KO" : Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
  return (
    <main className="max-w-2xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-5">
      <LineupsBoard initial={state} initialTab={tab} />
    </main>
  );
}
