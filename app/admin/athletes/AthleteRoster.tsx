"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SKILL_LABELS, type SkillLevel } from "@/lib/matching";
import PhotoCropModal from "./PhotoCropModal";

const SKILLS = Object.keys(SKILL_LABELS) as SkillLevel[];

interface Athlete {
  id: string;
  name: string;
  skillLevel: SkillLevel;
  photoUrl: string | null;
}

export default function AthleteRoster({ athletes }: { athletes: Athlete[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editSkill, setEditSkill] = useState<SkillLevel>("RK");
  const [saving, setSaving] = useState(false);

  const [newName, setNewName] = useState("");
  const [newSkill, setNewSkill] = useState<SkillLevel>("RK");
  const [adding, setAdding] = useState(false);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [cropTarget, setCropTarget] = useState<{ id: string; file: File } | null>(null);

  async function removePhoto(id: string) {
    setError(null);
    setUploadingId(id);
    try {
      const res = await fetch(`/api/athletes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl: null }),
      });
      if (!res.ok) {
        setError((await res.json().catch(() => ({}))).error ?? "ลบรูปไม่สำเร็จ");
        return;
      }
      router.refresh();
    } finally {
      setUploadingId(null);
    }
  }

  async function savePhoto(id: string, photoUrl: string) {
    setCropTarget(null);
    setError(null);
    setUploadingId(id);
    try {
      const res = await fetch(`/api/athletes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoUrl }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? "อัปโหลดรูปไม่สำเร็จ");
        return;
      }
      router.refresh();
    } catch {
      setError("บันทึกรูปไม่สำเร็จ");
    } finally {
      setUploadingId(null);
    }
  }

  async function addAthlete(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/athletes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim(), skillLevel: newSkill }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "เพิ่มไม่สำเร็จ");
        return;
      }
      setNewName("");
      setNewSkill("RK");
      router.refresh();
    } finally {
      setAdding(false);
    }
  }

  function startEdit(a: Athlete) {
    setEditingId(a.id);
    setEditName(a.name);
    setEditSkill(a.skillLevel);
    setError(null);
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/athletes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName, skillLevel: editSkill }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "บันทึกไม่สำเร็จ");
        return;
      }
      setEditingId(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function deleteAthlete(id: string, name: string) {
    if (!confirm(`ลบ "${name}" ออกจากรายชื่อขาประจำใช่ไหมครับ?`)) return;
    const res = await fetch(`/api/athletes/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return setError(data.error ?? "ลบไม่สำเร็จ");
    router.refresh();
  }

  const filtered = athletes.filter((a) => a.name.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col gap-4">
      {error && <p className="text-red-600 text-sm">{error}</p>}

      <form onSubmit={addAthlete} className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3">
        <span className="text-sm font-semibold">เพิ่มผู้เล่นใหม่</span>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <input
            placeholder="ชื่อผู้เล่น"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="input flex-1"
            autoComplete="off"
          />
          <select
            value={newSkill}
            onChange={(e) => setNewSkill(e.target.value as SkillLevel)}
            className="input sm:w-28"
          >
            {SKILLS.map((k) => (
              <option key={k} value={k}>
                {SKILL_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={adding || !newName.trim()}
            className="rounded-md bg-brand-600 text-white px-4 py-2 text-sm font-medium hover:bg-brand-700 disabled:opacity-50 whitespace-nowrap"
          >
            {adding ? "กำลังเพิ่ม..." : "เพิ่ม"}
          </button>
        </div>
      </form>

      <input
        placeholder="ค้นหาชื่อ..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="input"
      />
      <ul className="flex flex-col gap-1">
        {filtered.map((a) => (
          <li key={a.id} className="flex items-center justify-between gap-2 text-sm border-b border-gray-100 py-1">
            {editingId === a.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="input py-1 flex-1 min-w-0"
                  autoFocus
                />
                <select
                  value={editSkill}
                  onChange={(e) => setEditSkill(e.target.value as SkillLevel)}
                  className="text-xs border border-gray-200 rounded px-1 py-1 text-gray-600 shrink-0"
                >
                  {SKILLS.map((k) => (
                    <option key={k} value={k}>
                      {SKILL_LABELS[k]}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => saveEdit(a.id)}
                  disabled={saving}
                  className="text-xs text-brand-700 hover:underline disabled:opacity-50 shrink-0"
                >
                  บันทึก
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-xs text-gray-400 hover:underline shrink-0"
                >
                  ยกเลิก
                </button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="relative shrink-0">
                    <label className="cursor-pointer block" title="เพิ่ม/เปลี่ยนรูป">
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        disabled={uploadingId === a.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setCropTarget({ id: a.id, file });
                          e.target.value = "";
                        }}
                      />
                      {a.photoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={a.photoUrl}
                          alt={a.name}
                          className="w-9 h-9 rounded-full object-cover border border-gray-200"
                        />
                      ) : (
                        <span className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-400">
                          {uploadingId === a.id ? "…" : "📷"}
                        </span>
                      )}
                    </label>
                    {a.photoUrl && (
                      <button
                        onClick={() => removePhoto(a.id)}
                        disabled={uploadingId === a.id}
                        title="ลบรูป"
                        className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-red-500 text-white text-[10px] leading-none flex items-center justify-center shadow disabled:opacity-50"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <span className="truncate">
                    {a.name} <span className="text-gray-400">— {SKILL_LABELS[a.skillLevel]}</span>
                  </span>
                </div>
                <span className="flex gap-2 shrink-0">
                  <button onClick={() => startEdit(a)} className="text-xs text-brand-700 hover:underline">
                    แก้ไข
                  </button>
                  <button onClick={() => deleteAthlete(a.id, a.name)} className="text-xs text-red-600 hover:underline">
                    ลบ
                  </button>
                </span>
              </>
            )}
          </li>
        ))}
        {filtered.length === 0 && <li className="text-sm text-gray-400">ไม่พบข้อมูล</li>}
      </ul>
      <p className="text-xs text-gray-400">ทั้งหมด {athletes.length} คน</p>

      {cropTarget && (
        <PhotoCropModal
          file={cropTarget.file}
          onCancel={() => setCropTarget(null)}
          onCropped={(dataUrl) => savePhoto(cropTarget.id, dataUrl)}
        />
      )}
    </div>
  );
}
