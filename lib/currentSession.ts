import { prisma } from "@/lib/db";

/** The session shown at the permanent /register link: the most recently created OPEN session. */
export async function getCurrentOpenSessionId(): Promise<string | null> {
  const session = await prisma.session.findFirst({
    where: { status: "OPEN" },
    orderBy: { createdAt: "desc" },
    select: { id: true },
  });
  return session?.id ?? null;
}
