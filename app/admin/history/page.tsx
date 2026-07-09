import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import DeleteSessionButton from "../DeleteSessionButton";

export default async function HistoryPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const sessions = await prisma.session.findMany({
    where: { status: "CLOSED" },
    orderBy: { date: "desc" },
    include: { signUps: { where: { status: "CONFIRMED" } } },
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">ประวัติสนามย้อนหลัง</h1>

      {sessions.length === 0 && <p className="text-gray-500 text-sm">ยังไม่มีรอบเล่นที่ปิดแล้ว</p>}

      <ul className="flex flex-col gap-3">
        {sessions.map((s) => (
          <li
            key={s.id}
            className="relative rounded-lg border border-gray-200 hover:border-brand-400 hover:shadow-sm transition"
          >
            <Link href={`/session/${s.id}/admin`} className="block p-4">
              <div className="flex items-center justify-between pr-10">
                <span className="font-semibold">{s.venue}</span>
                <span className="text-sm text-gray-500">{s.signUps.length} คน</span>
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
              {s.totalCost != null && (
                <div className="text-sm text-brand-700 mt-1 font-medium">
                  ค่าใช้จ่ายรวม {s.totalCost.toLocaleString()} บาท
                </div>
              )}
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
