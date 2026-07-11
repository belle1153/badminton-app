import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "@/app/admin/PinGate";
import AdminShell from "./AdminShell";

export const dynamic = "force-dynamic";

export default async function SessionAdminLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  if (!(await isAdmin())) {
    return <PinGate />;
  }

  const session = await prisma.session.findUnique({
    where: { id },
    select: { venue: true, date: true, startTime: true, maxPlayers: true, status: true },
  });

  if (!session) notFound();

  return (
    <AdminShell base={`/session/${id}/admin`} session={session}>
      {children}
    </AdminShell>
  );
}
