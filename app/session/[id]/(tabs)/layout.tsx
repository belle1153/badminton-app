import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import TabBar from "../TabBar";

export default async function SessionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  if (!session) notFound();

  const isClosed = session.status === "CLOSED";

  return (
    <div className="flex flex-col min-h-full">
      <main className="max-w-2xl mx-auto w-full p-6 pb-24 flex flex-col gap-6 flex-1">
        <Link href="/" className="text-sm text-gray-500 hover:underline">
          ← กลับ
        </Link>

        <div>
          <h1 className="text-xl font-bold">{session.venue}</h1>
          <p className="text-sm text-gray-600">
            {new Date(session.date).toLocaleDateString("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · เริ่ม {session.startTime} น. · Max {session.maxPlayers} คน
          </p>
          {session.courtConfigNote && (
            <p className="text-sm text-gray-500 mt-1">{session.courtConfigNote}</p>
          )}
          {session.remark && <p className="text-sm text-gray-500 mt-1">Remark: {session.remark}</p>}
          {isClosed && (
            <p className="text-xs mt-2 inline-block rounded-full bg-gray-200 text-gray-600 px-2 py-0.5">
              ปิดรับลงชื่อแล้ว
            </p>
          )}
        </div>

        {children}
      </main>

      <TabBar />
    </div>
  );
}
