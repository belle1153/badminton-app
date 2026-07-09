import Link from "next/link";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "@/app/admin/PinGate";
import NewSessionForm from "./NewSessionForm";

export default async function NewSessionPage() {
  if (!(await isAdmin())) {
    return <PinGate />;
  }
  return (
    <>
      <div className="max-w-lg mx-auto w-full px-6 pt-6">
        <Link href="/admin" className="text-sm text-gray-500 hover:text-brand-700">
          ← กลับหน้าแอดมิน
        </Link>
      </div>
      <NewSessionForm />
    </>
  );
}
