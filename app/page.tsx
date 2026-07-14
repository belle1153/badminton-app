import Link from "next/link";
import { prisma } from "@/lib/db";
import AnnouncementCarousel from "./AnnouncementCarousel";

// Always read fresh data — without this the page is frozen at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const announcements = await prisma.announcement.findMany({
    where: { active: true, kind: "announcement" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">🏸 TUATUENG REGISTER</h1>

      <div className="grid grid-cols-2 gap-3">
        <Link
          href="/register"
          className="rounded-xl border-2 border-brand-200 bg-brand-50/60 p-4 flex flex-col items-center gap-1 text-center hover:border-brand-400 transition"
        >
          <span className="text-3xl">📝</span>
          <span className="font-semibold text-brand-800">ลงทะเบียน</span>
          <span className="text-xs text-gray-500">ลงชื่อตีแบด / เลือกวัน</span>
        </Link>
        <Link
          href="/live"
          className="rounded-xl border-2 border-blue-200 bg-blue-50/60 p-4 flex flex-col items-center gap-1 text-center hover:border-blue-400 transition"
        >
          <span className="text-3xl">🏸</span>
          <span className="font-semibold text-blue-800">สนามที่กำลังเล่น</span>
          <span className="text-xs text-gray-500">ดูทุกสนามหน้าเดียว</span>
        </Link>
        <Link
          href="/rules"
          className="rounded-xl border-2 border-gray-200 p-4 flex flex-col items-center gap-1 text-center hover:border-brand-400 transition"
        >
          <span className="text-3xl">📖</span>
          <span className="font-semibold">กฎของก๊วน / สนาม</span>
          <span className="text-xs text-gray-500">กติกา อ่านก่อนมาตี</span>
        </Link>
      </div>

      <AnnouncementCarousel items={announcements} />
    </main>
  );
}
