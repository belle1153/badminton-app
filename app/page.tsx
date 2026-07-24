import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { BUILD_LABEL } from "@/lib/version";
import AnnouncementCarousel from "./AnnouncementCarousel";

// Always read fresh data — without this the page is frozen at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Light select — the base64 image blobs stay in the DB and are served from
  // /api/announcements/[id]/image with hard caching, instead of being inlined
  // into every HTML response (this page used to weigh ~580 KB because of them).
  const rows = await prisma.announcement.findMany({
    where: { active: true, kind: "announcement" },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, body: true, updatedAt: true },
  });
  const withImage = new Set(
    (
      await prisma.announcement.findMany({
        where: { active: true, kind: "announcement", imageUrl: { not: null } },
        select: { id: true },
      })
    ).map((a) => a.id)
  );
  const announcements = rows.map((a) => ({
    ...a,
    imageUrl: withImage.has(a.id)
      ? `/api/announcements/${a.id}/image?v=${a.updatedAt.getTime()}`
      : null,
  }));

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1>
        <Image
          src="/logouser.png"
          alt="TUATUENG GO!"
          width={1500}
          height={788}
          priority
          className="w-4/5 h-auto mx-auto"
        />
      </h1>

      <div className="flex flex-col gap-4">
        {/* Signing up is what people come here to do — give it the whole row. */}
        <Link
          href="/register"
          className="rounded-2xl border-2 border-brand-200 bg-brand-50/60 p-7 flex flex-col items-center gap-1.5 text-center hover:border-brand-400 transition"
        >
          <span className="text-5xl">📝</span>
          <span className="font-bold text-2xl text-brand-800">Register</span>
          <span className="text-sm text-gray-500">ลงชื่อตีแบด / เลือกวัน</span>
        </Link>

        <div className="grid grid-cols-2 gap-4">
          <Link
            href="/live"
            className="rounded-2xl border-2 border-blue-200 bg-blue-50/60 p-6 flex flex-col items-center gap-1.5 text-center hover:border-blue-400 transition"
          >
            <span className="text-4xl">🏸</span>
            <span className="font-bold text-lg text-blue-800">Match Running</span>
            <span className="text-xs text-gray-500">สนามที่กำลังเล่น / เช็คคิวตัวเอง</span>
          </Link>
          <Link
            href="/rules"
            className="rounded-2xl border-2 border-gray-200 p-6 flex flex-col items-center gap-1.5 text-center hover:border-brand-400 transition"
          >
            <span className="text-4xl">📖</span>
            <span className="font-bold text-lg">Tua Tueng Info</span>
            <span className="text-xs text-gray-500">กฎของก๊วน / สนาม · อ่านก่อนมาตี</span>
          </Link>
        </div>
      </div>

      <AnnouncementCarousel items={announcements} />

      <p className="text-right text-[11px] text-gray-400 mt-auto pt-2">{BUILD_LABEL}</p>
    </main>
  );
}
