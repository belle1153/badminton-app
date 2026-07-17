import { isAdmin } from "@/lib/adminAuth";
import PinGate from "@/app/admin/PinGate";
import NewSessionForm from "./NewSessionForm";
import BackLink from "../../BackLink";

export default async function NewSessionPage() {
  if (!(await isAdmin())) {
    return <PinGate />;
  }
  return (
    <>
      <div className="max-w-lg mx-auto w-full px-6 pt-6">
        <BackLink href="/admin" label="หน้าแอดมิน" exact />
      </div>
      <NewSessionForm />
    </>
  );
}
