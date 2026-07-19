import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import AthleteRoster from "./AthleteRoster";

export default async function AthletesPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  // Photos render via /api/athletes/[id]/photo (cached) — don't ship ~70 base64
  // blobs inside this page's HTML.
  const rows = await prisma.athlete.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, skillLevel: true, updatedAt: true },
  });
  const withPhoto = new Set(
    (
      await prisma.athlete.findMany({
        where: { photoUrl: { not: null } },
        select: { id: true },
      })
    ).map((a) => a.id)
  );
  const athletes = rows.map((a) => ({
    id: a.id,
    name: a.name,
    skillLevel: a.skillLevel,
    photoUrl: withPhoto.has(a.id) ? `/api/athletes/${a.id}/photo?v=${a.updatedAt.getTime()}` : null,
  }));

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">ข้อมูลผู้เล่น (ขาประจำ)</h1>
      <AthleteRoster athletes={athletes} />
    </main>
  );
}
