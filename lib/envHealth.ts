/**
 * Which server secrets are configured — for the admin dashboard.
 *
 * Values are NEVER read out, only whether each key is set. Every one of these
 * degrades quietly when missing: the app keeps working, so nothing tells you a
 * webhook is unverified or a cron endpoint is open until someone goes looking.
 * This is that look, on a page the admin already opens.
 */

export type EnvSeverity = "critical" | "recommended";

export interface EnvCheck {
  key: string;
  set: boolean;
  severity: EnvSeverity;
  /** What is degraded right now, in Thai, while it is missing. */
  impact: string;
}

const CHECKS: { key: string; severity: EnvSeverity; impact: string }[] = [
  {
    key: "LINE_CHANNEL_SECRET",
    severity: "critical",
    impact: "ตรวจลายเซ็น LINE webhook ไม่ได้ — ถอนชื่อผ่าน LINE ถูกปิดไว้จนกว่าจะตั้งค่า",
  },
  {
    key: "ADMIN_SECRET",
    severity: "critical",
    impact: "คุกกี้แอดมินเซ็นด้วย PIN แทนคีย์สุ่ม — เดาง่ายกว่าที่ควร ควรตั้งเป็นค่าสุ่มยาวๆ",
  },
  {
    key: "CRON_SECRET",
    severity: "recommended",
    impact: "ใครก็ยิง /api/cron/registration-open ได้ (ส่งได้แค่สิ่งที่ระบบจะส่งอยู่แล้ว แต่กินโควตา push)",
  },
  {
    key: "LINE_CHANNEL_ACCESS_TOKEN",
    severity: "recommended",
    impact: "บอทตอบในกลุ่มและแจ้งเปิดรับสมัครไม่ได้",
  },
  {
    key: "LINE_GROUP_ID",
    severity: "recommended",
    impact: "ไม่รู้ว่าจะส่งประกาศเข้ากลุ่มไหน",
  },
];

/** Pass `process.env` in production; the parameter exists so this is testable. */
export function envHealth(env: Record<string, string | undefined> = process.env): EnvCheck[] {
  return CHECKS.map(({ key, severity, impact }) => ({
    key,
    severity,
    impact,
    // Whitespace-only is as good as unset — a stray space in a Vercel field
    // would otherwise read as configured.
    set: (env[key] ?? "").trim() !== "",
  }));
}

/** Only what needs attention — the dashboard stays silent when all is well. */
export function envProblems(env?: Record<string, string | undefined>): EnvCheck[] {
  return envHealth(env).filter((c) => !c.set);
}
