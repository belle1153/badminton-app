import Link from "next/link";
import { prisma } from "@/lib/db";
import AnnouncementCarousel from "./AnnouncementCarousel";

// Always read fresh data — without this the page is frozen at build time.
export const dynamic = "force-dynamic";

export default async function Home() {
  const [sessions, announcements] = await Promise.all([
    prisma.session.findMany({
      orderBy: { date: "desc" },
      include: { signUps: { where: { status: "CONFIRMED" } } },
    }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">🏸 TUATUENG REGISTER</h1>

      <AnnouncementCarousel items={announcements} />

      {sessions.length === 0 && (
        <p className="text-gray-500 text-sm">ยังไม่มีรอบเล่น กดสร้างรอบใหม่ได้เลยครับ</p>
      )}

      <ul className="flex flex-col gap-3">
        {sessions.map((s) => (
          <li key={s.id}>
            <Link
              href={`/session/${s.id}`}
              className="block rounded-lg border border-gray-200 p-4 hover:border-brand-400 hover:shadow-sm transition"
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{s.venue}</span>
                <span className="text-sm text-gray-500">
                  {s.signUps.length}/{s.maxPlayers} คน
                </span>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {new Date(s.date).toLocaleDateString("th-TH", {
                  weekday: "short",
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}{" "}
                · เริ่ม {s.startTime}
              </div>
              {s.courtConfigNote && (
                <div className="text-xs text-gray-500 mt-1">{s.courtConfigNote}</div>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
