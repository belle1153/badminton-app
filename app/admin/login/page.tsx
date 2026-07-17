import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import PinGate from "../PinGate";
import BackLink from "../../BackLink";

export default async function AdminLoginPage() {
  if (await isAdmin()) {
    redirect("/admin");
  }
  return (
    <>
      <div className="max-w-sm mx-auto w-full px-6 pt-6">
        <BackLink href="/" label="หน้าแรก" exact />
      </div>
      <PinGate redirectTo="/admin" />
    </>
  );
}
