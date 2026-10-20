import { notFound, redirect } from "next/navigation";
import { isAdmin } from "@/lib/adminAuth";
import { loadGamesState } from "@/lib/games/load";
import { fmtMinute } from "@/lib/games/format";
import PrintButton from "./PrintButton";

export const dynamic = "force-dynamic";

/**
 * Blank result slips, one per rubber, four per A4 sheet — printed ahead of the
 * day. No athlete names (the organisers write them on the day): event, tie,
 * pair number, court, set boxes and both pairs' signatures.
 */
export default async function GamesSlipsPage({ params }: { params: Promise<{ eventId: string }> }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const { eventId } = await params;
  const state = await loadGamesState(eventId);
  if (!state) notFound();
  const teams = new Map(state.teams.map((t) => [t.id, t.name]));

  const slips = state.ties.flatMap((tie) =>
    tie.rubbers.map((r) => ({
      key: r.id,
      label: tie.label,
      order: r.order,
      court: r.court,
      time: fmtMinute(r.startMinute),
      sets: tie.stage === "QUALIFIER" ? 2 : 3,
      // Knockout teams change until the qualifier ends, so leave them to fill in.
      a: tie.stage === "QUALIFIER" ? teams.get(tie.teamAId ?? "") ?? "" : "",
      b: tie.stage === "QUALIFIER" ? teams.get(tie.teamBId ?? "") ?? "" : "",
    }))
  );

  return (
    <main className="max-w-3xl mx-auto w-full p-6 flex flex-col gap-4">
      <style>{`
        @page { size: A4; margin: 10mm; }
        @media print {
          body * { visibility: hidden; }
          .slips, .slips * { visibility: visible; }
          .slips { position: absolute; left: 0; top: 0; width: 100%; }
          .slip { break-inside: avoid; }
        }
      `}</style>
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-bold">ใบผล · {state.event.name}</h1>
        <p className="text-sm text-gray-600">
          {slips.length} ใบ (รอบคัดเลือก 2 เซต · น็อกเอาต์ 3 เซต) · 4 ใบต่อ A4 · ชื่อผู้เล่นเว้นให้เขียนหน้างาน
        </p>
      </div>
      <PrintButton />
      <div className="slips grid grid-cols-1 gap-[6mm]">
        {slips.map((s) => (
          <div key={s.key} className="slip flex h-[64mm] flex-col gap-[2mm] border-2 border-black p-[4mm] text-[11pt] text-black">
            <div className="flex justify-between text-[9pt]">
              <span>{state.event.name}</span>
              <span>
                {s.label} · คู่ {s.order} · สนาม {s.court} · {s.time}
              </span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-[3mm] font-bold">
              <span className="border-b border-black">ทีม {s.a || "................"}</span>
              <span>vs</span>
              <span className="border-b border-black">ทีม {s.b || "................"}</span>
            </div>
            <div className="grid grid-cols-[1fr_auto_1fr] gap-[3mm] text-[10pt]">
              <span>ผู้เล่น ..................... + .....................</span>
              <span />
              <span>ผู้เล่น ..................... + .....................</span>
            </div>
            <table className="w-full border-collapse text-center text-[10pt]">
              <thead>
                <tr>
                  <th className="w-[30mm] border border-black p-[1mm] text-left">ฝั่ง</th>
                  {Array.from({ length: s.sets }, (_, i) => (
                    <th key={i} className="border border-black p-[1mm]">
                      เซต {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[s.a || "ทีม A", s.b || "ทีม B"].map((name, i) => (
                  <tr key={i}>
                    <td className="h-[9mm] border border-black p-[1mm] text-left">{name}</td>
                    {Array.from({ length: s.sets }, (_, j) => (
                      <td key={j} className="border border-black" />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="mt-auto grid grid-cols-2 gap-[6mm] text-[9pt]">
              <span>ลงชื่อ ฝั่ง {s.a || "A"} ................................</span>
              <span>ลงชื่อ ฝั่ง {s.b || "B"} ................................</span>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
