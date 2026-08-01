import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import QuestManager from "./QuestManager";

export const dynamic = "force-dynamic";

export default async function QuestsAdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const quests = await prisma.quest.findMany({
    orderBy: [{ startDate: "desc" }, { createdAt: "desc" }],
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">🎯 เควสประจำเดือน / สัปดาห์</h1>
        <p className="text-sm text-gray-500">
          ตั้งภารกิจตามช่วงเวลา ใครทำสำเร็จได้ EXP เพิ่ม — ระบบคำนวณผู้ผ่านให้เอง
          ไม่ต้องมาติ๊กเอง และถ้าแก้ผลแมตซ์ย้อนหลัง ผลเควสจะอัปเดตตาม
        </p>
        <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
          หมดช่วงเวลาแล้วเควสหยุดเองอยู่แล้ว — ไม่มีใครทำสำเร็จเพิ่มได้
          และหายจากหน้าผู้เล่นเอง ไม่ต้องกดปิด
          <br />
          <b>ปิด</b> = ซ่อนจากหน้าผู้เล่นเฉยๆ EXP ที่แจกไปแล้วไม่หาย ·{" "}
          <b>ลบ</b> = ยกเลิกจริง EXP หายทั้งก๊วน
        </p>
      </div>

      <QuestManager
        initial={quests.map((q) => ({
          id: q.id,
          title: q.title,
          kind: q.kind,
          icon: q.icon,
          startDate: q.startDate.toISOString(),
          endDate: q.endDate.toISOString(),
          target: q.target,
          expReward: q.expReward,
          active: q.active,
        }))}
      />
    </main>
  );
}
