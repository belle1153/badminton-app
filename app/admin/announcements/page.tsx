import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import AnnouncementManager from "./AnnouncementManager";

export const dynamic = "force-dynamic";

export default async function AnnouncementsPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const announcements = await prisma.announcement.findMany({
    where: { kind: "announcement" },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">ประกาศ / ประชาสัมพันธ์</h1>
      <p className="text-sm text-gray-500">ประกาศที่ &quot;แสดง&quot; จะขึ้นบนสุดของหน้าลงทะเบียนฝั่งผู้เล่น</p>
      <AnnouncementManager announcements={announcements} />
    </main>
  );
}
