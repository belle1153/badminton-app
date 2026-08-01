import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import { pendingAnnouncements } from "@/lib/registrationAnnounce";
import { envProblems } from "@/lib/envHealth";
import DeleteSessionButton from "./DeleteSessionButton";
import AnnounceRegistrationButton from "./AnnounceRegistrationButton";

export default async function AdminDashboardPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const [sessions, pending] = await Promise.all([
    prisma.session.findMany({
      where: { status: "OPEN" },
      orderBy: { date: "desc" },
      include: { signUps: { where: { status: "CONFIRMED" } } },
    }),
    // Surfaced on the button so a failed automatic send is visible at a glance
    // instead of only when someone thinks to press it.
    pendingAnnouncements(),
  ]);
  // Reads only whether each key is set, never its value.
  const problems = envProblems();

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold">แผงแอดมิน</h1>
        <Link
          href="/session/new"
          className="rounded-md bg-brand-600 text-white px-4 py-2 font-medium hover:bg-brand-700"
        >
          + สร้างรอบใหม่
        </Link>
      </div>

      {problems.length > 0 && (
        <section className="flex flex-col gap-2 rounded-lg border border-red-200 bg-red-50 p-3">
          <h2 className="text-sm font-semibold text-red-800">
            🔐 ตั้งค่าที่ยังขาด ({problems.length})
          </h2>
          <ul className="flex flex-col gap-1.5">
            {problems.map((p) => (
              <li key={p.key} className="text-xs text-red-900">
                <code className="rounded bg-white px-1 py-0.5 font-mono">{p.key}</code>
                {p.severity === "critical" && (
                  <span className="ml-1.5 rounded-full bg-red-200 px-1.5 py-0.5 text-[10px] font-medium">
                    สำคัญ
                  </span>
                )}
                <span className="block text-red-800">{p.impact}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-red-700">
            ใส่ที่ Vercel → Settings → Environment Variables แล้ว redeploy · แอปทำงานได้โดยไม่มีก็จริง
            แต่ส่วนที่เขียนไว้ข้างบนจะอ่อนลงเงียบๆ
          </p>
        </section>
      )}

      <AnnounceRegistrationButton pending={pending} />

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
