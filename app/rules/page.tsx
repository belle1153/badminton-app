import { prisma } from "@/lib/db";
import BackLink from "../BackLink";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  // Images served from /api/announcements/[id]/image (cached), not inlined —
  // see the same pattern on the home page.
  const rows = await prisma.announcement.findMany({
    where: { kind: "rule", active: true },
    orderBy: { createdAt: "asc" },
    select: { id: true, title: true, body: true, updatedAt: true },
  });
  const withImage = new Set(
    (
      await prisma.announcement.findMany({
        where: { kind: "rule", active: true, imageUrl: { not: null } },
        select: { id: true },
      })
    ).map((a) => a.id)
  );
  const rules = rows.map((r) => ({
    ...r,
    imageUrl: withImage.has(r.id)
      ? `/api/announcements/${r.id}/image?v=${r.updatedAt.getTime()}`
      : null,
  }));

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-5">
      <BackLink href="/" label="หน้าแรก" exact />
      <h1 className="text-xl font-bold">📖 Tua Tueng Info</h1>
      <p className="text-sm text-gray-500 -mt-4">กฎของก๊วน / สนาม</p>

      {rules.length === 0 ? (
        <p className="text-sm text-gray-400">ยังไม่มีกฎประกาศไว้ครับ</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rules.map((r) => (
            <section key={r.id} className="rounded-lg border border-gray-200 p-4 flex flex-col gap-2">
              <h2 className="font-semibold">{r.title}</h2>
              {r.body && <p className="text-sm text-gray-700 whitespace-pre-wrap">{r.body}</p>}
              {r.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.imageUrl} alt={r.title} className="rounded-md w-full object-contain" />
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
