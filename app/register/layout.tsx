import { prisma } from "@/lib/db";
import { getCurrentOpenSessionId } from "@/lib/currentSession";
import SessionShell from "../session/SessionShell";

export default async function RegisterLayout({ children }: { children: React.ReactNode }) {
  const id = await getCurrentOpenSessionId();

  if (!id) {
    return (
      <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-4">
        <h1 className="text-xl font-bold">🏸 TUATUENG REGISTER</h1>
        <p className="text-gray-500 text-sm">ยังไม่มีรอบเล่นเปิดอยู่ตอนนี้ กลับมาดูใหม่เร็วๆ นี้ครับ</p>
      </main>
    );
  }

  const session = await prisma.session.findUnique({
    where: { id },
    select: {
      venue: true,
      date: true,
      startTime: true,
      maxPlayers: true,
      courtConfigNote: true,
      remark: true,
      status: true,
    },
  });

  if (!session) {
    return (
      <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-4">
        <h1 className="text-xl font-bold">🏸 TUATUENG REGISTER</h1>
        <p className="text-gray-500 text-sm">ยังไม่มีรอบเล่นเปิดอยู่ตอนนี้ กลับมาดูใหม่เร็วๆ นี้ครับ</p>
      </main>
    );
  }

  return (
    <SessionShell base="/register" session={session}>
      {children}
    </SessionShell>
  );
}
