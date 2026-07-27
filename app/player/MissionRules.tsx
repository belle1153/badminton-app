import { EXP_RATES } from "@/lib/exp";
import { RARITY_EXP, RARITY_PALETTE, rarityFor, type Rarity } from "@/lib/achievementRarity";
import { computeAchievements } from "@/lib/achievements";
import { expForStep } from "@/lib/levels";

/**
 * The club's announcement of how Mission โคตรตึง! works.
 *
 * Every number is read from the scoring code rather than typed in. The club's
 * first hand-written version promised EXP for checking out (removed months
 * earlier), said the new-partner bonus capped at 3 (it's 5), and called the
 * attendance award "เช็คอิน" when nothing checks the check-in button. Rules
 * people act on have to come from the same constants that score them.
 */
export default function MissionRules() {
  const rules: { label: string; value: string }[] = [
    { label: "มาเล่น 1 วัน (มีเกมที่เล่นจบ)", value: `+${EXP_RATES.perDay}` },
    { label: "เล่น 1 เกม", value: `+${EXP_RATES.perGame}` },
    { label: "ชนะ 1 เกม", value: `+${EXP_RATES.perWin}` },
    {
      label: `มาต่อเนื่องหลายครั้งติด (สูงสุด ${EXP_RATES.streakCapDays} ครั้ง)`,
      value: `+${EXP_RATES.streakBonus}/ครั้ง`,
    },
    {
      label: `จับคู่กับคนที่ไม่เคยเล่นด้วยมาก่อนเลย — นับครั้งเดียวต่อคนตลอดกาล (สูงสุด ${EXP_RATES.newPartnerDailyCap} คน/วัน)`,
      value: `+${EXP_RATES.newPartnerBonus}/คน`,
    },
    {
      label: "เก็บเหรียญได้ 1 ใบ",
      value: `+${RARITY_EXP.common}–${RARITY_EXP.legendary}`,
    },
  ];

  // Counted from the real badge list, so the tier table can't claim a count
  // that no longer matches after a badge is added or removed.
  const allBadges = computeAchievements({
    gamesPlayed: 0,
    wins: 0,
    draws: 0,
    daysPlayed: 0,
    longestStreakDays: 0,
    distinctPartners: 0,
    bestDayGames: 0,
    bestPartnerGames: 0,
    bestDayHours: 0,
    longDays: 0,
    bestDayPartners: 0,
    bestDayWinStreak: 0,
    isFoundingMember: false,
  });

  const tiers: { rarity: Rarity; example: string; note: string }[] = [
    { rarity: "common", example: "🐣", note: "เป้าหมายเล็ก เช่น มาเล่นครั้งแรก" },
    { rarity: "rare", example: "💪", note: "เช่น ชนะครบ 10 เกม, มาครบ 5 วัน" },
    { rarity: "epic", example: "🥈", note: "เช่น เล่นครบ 100 เกม, มาครบ 25 วัน" },
    { rarity: "legendary", example: "🏆", note: "ยากสุด เช่น เล่นครบ 500 เกม, รุ่นบุกเบิก" },
  ];

  const tierRows = tiers.map((t) => ({
    ...t,
    palette: RARITY_PALETTE[t.rarity],
    exp: RARITY_EXP[t.rarity],
    count: allBadges.filter((b) => rarityFor(b.target) === t.rarity).length,
  }));

  const wholeSetExp = allBadges.reduce((n, b) => n + RARITY_EXP[rarityFor(b.target)], 0);

  return (
    <section className="flex flex-col gap-4 rounded-2xl border-2 border-sky-400 bg-[#141d2b] p-5 text-slate-200 shadow-[0_0_16px_rgba(79,159,230,0.3)]">
      <div className="flex flex-col gap-1.5">
        <h2 className="text-lg font-bold text-sky-300">ภารกิจ &quot;Mission โคตรตึง!&quot; 🚀🏸🏆</h2>
        <p className="text-sm text-slate-300">
          เล่นแบดที่ก๊วนแล้วเก็บคะแนน EXP และเหรียญสะสม เพิ่ม Level ของตัวเอง ลุ้นรับรางวัล 🎉
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-sky-200">🔸 กติกาง่ายๆ</h3>
        <ul className="flex flex-col gap-1.5 text-[13px] text-slate-300">
          <li className="flex gap-2">
            <span className="text-sky-400">•</span>
            <span>
              ลงชื่อมาเล่นผ่านแอป Tua Tueng Go! —{" "}
              <strong className="text-slate-100">ใช้ชื่อเดิมทุกครั้ง</strong> ระบบจะดึงประวัติเดิมให้
              (อยากเปลี่ยนชื่อแจ้งแอดมิน)
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">•</span>
            <span>ยิ่งมาเล่นและลงสนามบ่อย ยิ่งได้ EXP และเหรียญ ทำให้อัพ Level เร็วขึ้น</span>
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">•</span>
            <span>
              <strong className="text-slate-100">Level ไม่เกี่ยวกับระดับมือ</strong> (RK BG N S P) —
              วัดจากความขยันมาเล่นเป็นหลัก
            </span>
          </li>
          <li className="flex gap-2">
            <span className="text-sky-400">•</span>
            <span>สมาชิก Top 5 จะได้รับรางวัลจากก๊วนตัวตึง 🏆</span>
          </li>
        </ul>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-sky-200">🔹 คะแนน EXP ได้จาก...</h3>
        <ul className="flex flex-col divide-y divide-slate-700/60 rounded-lg border border-slate-700 bg-[#0f1622]">
          {rules.map((r) => (
            <li key={r.label} className="flex items-center gap-3 px-3 py-2 text-[13px]">
              <span className="text-slate-300">{r.label}</span>
              <span className="ml-auto shrink-0 font-bold tabular-nums text-emerald-400">
                {r.value}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex flex-col gap-1.5 rounded-lg border border-slate-700 bg-[#0f1622] px-3 py-2.5">
          <p className="text-[11px] font-semibold text-sky-200">
            ตัวอย่าง &quot;คู่ที่ไม่เคยเล่นด้วย&quot;
          </p>
          <p className="text-[11px] leading-relaxed text-slate-400">
            จันทร์ เล่นกับ A, B, C → ใหม่ทั้ง 3 คน{" "}
            <span className="font-semibold text-emerald-400">
              +{EXP_RATES.newPartnerBonus * 3}
            </span>
            <br />
            พุธ เล่นกับ A, X, Y → A เคยเล่นด้วยแล้ว เหลือ X, Y ที่ใหม่{" "}
            <span className="font-semibold text-emerald-400">
              +{EXP_RATES.newPartnerBonus * 2}
            </span>
          </p>
        </div>

        <p className="text-[11px] text-slate-500">
          ขึ้น Level 2 ต้องสะสม {expForStep(1).toLocaleString()} EXP (ประมาณมาเล่น 2 ครั้ง)
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-bold text-sky-200">
          🏅 ระดับเหรียญ — มี {tiers.length} ระดับ ({allBadges.length} ใบ)
        </h3>
        <ul className="flex flex-col divide-y divide-slate-700/60 rounded-lg border border-slate-700 bg-[#0f1622]">
          {tierRows.map((t) => (
            <li key={t.rarity} className="flex items-center gap-3 px-3 py-2.5">
              {/* Same ring shading the coins use, so the tier is recognisable
                  on the profile at a glance. */}
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-base"
                style={{
                  background: `radial-gradient(circle at 34% 28%, ${t.palette.r1} 0%, ${t.palette.r1} 34%, ${t.palette.r2} 35%, ${t.palette.r2} 70%, ${t.palette.r3} 71%, ${t.palette.r3} 100%)`,
                  boxShadow: `0 0 0 2px ${t.palette.r3}, 0 0 0 3px ${t.palette.glow}, 0 0 8px ${t.palette.glow}88`,
                }}
              >
                {t.example}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-[13px] font-semibold text-slate-200">
                  {t.palette.label}{" "}
                  <span className="text-[11px] font-normal text-slate-500">({t.count} ใบ)</span>
                </span>
                <span className="text-[11px] text-slate-400">{t.note}</span>
              </div>
              <span className="ml-auto shrink-0 text-[13px] font-bold tabular-nums text-emerald-400">
                +{t.exp}
              </span>
            </li>
          ))}
        </ul>
        <p className="text-[11px] text-slate-500">
          เก็บครบทุกใบได้ {wholeSetExp.toLocaleString()} EXP · เหรียญเป็นของแถมจากการมาเล่น
          ไม่ใช่ทางลัดข้ามเลเวล
        </p>
      </div>

      <div className="flex flex-col gap-1 border-t border-slate-700 pt-3">
        <p className="text-[13px] text-slate-300">
          🗓 เริ่มแล้ววันนี้ — ถึงก่อนงานกีฬาสีประจำปี (ปลายเดือน พ.ย.)
        </p>
        <p className="text-[13px] text-sky-300">😄 มาเก็บเลเวลไปด้วยกันนะครับ 🥰</p>
      </div>
    </section>
  );
}
