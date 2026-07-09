import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import DeleteSessionButton from "./DeleteSessionButton";

export default async function AdminDashboardPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const sessions = await prisma.session.findMany({
    where: { status: "OPEN" },
    orderBy: { date: "desc" },
    include: { signUps: { where: { status: "CONFIRMED" } } },
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <Link href="/" className="text-sm text-gray-500 hover:text-brand-700 self-start">
        ← หน้าแรก
      </Link>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">แผงแอดมิน</h1>
        <div className="flex gap-3 text-sm items-center">
          <Link href="/admin/athletes" className="text-brand-700 hover:underline">
            ข้อมูลผู้เล่น
          </Link>
          <Link href="/admin/master" className="text-brand-700 hover:underline">
            Master ข้อมูล
          </Link>
          <Link href="/admin/history" className="text-brand-700 hover:underline">
            ประวัติย้อนหลัง
          </Link>
          <Link
            href="/session/new"
            className="rounded-md bg-brand-600 text-white px-4 py-2 font-medium hover:bg-brand-700"
          >
            + สร้างรอบใหม่
          </Link>
        </div>
      </div>

      {sessions.length === 0 && (
        <p className="text-gray-500 text-sm">
          ยังไม่มีรอบเล่นที่เปิดอยู่ กดสร้างรอบใหม่ได้เลยครับ (ดูรอบที่ปิดแล้วได้ที่{" "}
          <Link href="/admin/history" className="underline">
            ประวัติย้อนหลัง
          </Link>
          )
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="relative rounded-lg border border-gray-200 hover:border-brand-400 hover:shadow-sm transition"
          >
            <Link href={`/session/${s.id}/admin`} className="block p-4">
              <div className="flex items-center justify-between pr-10">
                <span className="font-semibold">{s.venue}</span>
                <span className="flex items-center gap-2">
                  <span
                    className={`text-xs rounded-full px-2 py-0.5 ${
                      s.status === "CLOSED"
                        ? "bg-gray-200 text-gray-600"
                        : "bg-brand-100 text-brand-700"
                    }`}
                  >
                    {s.status === "CLOSED" ? "ปิดแล้ว" : "เปิดอยู่"}
                  </span>
                  <span className="text-sm text-gray-500">
                    {s.signUps.length}/{s.maxPlayers} คน
                  </span>
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
            </Link>
            <div className="absolute top-4 right-4">
              <DeleteSessionButton sessionId={s.id} venue={s.venue} />
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
