import Link from "next/link";
import AdminTabBar from "./AdminTabBar";
import AutoRefresh from "../../AutoRefresh";

interface SessionInfo {
  venue: string;
  date: Date;
  startTime: string;
  maxPlayers: number;
  status: string;
}

export default function AdminShell({
  base,
  sessionId,
  session,
  children,
}: {
  base: string;
  sessionId: string;
  session: SessionInfo;
  children: React.ReactNode;
}) {
  const isClosed = session.status === "CLOSED";

  return (
    <div className="flex flex-col min-h-full">
      <AutoRefresh />
      <main className="max-w-2xl mx-auto w-full p-6 pb-24 flex flex-col gap-5 flex-1">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="text-sm text-gray-500 hover:underline">
            ← แผงแอดมิน
          </Link>
          <Link
            href={`/session/${sessionId}`}
            className="flex items-center gap-1.5 rounded-md border border-gray-300 text-gray-600 px-3 py-1.5 text-sm font-medium hover:bg-gray-50 hover:text-brand-700"
          >
            🧑 ดูหน้า User
          </Link>
        </div>

        <div>
          <h1 className="text-xl font-bold">
            แอดมิน: {session.venue}{" "}
            {isClosed && (
              <span className="text-xs rounded-full bg-gray-200 text-gray-600 px-2 py-0.5 align-middle">
                ปิดแล้ว
              </span>
            )}
          </h1>
          <p className="text-sm text-gray-600">
            {new Date(session.date).toLocaleDateString("th-TH", {
              weekday: "long",
              day: "numeric",
              month: "long",
              year: "numeric",
            })}{" "}
            · เริ่ม {session.startTime} น. · Max {session.maxPlayers} คน
          </p>
        </div>

        {children}
      </main>

      <AdminTabBar base={base} />
    </div>
  );
}
