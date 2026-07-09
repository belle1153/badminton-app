import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "../PinGate";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }
  return <PinGate redirectTo="/admin" />;
}
