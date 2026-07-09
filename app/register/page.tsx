import { getCurrentOpenSessionId } from "@/lib/currentSession";
import SessionSignUpPage from "../session/[id]/(tabs)/page";

export default async function RegisterSignUpPage() {
  const id = await getCurrentOpenSessionId();
  if (!id) return null;
  return <SessionSignUpPage params={Promise.resolve({ id })} />;
}
