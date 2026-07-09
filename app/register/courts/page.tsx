import { getCurrentOpenSessionId } from "@/lib/currentSession";
import SessionCourtsPage from "../../session/[id]/(tabs)/courts/page";

export default async function RegisterCourtsPage({
  searchParams,
}: {
  searchParams: Promise<{ round?: string }>;
}) {
  const id = await getCurrentOpenSessionId();
  if (!id) return null;
  return (
    <SessionCourtsPage
      params={Promise.resolve({ id })}
      searchParams={searchParams}
      basePath="/register/courts"
    />
  );
}
