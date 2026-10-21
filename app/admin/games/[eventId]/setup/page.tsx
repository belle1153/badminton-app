import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import SetupBoard from "./SetupBoard";

export const dynamic = "force-dynamic";

export default async function GamesSetupPage({ params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { eventId } = await params;
  const [state, athletes] = await Promise.all([
    loadGamesState(eventId),
    prisma.athlete.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!state) notFound();
  return (
    <main className="max-w-2xl mx-auto w-full p-4 sm:p-6 flex flex-col gap-6">
      <SetupBoard initial={state} athletes={athletes} />
    </main>
  );
}
