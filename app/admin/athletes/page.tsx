import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import AthleteRoster from "./AthleteRoster";

export default async function AthletesPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const athletes = await prisma.athlete.findMany({ orderBy: { name: "asc" } });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">ข้อมูลผู้เล่น (ขาประจำ)</h1>
      <AthleteRoster athletes={athletes} />
    </main>
  );
}
