import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";

export const dynamic = "force-dynamic";

/** Log of self-signed-up names that were later withdrawn (admin quick-adds are
 *  excluded — this is for tracking members who pulled out). Newest first. */
export default async function WithdrawalsPage() {
  if (!(await isAdmin())) redirect("/admin/login");

  const rows = await prisma.signUp.findMany({
    where: { status: "WITHDRAWN", addedByAdmin: false },
    orderBy: [{ withdrawnAt: "desc" }, { createdAt: "desc" }],
    include: { session: { select: { date: true, venue: true } } },
    take: 300,
  });

  const dayLabel = (d: Date) =>
    d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  const timeLabel = (d: Date | null) =>
    d
      ? d.toLocaleString("th-TH", {
          day: "numeric",
          month: "short",
          hour: "2-digit",
          minute: "2-digit",
          timeZone: "Asia/Bangkok",
        })
      : "—";

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-4">
      <h1 className="text-xl font-bold">🚫 ประวัติถอนชื่อ</h1>
      <p className="text-sm text-gray-500 -mt-2">
        เฉพาะคนที่ลงชื่อเองผ่านเว็บแล้วถอนทีหลัง (ไม่รวมคนที่แอดมินเพิ่มให้) · ใหม่สุดอยู่บน
      </p>

      {rows.length === 0 ? (
        <p className="text-sm text-gray-400">ยังไม่มีประวัติถอนชื่อ</p>
      ) : (
        <div className="overflow-x-auto border border-gray-100 rounded-md">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                <th className="px-2 py-1.5 font-medium">ชื่อ</th>
                <th className="px-2 py-1.5 font-medium">วันเล่นที่ถอน</th>
                <th className="px-2 py-1.5 font-medium">ช่วง</th>
                <th className="px-2 py-1.5 font-medium">ถอนเมื่อ</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-50">
                  <td className="px-2 py-1.5 font-medium">{r.name}</td>
                  <td className="px-2 py-1.5 text-gray-600">
                    {dayLabel(r.session.date)} · {r.session.venue}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500">
                    {r.preferredSlot === "EARLY" ? "1 ทุ่ม" : "2 ทุ่ม"}
                  </td>
                  <td className="px-2 py-1.5 text-gray-500">{timeLabel(r.withdrawnAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
