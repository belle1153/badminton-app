import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import AnnouncementManager from "./AnnouncementManager";

export const dynamic = "force-dynamic";

/**
 * ประกาศ and กฎ share one page (and one nav slot): they are the same editor over
 * the same table, differing only by `kind`, and splitting them pushed the admin
 * nav wide enough that the last items could end up unreachable.
 */
export default async function AnnouncementsPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const [announcements, rules] = await Promise.all([
    prisma.announcement.findMany({
      where: { kind: "announcement" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.announcement.findMany({
      where: { kind: "rule" },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl font-bold">📣 ประกาศ / ประชาสัมพันธ์</h1>
          <p className="text-sm text-gray-500">
            ประกาศที่ &quot;แสดง&quot; จะขึ้นบนสุดของหน้าลงทะเบียนฝั่งผู้เล่น
          </p>
        </div>
        <AnnouncementManager announcements={announcements} />
      </section>

      <section className="flex flex-col gap-4 border-t border-gray-200 pt-8">
        <div className="flex flex-col gap-1">
          <h2 className="text-xl font-bold">📖 กฎของก๊วน / สนาม</h2>
          <p className="text-sm text-gray-500">
            หัวข้อที่ &quot;แสดง&quot; จะขึ้นในหน้า &quot;กฎของก๊วน&quot; ฝั่งผู้เล่น
          </p>
        </div>
        <AnnouncementManager announcements={rules} kind="rule" addLabel="เพิ่มกฎใหม่" />
      </section>
    </main>
  );
}
