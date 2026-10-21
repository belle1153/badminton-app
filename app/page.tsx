import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { BUILD_LABEL } from "@/lib/version";
import { latestEventForHome } from "@/lib/games/load";
import { isAdmin } from "@/lib/adminAuth";
import AnnouncementCarousel from "./AnnouncementCarousel";
import MyStatsCard from "./MyStatsCard";

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
  const games = await latestEventForHome();
  // While the event is still "Coming soon", admins can open it to test the player pages.
  const adminPreview = games != null && !games.published && (await isAdmin());

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

        <div className="grid grid-cols-2 gap-4">
          <MyStatsCard />
          <Link
            href="/leaderboard"
            className="rounded-2xl border-2 border-sky-400 bg-[#141d2b] p-6 flex flex-col items-center gap-1.5 text-center shadow-[0_0_16px_rgba(79,159,230,0.35)] hover:border-sky-300 hover:shadow-[0_0_22px_rgba(79,159,230,0.55)] transition"
          >
            <span className="text-4xl">🏆</span>
            <span className="font-bold text-lg text-sky-300">อันดับโคตรตึง!</span>
            <span className="text-xs text-slate-400">อันดับทุกคนในก๊วน</span>
          </Link>
        </div>

        {/* TUA TUENG GAMES: a link once the admin publishes the event; until then
            a teaser players can see but not open (admins can, to test). */}
        {games?.published ? (
          <Link
            href={`/games/${games.id}`}
            className="rounded-2xl border-2 border-amber-300 bg-[#0b1c30] p-6 flex flex-col items-center gap-1.5 text-center shadow-[0_0_16px_rgba(255,207,77,0.3)] hover:border-amber-200 transition"
          >
            <span className="text-4xl">🏅</span>
            <span className="font-bold text-lg text-amber-300">{games.name}</span>
            <span className="text-xs text-slate-400">ตารางแข่ง ผล และตารางคะแนนทีม</span>
          </Link>
        ) : games && adminPreview ? (
          <Link
            href={`/games/${games.id}`}
            className="rounded-2xl border-2 border-dashed border-amber-300 bg-[#0b1c30] p-6 flex flex-col items-center gap-1.5 text-center hover:border-amber-200 transition"
          >
            <span className="text-4xl opacity-70">🏅</span>
            <span className="font-bold text-lg text-slate-200">{games.name}</span>
            <span className="rounded-full bg-amber-300 px-3 py-0.5 text-xs font-bold text-[#0b1c30]">Coming soon</span>
            <span className="text-xs text-amber-300">แอดมินกดเข้าดูได้ · ผู้เล่นยังกดไม่ได้</span>
          </Link>
        ) : (
          <div
            aria-disabled="true"
            className="rounded-2xl border-2 border-dashed border-slate-500 bg-[#0b1c30] p-6 flex flex-col items-center gap-1.5 text-center"
          >
            <span className="text-4xl opacity-70">🏅</span>
            <span className="font-bold text-lg text-slate-200">{games?.name ?? "TUA TUENG GAMES"}</span>
            <span className="rounded-full bg-amber-300 px-3 py-0.5 text-xs font-bold text-[#0b1c30]">Coming soon</span>
          </div>
        )}
      </div>

      <AnnouncementCarousel items={announcements} />

      {/* Doubles as the admin's way back in: the proxy 404s /admin when logged
          out, so there's no visible admin link — tapping the build label opens
          the PIN page. Unobtrusive to everyone else; /admin/login is the one
          open admin path anyway. */}
      <Link
        href="/admin/login"
        className="block text-right text-[11px] text-gray-400 mt-auto pt-2 hover:text-gray-600"
      >
        {BUILD_LABEL}
      </Link>
    </main>
  );
}
