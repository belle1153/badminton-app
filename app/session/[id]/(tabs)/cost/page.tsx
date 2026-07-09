import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";

export default async function SessionCostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [session, settings] = await Promise.all([
    prisma.session.findUnique({
      where: { id },
      include: { signUps: { where: { status: "CONFIRMED" } } },
    }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  if (!session) notFound();

  if (session.status !== "CLOSED") {
    return <p className="text-sm text-gray-500">ยังไม่ปิดยอด รอแอดมินปิดวันก่อนครับ</p>;
  }

  const confirmed = session.signUps;
  const perPerson =
    session.totalCost != null && confirmed.length > 0
      ? Math.ceil(session.totalCost / confirmed.length)
      : null;

  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-semibold">สรุปค่าใช้จ่าย</h2>
      <div className="text-sm flex flex-col gap-1">
        <p>ค่าคอร์ท: {session.courtCost} บาท</p>
        <p>ค่าลูกแบด: {session.shuttlecockCost} บาท</p>
        {perPerson != null && (
          <p>
            รวม: {session.totalCost} บาท (หารเท่ากัน {confirmed.length} คน)
          </p>
        )}
      </div>
      {perPerson != null && (
        <ol className="flex flex-col gap-1">
          {confirmed.map((s) => (
            <li key={s.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-1">
              <span>{s.name}</span>
              <span className="font-medium">{perPerson} บาท</span>
            </li>
          ))}
        </ol>
      )}
      {settings?.qrImageDataUrl && (
        <div className="flex flex-col items-center gap-2 mt-2">
          <p className="text-sm text-gray-600">สแกนเพื่อโอนเงิน</p>
          <img
            src={settings.qrImageDataUrl}
            alt="PromptPay QR"
            className="w-56 h-56 object-contain border border-gray-200 rounded-md"
          />
        </div>
      )}
    </section>
  );
}
