import Link from "next/link";

export default function RoundTabs({
  base,
  rounds,
  selected,
}: {
  base: string;
  rounds: number[];
  selected: number;
}) {
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {rounds.map((r) => (
        <Link
          key={r}
          href={`${base}?round=${r}`}
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
            r === selected
              ? "bg-brand-600 text-white"
              : "bg-gray-100 text-gray-600 hover:bg-brand-50 hover:text-brand-700"
          }`}
        >
          รอบ {r}
        </Link>
      ))}
    </div>
  );
}
