import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import GamesEventList from "./GamesEventList";

export const dynamic = "force-dynamic";

/** Admin: TUA TUENG GAMES events — create, publish, open, delete. */
export default async function AdminGamesPage() {
  if (!(await isAdmin())) redirect("/admin/login");
  const events = await prisma.gamesEvent.findMany({
    orderBy: { date: "desc" },
    select: { id: true, name: true, date: true, published: true },
  });
  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">เกมส์ (งานแข่งแบบทีม)</h1>
        <p className="text-sm text-gray-600">
          สร้างงานแล้วตั้งทีมกับผู้เล่น ระหว่างแข่งคีย์ใบส่งตัวและผลจากกระดาษที่หน้า &quot;คุมรอบ&quot; ผู้เล่นจะเห็นแค่
          &quot;Coming soon&quot; จนกว่าจะกดเปิดให้ดู
        </p>
      </div>
      <GamesEventList events={events.map((e) => ({ ...e, date: e.date.toISOString().slice(0, 10) }))} />
    </main>
  );
}
