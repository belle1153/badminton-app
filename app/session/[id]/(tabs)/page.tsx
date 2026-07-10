import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { SKILL_LABELS } from "@/lib/matching";
import { selfWithdrawAllowed } from "@/lib/withdrawPolicy";
import SignUpForm from "../SignUpForm";
import WithdrawButton from "../WithdrawButton";

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

  const slots = Array.from({ length: session.maxPlayers }, (_, i) => {
    const slotNumber = i + 1;
    return confirmed.find((s) => s.slotNumber === slotNumber) ?? null;
  });

  return (
    <>
      {!isClosed && (
        <>
          {registrationClosed && (
            <p className="text-sm text-amber-600">
              ปิดรับสมัครหลักแล้ว — ลงชื่อตอนนี้จะเข้าคิวเป็นตัวสำรองครับ
            </p>
          )}
          <SignUpForm sessionId={id} />
          <p className="text-xs text-gray-400">
            ถอนชื่อเองได้จากเครื่องที่ใช้ลงชื่อ ภายในเที่ยงวันตีเท่านั้น — หลังจากนั้นแจ้งแอดมิน
            (มีค่าธรรมเนียม 100 บาท ยกเว้นหาคนมาแทนได้)
          </p>
        </>
      )}

      <section>
        <h2 className="font-semibold mb-2">
          รายชื่อ ({confirmed.length}/{session.maxPlayers})
        </h2>
        <ol className="flex flex-col gap-1">
          {slots.map((s, i) => (
            <li
              key={i}
              className="flex items-center justify-between text-sm border-b border-gray-100 py-1"
            >
              <span>
                {i + 1}. {s ? s.name : <span className="text-gray-300">—</span>}
                {s && (
                  <span className="text-xs text-gray-400 ml-2">
                    {SKILL_LABELS[s.skillLevel as keyof typeof SKILL_LABELS]}
                  </span>
                )}
              </span>
              {s && !isClosed && (
                <WithdrawButton sessionId={id} signUpId={s.id} deadlinePassed={deadlinePassed} />
              )}
            </li>
          ))}
        </ol>
      </section>

      {waitlist.length > 0 && (
        <section>
          <h2 className="font-semibold mb-2">รายชื่อสำรอง ({waitlist.length})</h2>
          <ol className="flex flex-col gap-1">
            {waitlist.map((s, i) => (
              <li
                key={s.id}
                className="flex items-center justify-between text-sm border-b border-gray-100 py-1"
              >
                <span>
                  {i + 1}. {s.name}
                  <span className="text-xs text-gray-400 ml-2">
                    {SKILL_LABELS[s.skillLevel as keyof typeof SKILL_LABELS]}
                  </span>
                </span>
                {!isClosed && (
                  <WithdrawButton sessionId={id} signUpId={s.id} deadlinePassed={deadlinePassed} />
                )}
              </li>
            ))}
          </ol>
        </section>
      )}
    </>
  );
}
