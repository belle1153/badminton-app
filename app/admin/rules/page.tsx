import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import AnnouncementManager from "../announcements/AnnouncementManager";

export const dynamic = "force-dynamic";

export default async function RulesAdminPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const rules = await prisma.announcement.findMany({
    where: { kind: "rule" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">กฎของก๊วน / สนาม</h1>
      <p className="text-sm text-gray-500">
        หัวข้อที่ &quot;แสดง&quot; จะขึ้นในหน้า &quot;กฎของก๊วน&quot; ฝั่งผู้เล่น
      </p>
      <AnnouncementManager announcements={rules} kind="rule" addLabel="เพิ่มกฎใหม่" />
    </main>
  );
}
