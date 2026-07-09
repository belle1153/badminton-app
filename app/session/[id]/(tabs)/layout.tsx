import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import SessionShell from "../../SessionShell";

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

  return (
    <SessionShell base={`/session/${id}`} session={session}>
      {children}
    </SessionShell>
  );
}
