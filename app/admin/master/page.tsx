import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import MasterDataForm from "./MasterDataForm";

export default async function MasterDataPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const settings = await prisma.appSettings.findUnique({ where: { id: "singleton" } });

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <h1 className="text-xl font-bold">Master ข้อมูล (ค่าใช้จ่าย)</h1>
      <MasterDataForm
        qrImageDataUrl={settings?.qrImageDataUrl ?? null}
        entryFee={settings?.entryFee ?? 95}
        gameFee={settings?.gameFee ?? 25}
      />
    </main>
  );
}
