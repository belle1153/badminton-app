/** The player page's tabs, in menu order. Shared by the page (reads ?tab=) and the client shell. */
export const TABS = [
  { key: "teams", label: "ทีมและนักกีฬา" },
  { key: "rules", label: "กติกา" },
  { key: "schedule", label: "ตารางแข่งขัน" },
  { key: "running", label: "Match Running" },
  { key: "standings", label: "ตารางคะแนนรวม" },
] as const;

export type TabKey = (typeof TABS)[number]["key"];

export const isTabKey = (s: string | undefined): s is TabKey => TABS.some((t) => t.key === s);
