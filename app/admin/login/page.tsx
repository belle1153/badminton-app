import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "../PinGate";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }
  return (
    <>
      <div className="max-w-sm mx-auto w-full px-6 pt-6">
        <Link href="/" className="text-sm text-gray-500 hover:text-brand-700">
          ← หน้าแรก
        </Link>
      </div>
      <PinGate redirectTo="/admin" />
    </>
  );
}
