"use client";

/* eslint-disable @next/next/no-img-element -- versioned API image URLs */

import { useMemo, useState } from "react";
import PhotoCropModal from "@/app/admin/athletes/PhotoCropModal";
import { TEAM_SWATCHES } from "@/lib/games/schedule";
import { textOn } from "@/lib/games/color";
import type { TeamView } from "@/lib/games/state";
import { adminApi } from "../../api";

/** A team a player is with: saved, or only picked in that team's editor so far. */
export type Claim = { teamId: string; name: string; saved: boolean };

/** One team: logo, name, colour and the 10 players picked from the athlete roster. */
export default function TeamEditor({
  team,
  athletes,
  claims,
  onDraft,
  onSaved,
}: {
  team: TeamView;
  athletes: { id: string; name: string }[];
  claims: Map<string, Claim[]>;
  onDraft: (teamId: string, ids: string[]) => void;
  onSaved: () => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(team.name);
  const [color, setColor] = useState(team.color);
  const [members, setMembersState] = useState<string[]>(team.members.map((m) => m.id));
  // Every change is reported up, so the other team editors grey this pick out straight away.
  const setMembers = (ids: string[]) => {
    setMembersState(ids);
    onDraft(team.id, ids);
  };
  const [query, setQuery] = useState("");
  const [cropFile, setCropFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const names = useMemo(() => new Map(athletes.map((a) => [a.id, a.name])), [athletes]);

  const matches = query.trim()
    ? athletes.filter((a) => !members.includes(a.id) && a.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  async function save(body: object, ok: string) {
    const res = await adminApi(`/api/admin/games/teams/${team.id}`, "PATCH", body);
    setMsg(res.ok ? { ok: true, text: ok } : { ok: false, text: res.error });
    await onSaved();
  }

  const preview = { ...team, name, color, textColor: textOn(color) };

  return (
    <div className="flex flex-col gap-3 rounded-xl border p-3" style={{ borderColor: open ? color : "#dbe6f0", borderWidth: open ? 2 : 1 }}>
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-2 text-left">
        <Logo team={preview} size={30} />
        <span className="rounded-md px-3 py-0.5 font-bold" style={{ background: color, color: textOn(color) }}>
          {name}
        </span>
        <span className={`text-sm ${members.length === 10 ? "text-gray-500" : "text-red-700"}`}>
          {members.length} / 10 คน{members.length < 10 ? ` · ขาด ${10 - members.length}` : ""}
        </span>
        <span className="ml-auto text-sm font-semibold text-brand-700">{open ? "ย่อ ˄" : "แก้ ˅"}</span>
      </button>

      {open && (
        <>
          <div className="grid grid-cols-[72px_minmax(0,1fr)] items-end gap-3">
            <div className="flex flex-col gap-1 text-xs text-gray-600">
              โลโก้ทีม
              <span className="flex h-[72px] w-[72px] items-center justify-center rounded-xl border-2 border-dashed" style={{ borderColor: color }}>
                <Logo team={preview} size={56} />
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-1 text-xs text-gray-600">
                ชื่อทีม
                <input id={`team-name-${team.id}`} className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </label>
              <div className="flex gap-2">
                <label className="cursor-pointer rounded-md border border-brand-600 px-3 py-1.5 text-sm font-semibold text-brand-700">
                  อัปโหลดโลโก้
                  <input
                    id={`team-logo-${team.id}`}
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) setCropFile(f);
                      e.target.value = "";
                    }}
                  />
                </label>
                {team.logoUrl && (
                  <button type="button" onClick={() => save({ logoUrl: null }, "ลบโลโก้แล้ว")} className="px-2 text-sm text-gray-500">
                    ลบโลโก้
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-600">สีทีม</span>
            <div className="flex flex-wrap items-center gap-2">
              {TEAM_SWATCHES.map((s) => (
                <button
                  key={s.color}
                  type="button"
                  aria-label={`สี${s.name}`}
                  onClick={() => setColor(s.color)}
                  className="h-[30px] w-[30px] rounded-full"
                  style={{
                    background: s.color,
                    border: `3px solid ${color === s.color ? "#ffffff" : s.name === "ขาว" ? "#b3cbe0" : s.color}`,
                    boxShadow: color === s.color ? "0 0 0 2px #0b1c30" : "none",
                  }}
                />
              ))}
              <label className="flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-2 py-1 text-xs text-brand-700">
                สีอื่น
                <input
                  id={`team-color-${team.id}`}
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-20 font-mono text-xs outline-none"
                  aria-label="โค้ดสี"
                />
              </label>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-gray-600">ผู้เล่น</span>
            <div className="flex flex-wrap gap-1.5">
              {members.map((id) => (
                <span key={id} className="flex items-center gap-1 rounded-full bg-gray-100 py-1 pl-3 pr-1 text-sm">
                  {names.get(id) ?? "?"}
                  <button
                    type="button"
                    aria-label={`เอา ${names.get(id)} ออก`}
                    onClick={() => setMembers(members.filter((m) => m !== id))}
                    className="px-1.5 text-gray-400 hover:text-red-600"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <input
              id={`team-search-${team.id}`}
              className="input"
              placeholder="พิมพ์ชื่อเพื่อเพิ่มผู้เล่นจากรายชื่อนักกีฬา"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {matches.length > 0 && (
              <ul className="flex flex-col rounded-md border border-gray-200">
                {matches.map((a) => {
                  const other = claims.get(a.id)?.find((c) => c.teamId !== team.id);
                  return (
                    <li key={a.id}>
                      <button
                        type="button"
                        disabled={!!other}
                        onClick={() => {
                          setMembers([...members, a.id]);
                          setQuery("");
                        }}
                        className="flex w-full justify-between px-3 py-2 text-left text-sm hover:bg-brand-50 disabled:text-gray-400"
                      >
                        {a.name}
                        {other && (
                          <span className="text-xs">
                            {other.saved ? `อยู่ทีม${other.name}` : `เลือกไว้ในทีม${other.name} (ยังไม่บันทึก)`}
                          </span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <button
            type="button"
            onClick={() => save({ name, color, memberIds: members }, "บันทึกทีมแล้ว")}
            className="self-start rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            บันทึกทีม
          </button>
          {msg && <p className={`text-sm ${msg.ok ? "text-green-700" : "text-red-600"}`}>{msg.text}</p>}
        </>
      )}

      {cropFile && (
        <PhotoCropModal
          file={cropFile}
          onCancel={() => setCropFile(null)}
          onCropped={(dataUrl) => {
            setCropFile(null);
            void save({ logoUrl: dataUrl }, "บันทึกโลโก้แล้ว");
          }}
        />
      )}
    </div>
  );
}

function Logo({ team, size }: { team: TeamView; size: number }) {
  if (team.logoUrl) return <img src={team.logoUrl} alt="" width={size} height={size} className="rounded-lg object-cover" style={{ width: size, height: size }} />;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6l7-3z" fill={team.color} />
    </svg>
  );
}
