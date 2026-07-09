import { isAdmin } from "@/lib/adminAuth";
import PinGate from "@/app/admin/PinGate";
import NewSessionForm from "./NewSessionForm";

export default async function NewSessionPage() {
  if (!(await isAdmin())) {
    return <PinGate />;
  }
  return <NewSessionForm />;
}
