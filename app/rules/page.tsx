import Link from "next/link";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function RulesPage() {
  const rules = await prisma.announcement.findMany({
    where: { kind: "rule", active: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-5">
      <Link href="/" className="text-sm text-gray-500 hover:underline">
        ← กลับหน้าแรก
      </Link>
      <h1 className="text-xl font-bold">📖 กฎของก๊วน / สนาม</h1>

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
