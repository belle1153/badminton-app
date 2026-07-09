import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/adminAuth";
import MasterDataForm from "./MasterDataForm";

export default async function MasterDataPage() {
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const [courtRates, shuttlecockTypes, settings] = await Promise.all([
    prisma.courtRate.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.shuttlecockType.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.appSettings.findUnique({ where: { id: "singleton" } }),
  ]);

  return (
    <main className="max-w-2xl mx-auto w-full p-6 flex flex-col gap-6">
      <Link href="/admin" className="text-sm text-gray-500 hover:underline">
        ← กลับไปแผงแอดมิน
      </Link>
      <h1 className="text-xl font-bold">Master ข้อมูล</h1>
      <MasterDataForm
        courtRates={courtRates}
        shuttlecockTypes={shuttlecockTypes}
        qrImageDataUrl={settings?.qrImageDataUrl ?? null}
      />
    </main>
  );
}
