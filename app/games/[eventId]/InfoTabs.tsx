/* The player page's other tabs: teams and players, rules, schedule, table. */

import Link from "next/link";
import type { GamesState, TeamView, TieView } from "@/lib/games/state";
import { fmtMinute } from "@/lib/games/format";
import { parseHHMM } from "@/lib/games/schedule";
import { Avatar, DARK, TeamChip, TeamLogo, TieRow } from "../ui";

export function TeamsTab({ state }: { state: GamesState }) {
  return (
    <section className="flex flex-col gap-3">
      {state.teams.map((team) => (
        <div key={team.id} className="flex flex-col gap-3 rounded-xl border-2 p-3" style={{ background: DARK.panel, borderColor: team.color }}>
          <div className="flex items-center gap-2.5">
            <TeamLogo team={team} size={36} />
            <span className="rounded-lg px-3 py-0.5 text-lg font-bold" style={{ background: team.color, color: team.textColor }}>
              {team.name}
            </span>
            <span className="ml-auto text-xs text-[#a9bdd3]">{team.members.length} คน</span>
          </div>
          {team.members.length ? (
            <ul className="grid grid-cols-2 gap-x-3 gap-y-2.5">
              {team.members.map((p) => (
                <li key={p.id} className="flex min-w-0 items-center gap-2 text-sm leading-tight">
                  <Avatar player={p} size={34} />
                  <span className="min-w-0 break-words">{p.name}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-[#a9bdd3]">ยังไม่ได้ใส่รายชื่อ</p>
          )}
        </div>
      ))}
    </section>
  );
}

export function RulesTab({ state }: { state: GamesState }) {
  const qualifier = state.ties.filter((t) => t.stage === "QUALIFIER");
  const knockout = state.ties.filter((t) => t.stage !== "QUALIFIER");
  const qStart = qualifier[0]?.startsAt;
  const lastRound = qualifier.at(-1)?.startsAt;
  const qEnd = lastRound ? fmtMinute(parseHHMM(lastRound) + 3 * state.event.qualifierMinutes) : null;

  return (
    <div className="flex flex-col gap-3">
      <RuleCard title="รูปแบบการแข่งขัน">
        <li>6 ทีม ทีมละ 10 คน แต่ละแมตซ์ส่งลงแข่ง 5 คู่ ตามใบส่งตัวที่กัปตันส่งให้แอดมินก่อนแข่ง</li>
        <li>
          ใช้ 6 สนาม คู่หนึ่งใช้เวลาประมาณ {state.event.qualifierMinutes} นาทีในรอบคัดเลือก และ {state.event.knockoutMinutes} นาทีในรอบน็อกเอาต์ (เวลาไว้ดูเฉยๆ ไม่มีผลกับผลแข่ง)
        </li>
      </RuleCard>

      <RuleCard title={`รอบคัดเลือก${qStart && qEnd ? ` · ${qStart}–${qEnd}` : ""}`}>
        <li>พบกันหมด 15 แมตซ์ (5 รอบ รอบละ 3 แมตซ์)</li>
        <li>แต่ละคู่เล่น 2 เซต</li>
        <li>ชนะ 2–0 เซต ได้ 2 คะแนน · เสมอ 1–1 ได้ฝั่งละ 1 คะแนน · แพ้ 0–2 ได้ 0</li>
        <li>คะแนนแมตซ์ = รวม 5 คู่ (สูงสุด 10)</li>
      </RuleCard>

      <RuleCard title="จัดอันดับเมื่อคะแนนเท่ากัน" ordered note="ข้อ 2–3 นับเฉพาะแมตซ์ระหว่างทีมที่ยังเท่ากัน">
        <li>ผลต่างแต้มรวม (แต้มที่ได้ลบแต้มที่เสีย ทุกเซตในรอบคัดเลือก)</li>
        <li>คู่ที่ชนะตอนเจอกัน</li>
        <li>ผลต่างแต้มตอนเจอกัน</li>
      </RuleCard>

      <RuleCard title="รอบน็อกเอาต์">
        <li>อันดับ 1 vs 4 และ 2 vs 3 แข่งรอบรองชนะเลิศ · อันดับ 5 vs 6 ชิงอันดับ 5</li>
        <li>ผู้แพ้รอบรองฯ ชิงอันดับ 3 · ผู้ชนะรอบรองฯ ชิงชนะเลิศ</li>
        <li>แต่ละคู่เล่น 2 ใน 3 เซต เซตละ 21 แต้ม ถ้า 20–20 ต้องนำ 2 แต้ม แต่ไม่เกิน 30</li>
        <li>ชนะคู่ได้ 1 คะแนน ทีมแรกที่ได้ 3 คะแนนชนะแมตซ์ คู่ที่เหลือไม่ต้องแข่ง</li>
        {knockout.length > 0 && (
          <li>
            {knockout.map((t) => (
              <span key={t.id} className="block">
                {t.startsAt} {t.label} · สนาม {t.courtA}–{t.courtB}
              </span>
            ))}
          </li>
        )}
      </RuleCard>

      <RuleCard title="ผลการแข่งขัน">
        <li>ผู้เล่นนับแต้มเองแล้วเขียนใบผลส่งโต๊ะ แอดมินกรอกผลเข้าระบบ</li>
        <li>หน้านี้อัปเดตเองทุก 2 วินาที ไม่ต้องรีเฟรช</li>
      </RuleCard>
    </div>
  );
}

function RuleCard({
  title,
  ordered = false,
  note,
  children,
}: {
  title: string;
  ordered?: boolean;
  note?: string;
  children: React.ReactNode;
}) {
  const List = ordered ? "ol" : "ul";
  return (
    <section className="flex flex-col gap-2 rounded-xl border p-3.5" style={{ background: DARK.panel, borderColor: DARK.line }}>
      <h2 className="text-base font-bold" style={{ color: DARK.gold }}>
        {title}
      </h2>
      <List className={`flex flex-col gap-1.5 pl-5 text-sm leading-relaxed text-[#dbe6f0] ${ordered ? "list-decimal" : "list-disc"}`}>
        {children}
      </List>
      {note && <p className="text-xs text-[#a9bdd3]">{note}</p>}
    </section>
  );
}

export function ScheduleTab({ state, teams }: { state: GamesState; teams: Map<string, TeamView> }) {
  const qualifier = state.ties.filter((t) => t.stage === "QUALIFIER");
  const knockout = state.ties.filter((t) => t.stage !== "QUALIFIER");
  const rounds = [1, 2, 3, 4, 5].map((r) => qualifier.filter((t) => t.round === r));

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-2.5">
        <h2 className="text-base font-bold">รอบคัดเลือก</h2>
        {rounds.map((ties, r) => (
          <div key={r} className="flex flex-col gap-1.5">
            <div className="flex justify-between text-xs">
              <span className="font-bold">
                รอบที่ {r + 1} <span className="font-medium text-[#a9bdd3]">· {ties[0]?.startsAt}</span>
              </span>
              <RoundStatus ties={ties} />
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ties.map((t) => (
                <Link
                  key={t.id}
                  href={`/games/${state.event.id}/tie/${t.id}`}
                  className="flex flex-col gap-1 rounded-lg border px-2 py-1.5 text-xs"
                  style={{ background: DARK.panel, borderColor: t.status === "live" ? DARK.live : DARK.line }}
                >
                  <ScheduleLine team={teams.get(t.teamAId ?? "")} points={t.status === "upcoming" ? null : t.pointsA} bold={t.status === "done" && t.pointsA > t.pointsB} />
                  <ScheduleLine team={teams.get(t.teamBId ?? "")} points={t.status === "upcoming" ? null : t.pointsB} bold={t.status === "done" && t.pointsB > t.pointsA} />
                </Link>
              ))}
            </div>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="text-base font-bold">รอบน็อกเอาต์</h2>
          <span className="text-[11px] text-[#a9bdd3]">ชนะ 3 ใน 5 คู่ · 2 ใน 3 เซต</span>
        </div>
        {knockout.map((t) => (
          <TieRow key={t.id} eventId={state.event.id} tie={t} teams={teams} />
        ))}
      </section>
    </div>
  );
}

function RoundStatus({ ties }: { ties: TieView[] }) {
  if (ties.some((t) => t.status === "live")) return <span className="font-semibold" style={{ color: DARK.live }}>กำลังแข่ง</span>;
  if (ties.length && ties.every((t) => t.status === "done")) return <span className="font-semibold text-[#8a9db3]">จบแล้ว</span>;
  return null;
}

function ScheduleLine({ team, points, bold }: { team: TeamView | undefined; points: number | null; bold: boolean }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-sm" style={{ background: team?.color ?? DARK.dim }} />
      <span className="flex-1 truncate" style={{ fontWeight: bold ? 700 : 500 }}>{team?.name ?? "—"}</span>
      <b className="tabular-nums">{points ?? ""}</b>
    </span>
  );
}

export function StandingsTab({ state, teams }: { state: GamesState; teams: Map<string, TeamView> }) {
  // No semi-final split until all 15 qualifier ties are done: the order can still change.
  const split = state.qualifierDone;
  return (
    <section className="flex flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-bold">ตารางคะแนนรวม</h2>
        <span className="text-[11px] text-[#a9bdd3]">ชนะ 2 · เสมอ 1 · แพ้ 0</span>
      </div>
      <div className="overflow-hidden rounded-xl border" style={{ background: DARK.panel, borderColor: DARK.line }}>
        <div className="grid grid-cols-[24px_minmax(0,1fr)_44px_64px_44px] gap-1.5 border-b px-2.5 py-2 text-[11px] text-[#a9bdd3]" style={{ borderColor: DARK.lineSoft }}>
          <span>#</span>
          <span>ทีม</span>
          <span className="text-right">คะแนน</span>
          <span className="text-center">ช-ส-พ</span>
          <span className="text-right">+/-</span>
        </div>
        {state.standings.map((row, i) => {
          const top = split && row.rank <= 4;
          return (
            <div
              key={row.teamId}
              className="grid grid-cols-[24px_minmax(0,1fr)_44px_64px_44px] items-center gap-1.5 px-2.5 py-2 tabular-nums"
              style={{ borderTop: i === 0 ? "none" : split && row.rank === 5 ? `2px dashed ${DARK.live}` : `1px solid ${DARK.lineSoft}` }}
            >
              <span className="text-sm font-bold" style={{ color: top ? DARK.gold : DARK.dim }}>{row.rank}</span>
              <span className="flex min-w-0 items-center gap-1.5">
                <TeamChip team={teams.get(row.teamId)} />
                {split && <span className="text-[10px]" style={{ color: top ? DARK.gold : DARK.dim }}>{top ? "รองฯ" : "ชิงที่ 5"}</span>}
              </span>
              <span className="text-right text-base font-bold">{row.points}</span>
              <span className="text-center text-xs text-[#c3cedd]">{row.won}-{row.drawn}-{row.lost}</span>
              <span className="text-right text-xs text-[#c3cedd]">{row.diff > 0 ? `+${row.diff}` : row.diff}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] leading-relaxed text-[#a9bdd3]">คะแนนเท่ากัน ดู ผลต่างแต้ม → คู่ที่ชนะตอนเจอกัน → ผลต่างแต้มตอนเจอกัน</p>
    </section>
  );
}
