import Link from "next/link";
import Image from "next/image";
import { prisma } from "@/lib/db";
import { blockCapacities } from "@/lib/capacity";
import { WAITLIST_LIMIT } from "@/lib/signup";
import { registrationIsOpen, formatOpensAt } from "@/lib/registration";
import MultiSignUpForm from "./MultiSignUpForm";
import AutoRefresh from "../session/AutoRefresh";
import BackLink from "../BackLink";

export const dynamic = "force-dynamic";

export default async function RegisterPage() {
  const sessions = await prisma.session.findMany({
    where: { status: "OPEN" },
    orderBy: { date: "asc" },
    include: { signUps: { where: { status: { not: "WITHDRAWN" } } } },
  });

  if (sessions.length === 0) {
    return (
      <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-4">
        <BackLink href="/" label="หน้าแรก" exact />
        <h1>
          <Image src="/logouser.png" alt="TUATUENG GO!" width={1500} height={788} className="h-16 w-auto" />
        </h1>
        <p className="text-gray-500 text-sm">ยังไม่มีรอบเล่นเปิดอยู่ตอนนี้ กลับมาดูใหม่เร็วๆ นี้ครับ</p>
        <p className="text-gray-500 text-sm">
          🕚 ระบบเปิดให้ลงชื่อทุกวันศุกร์ <strong>11.00 น.</strong> ครับ
        </p>
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
      startTime: s.startTime,
      earlyCount,
      earlyCapacity,
      lateCount,
      lateCapacity: Math.max(0, totalCapacity - earlyCapacity),
      waitlistCount,
      registrationClosed: s.registrationClosedAt != null,
      // null once the Friday 11:00 gate has passed for this day.
      opensAtLabel: registrationIsOpen(s.date) ? null : formatOpensAt(s.date),
    };
  });
  const allLocked = days.length > 0 && days.every((d) => d.opensAtLabel != null);

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <AutoRefresh />
      <BackLink href="/" label="หน้าแรก" exact />
      <h1>
          <Image src="/logouser.png" alt="TUATUENG GO!" width={1500} height={788} className="h-16 w-auto" />
        </h1>

      <p className="text-sm text-gray-600">
        ลงชื่อครั้งเดียว เลือกได้ทั้งสองวัน — ติ๊กวันที่จะไป แล้วเลือกเวลา (1 ทุ่ม / 2 ทุ่ม)
      </p>

      <div
        className={`rounded-lg border p-3 text-xs ${
          allLocked ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-200 bg-blue-50 text-blue-900"
        }`}
      >
        <p>
          🕚 ระบบเปิดให้ลงชื่อ <strong>ทุกวันศุกร์ 11.00 น.</strong> — ก่อนเวลานี้ลงชื่อไม่ได้ครับ
        </p>
        {allLocked && (
          <p className="mt-1 font-semibold">
            ตอนนี้ยังไม่เปิด — เปิด {days[0].opensAtLabel}
          </p>
        )}
      </div>

      <MultiSignUpForm
        days={days.map((d) => ({ id: d.id, label: d.shortLabel, opensAtLabel: d.opensAtLabel }))}
      />

      <section className="flex flex-col gap-3">
        {days.map((d) => (
          <Link
            key={d.id}
            href={`/session/${d.id}`}
            className="block rounded-lg border border-gray-200 p-4 hover:border-brand-400 hover:shadow-sm transition"
          >
            <div className="flex items-center justify-between">
              <span className="font-semibold">{d.dayLabel}</span>
              <span className="text-xs text-gray-400">{d.venue}</span>
            </div>
            <div className="text-sm text-gray-600 mt-1">
              เริ่ม {d.startTime} น. · 1 ทุ่ม {d.earlyCount}/{d.earlyCapacity} · 2 ทุ่ม {d.lateCount}/
              {d.lateCapacity} · สำรอง {d.waitlistCount}/{WAITLIST_LIMIT}
              {d.registrationClosed && <span className="text-amber-600 ml-2">ปิดรับหลักแล้ว</span>}
            </div>
          </Link>
        ))}
      </section>
    </main>
  );
}
