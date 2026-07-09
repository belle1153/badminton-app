import { getCurrentOpenSessionId } from "@/lib/currentSession";
import SessionCostPage from "../../session/[id]/(tabs)/cost/page";

export default async function RegisterCostPage() {
  const id = await getCurrentOpenSessionId();
  if (!id) return null;
  return <SessionCostPage params={Promise.resolve({ id })} />;
}
