import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { selfWithdrawAllowed } from "@/lib/withdrawPolicy";
import { blockCapacities } from "@/lib/capacity";
import { WAITLIST_LIMIT } from "@/lib/signup";
import SignUpForm from "../SignUpForm";
import { registrationIsOpen, formatOpensAt } from "@/lib/registration";
import WithdrawForm from "../WithdrawForm";

export const dynamic = "force-dynamic";

// Reserves are listed under the block they'd play in, tagged like the admin
// check-in list — no seat number, since they don't hold a seat yet.
function WaitlistRow({ name }: { name: string }) {
  return (
    <li className="flex items-center justify-between gap-2 text-sm border-b border-gray-100 py-1">
      <span className="text-gray-500">{name}</span>
      <span className="text-xs rounded-full bg-gray-200 text-gray-600 px-1.5 py-0.5 shrink-0">
        สำรอง
      </span>
    </li>
  );
}

export default async function SessionSignUpPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await prisma.session.findUnique({
    where: { id },
    include: { signUps: { where: { status: { not: "WITHDRAWN" } } } },
  });

  if (!session) notFound();

  const isClosed = session.status === "CLOSED";
  const registrationClosed = session.registrationClosedAt != null;
  const deadlinePassed = !selfWithdrawAllowed(session.date);

  const confirmed = session.signUps
    .filter((s) => s.status === "CONFIRMED")
    .sort((a, b) => (a.slotNumber ?? 0) - (b.slotNumber ?? 0));
  const waitlist = session.signUps
    .filter((s) => s.status === "WAITLIST")
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

  // Group reserves by the block they hold, same rule as the admin check-in list.
  const earlyWaitlist = waitlist.filter((s) => s.timeSlot === "EARLY");
  const lateWaitlist = waitlist.filter((s) => s.timeSlot === "LATE");

  const { earlyCapacity, totalCapacity } = blockCapacities(session);
  const slotAt = (slotNumber: number) =>
    confirmed.find((s) => s.slotNumber === slotNumber) ?? null;
  const earlySlots = Array.from({ length: earlyCapacity }, (_, i) => slotAt(i + 1));
  const lateSlots = Array.from({ length: Math.max(0, totalCapacity - earlyCapacity) }, (_, i) =>
    slotAt(earlyCapacity + i + 1)
  );

  return (
    <>
      {!isClosed && (
        <>
          {registrationClosed && (
            <p className="text-sm text-amber-600">
              ปิดรับสมัครหลักแล้ว — ลงชื่อตอนนี้จะเข้าคิวเป็นตัวสำรองครับ
            </p>
          )}
          {registrationIsOpen(session.date) ? (
            <SignUpForm sessionId={id} />
          ) : (
            <div className="rounded-lg border-2 border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <p className="font-semibold">🔒 ยังไม่เปิดให้ลงชื่อ</p>
              <p>เปิดลงชื่อ {formatOpensAt(session.date)} — ระบบเปิดทุกวันศุกร์ 11.00 น. ครับ</p>
            </div>
          )}
          <WithdrawForm
            sessionId={id}
            signUps={session.signUps.map((s) => ({ id: s.id, name: s.name }))}
            deadlinePassed={deadlinePassed}
          />
        </>
      )}

      <section>
        <h2 className="font-semibold mb-2">
          รอบ 1 ทุ่ม ({earlySlots.filter(Boolean).length}/{earlyCapacity})
        </h2>
        <ol className="flex flex-col gap-1 list-none">
          {earlySlots.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm border-b border-gray-100 py-1"
            >
              <span>
                {i + 1}. {s ? s.name : <span className="text-gray-300">—</span>}
              </span>
            </li>
          ))}
          {earlyWaitlist.map((s) => (
            <WaitlistRow key={s.id} name={s.name} />
          ))}
        </ol>
      </section>

      {lateSlots.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">
            รอบ 2 ทุ่ม ({lateSlots.filter(Boolean).length}/{lateSlots.length})
          </h2>
          <ol className="flex flex-col gap-1 list-none">
            {lateSlots.map((s, i) => (
              <li
                key={i}
                className="flex items-center justify-between text-sm border-b border-gray-100 py-1"
              >
                <span>
                  {earlyCapacity + i + 1}. {s ? s.name : <span className="text-gray-300">—</span>}
                  {s && s.preferredSlot === "EARLY" && (
                    <span className="text-xs text-amber-600 ml-2">(จองคิว 1 ทุ่ม)</span>
                  )}
                </span>
              </li>
            ))}
            {lateWaitlist.map((s) => (
              <WaitlistRow key={s.id} name={s.name} />
            ))}
          </ol>
        </section>
      )}

      {waitlist.length > 0 && (
        <p className="text-sm text-gray-500">
          สำรอง {waitlist.length}/{WAITLIST_LIMIT} · ถ้ามีคนถอน ระบบจะเลื่อนคิวให้อัตโนมัติตามลำดับที่ลงชื่อ
        </p>
      )}
    </>
  );
}
