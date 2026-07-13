import Link from "next/link";
import { prisma } from "@/lib/db";
import { blockCapacities } from "@/lib/capacity";
import { WAITLIST_LIMIT } from "@/lib/signup";
import MultiSignUpForm from "./MultiSignUpForm";
import AutoRefresh from "../session/AutoRefresh";
import AnnouncementCarousel from "../AnnouncementCarousel";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const [sessions, announcements] = await Promise.all([
    prisma.session.findMany({
      where: { status: "OPEN" },
      orderBy: { date: "asc" },
      include: { signUps: { where: { status: { not: "WITHDRAWN" } } } },
    }),
    prisma.announcement.findMany({ where: { active: true }, orderBy: { createdAt: "desc" } }),
  ]);

  if (sessions.length === 0) {
    return (
      <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-4">
        <h1 className="text-xl font-bold">🏸 TUATUENG REGISTER</h1>
        <AnnouncementCarousel items={announcements} />
        <p className="text-gray-500 text-sm">ยังไม่มีรอบเล่นเปิดอยู่ตอนนี้ กลับมาดูใหม่เร็วๆ นี้ครับ</p>
      </main>
    );
  }

  const days = sessions.map((s) => {
    const { earlyCapacity, totalCapacity } = blockCapacities(s);
    const confirmed = s.signUps.filter((x) => x.status === "CONFIRMED");
    const earlyCount = confirmed.filter((x) => x.timeSlot === "EARLY").length;
    const lateCount = confirmed.filter((x) => x.timeSlot === "LATE").length;
    const waitlistCount = s.signUps.filter((x) => x.status === "WAITLIST").length;
    const dayLabel = new Date(s.date).toLocaleDateString("th-TH", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    const shortLabel = new Date(s.date).toLocaleDateString("th-TH", {
      weekday: "long",
      day: "numeric",
      month: "short",
    });
    return {
      id: s.id,
      dayLabel,
      shortLabel,
      venue: s.venue,
      earlyCount,
      earlyCapacity,
      lateCount,
      lateCapacity: Math.max(0, totalCapacity - earlyCapacity),
      waitlistCount,
      registrationClosed: s.registrationClosedAt != null,
    };
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <AutoRefresh />
      <h1 className="text-xl font-bold">🏸 TUATUENG REGISTER</h1>

      <AnnouncementCarousel items={announcements} />

      <p className="text-sm text-gray-600">
        ลงชื่อครั้งเดียว เลือกได้ทั้งสองวัน — ติ๊กวันที่จะไป แล้วเลือกเวลา (1 ทุ่ม / 2 ทุ่ม)
      </p>

      <MultiSignUpForm days={days.map((d) => ({ id: d.id, label: d.shortLabel }))} />

      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex flex-col gap-1.5">
        <p className="font-semibold text-sm">📌 การถอนชื่อ</p>
        <p>
          • ถอนชื่อเองได้ถึง <strong>12.00 น. ของวันที่ตี</strong> — พิมพ์ชื่อให้เหมือนตอนลงชื่อ
          จากเครื่องที่ใช้ลงชื่อได้เลย
        </p>
        <p>
          • ถอนหลัง 12.00 น. <strong>ขออนุญาตหารค่าคอร์ท 100 บาท</strong> (ยกเว้นหาคนมาแทนได้) —
          ติดต่อแอดมินเพื่อกด accept การถอนชื่อครับ
        </p>
      </div>

      <section className="flex flex-col gap-3">
        {days.map((d) => (
          <Link
            key={d.id}
            href={`/session/${d.id}`}
            className="block rounded-lg border border-gray-200 p-4 hover:border-brand-400 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{d.dayLabel}</span>
              <span className="text-xs text-brand-700">ดูรายชื่อ / สนาม / ค่าใช้จ่าย →</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              1 ทุ่ม {d.earlyCount}/{d.earlyCapacity} · 2 ทุ่ม {d.lateCount}/{d.lateCapacity} · สำรอง{" "}
              {d.waitlistCount}/{WAITLIST_LIMIT}
              {d.registrationClosed && <span className="text-amber-600 ml-2">ปิดรับหลักแล้ว</span>}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
