import { EXP_RATES } from "@/lib/exp";
import { RARITY_EXP } from "@/lib/achievementRarity";
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
          เหรียญยิ่งหายากยิ่งได้ EXP มาก · ขึ้น Level 2 ต้องสะสม {expForStep(1).toLocaleString()} EXP
          (ประมาณมาเล่น 2 ครั้ง)
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
