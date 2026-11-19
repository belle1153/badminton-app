/**
 * The player page's tabs, in menu order. Shared by the page (reads ?tab=) and the
 * client shell. `short` + `icon` make the five equal tiles of the tab bar; `label`
 * is the full name (screen readers, tooltips).
 */
export const TABS = [
  { key: "teams", label: "ทีมและนักกีฬา", short: "ทีม", icon: "👥" },
  { key: "rules", label: "กติกา", short: "กติกา", icon: "📜" },
  { key: "schedule", label: "ตารางแข่งขัน", short: "ตารางแข่ง", icon: "📅" },
  { key: "running", label: "Match Running", short: "Running", icon: "🏸" },
  { key: "standings", label: "ตารางคะแนนรวม", short: "คะแนนรวม", icon: "🏆" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export const isTabKey = (s: string | undefined): s is TabKey => TABS.some((t) => t.key === s);
