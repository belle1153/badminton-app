"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { SummaryCategory, SummaryRow } from "@/lib/missionSummary";
import { AwardAvatar } from "./AwardAvatar";
import { MEDAL } from "./medal";

/**
 * Award-ceremony mode: full screen, one category at a time. Each press reveals
 * the next place, third → second → first (first gets the confetti), then moves
 * on to the next category. Click / → / Space / Enter / PageDown go forward (a
 * presentation clicker sends PageDown), ← / PageUp go back, Esc leaves.
 */

type Step = { cat: number; shown: number[] }; // shown = places revealed so far

function buildSteps(categories: SummaryCategory[]): Step[] {
  const steps: Step[] = [];
  categories.forEach((c, cat) => {
    const places = [3, 2, 1].filter((p) => c.rows.some((r) => r.rank === p));
    steps.push({ cat, shown: [] });
    places.forEach((_, i) => steps.push({ cat, shown: places.slice(0, i + 1) }));
  });
  return steps;
}

const CONFETTI_COLORS = ["#ffcf4d", "#ff6fb5", "#4f9fe6", "#7ee08a", "#ffffff", "#ff9d4d"];

/** A burst of falling paper, rebuilt each time first place is revealed. */
function Confetti({ seed }: { seed: number }) {
  const bits = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => {
        // Deterministic per piece, so a re-render doesn't reshuffle mid-fall.
        const r = (n: number) => (Math.sin(seed * 97 + i * 13.7 + n) + 1) / 2;
        return {
          left: `${r(1) * 100}%`,
          delay: `${r(2) * 1.4}s`,
          duration: `${3.4 + r(3) * 2.6}s`,
          size: 6 + r(4) * 8,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          drift: `${(r(5) - 0.5) * 160}px`,
          spin: `${r(6) * 720 - 360}deg`,
        };
      }),
    [seed]
  );
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {bits.map((b, i) => (
        <span
          key={i}
          className="award-confetti absolute top-0 block rounded-[2px]"
          style={
            {
              left: b.left,
              width: b.size,
              height: b.size * 0.45,
              background: b.color,
              animationDelay: b.delay,
              animationDuration: b.duration,
              "--drift": b.drift,
              "--spin": b.spin,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}

/** One podium column: the place's holders above a metal pedestal. */
function Podium({ place, rows, unit, shown }: { place: number; rows: SummaryRow[]; unit: string; shown: boolean }) {
  const m = MEDAL[place - 1];
  const height = place === 1 ? "min(20vh, 220px)" : place === 2 ? "min(14vh, 160px)" : "min(10vh, 120px)";
  const base = place === 1 ? 190 : 150;
  // Several people sharing a place shrink so the column keeps its width.
  const scale = rows.length > 3 ? 0.42 : rows.length > 1 ? 0.62 : 1;
  const size = Math.round(base * scale);
  // Also capped by screen height, so title + photo + pedestal always fit one screen.
  const cssSize = `min(${size}px, ${((place === 1 ? 20 : 15) * scale).toFixed(1)}vh)`;
  return (
    <div className="flex w-1/3 max-w-[420px] flex-col items-center justify-end">
      <div
        className={`flex flex-col items-center gap-2 pb-4 text-center ${shown ? "award-rise" : "invisible"}`}
        style={{ minHeight: 0 }}
      >
        {place === 1 && (
          <span className="award-crown text-[clamp(28px,5vh,56px)] leading-none" aria-hidden="true">
            👑
          </span>
        )}
        <div className="flex flex-wrap items-end justify-center gap-3">
          {rows.map((r) => (
            <div key={r.athleteId} className="flex flex-col items-center gap-1.5">
              <AwardAvatar row={r} rank={place} size={size} cssSize={cssSize} />
              <span
                className="max-w-[16ch] break-words font-bold leading-tight text-white"
                style={{ fontSize: rows.length > 1 ? "clamp(14px,2vh,22px)" : place === 1 ? "clamp(22px,3.6vh,40px)" : "clamp(18px,2.8vh,30px)" }}
              >
                {r.name}
              </span>
            </div>
          ))}
        </div>
        <span className="font-bold tabular-nums" style={{ color: m.mid, fontSize: place === 1 ? "clamp(30px,5.5vh,64px)" : "clamp(22px,3.8vh,44px)" }}>
          {rows[0]?.value.toLocaleString()}
          <span className="ml-2 text-[0.45em] text-[#e8c766]">{unit}</span>
        </span>
        {rows.length === 1 && rows[0].detail && <span className="text-[clamp(12px,1.6vh,18px)] text-[#a9bdd3]">{rows[0].detail}</span>}
      </div>
      <div
        className="flex w-full items-start justify-center rounded-t-xl pt-3"
        style={{
          height,
          background: `linear-gradient(180deg, ${m.light}, ${m.mid} 30%, ${m.dark})`,
          boxShadow: `inset 0 3px 0 rgba(255,255,255,.45), 0 0 40px ${m.mid}${shown ? "66" : "22"}`,
          opacity: shown ? 1 : 0.35,
          transition: "opacity .5s, box-shadow .5s",
        }}
      >
        <span className="font-bold text-[#1c2536]" style={{ fontSize: "clamp(36px,7vh,88px)", textShadow: "0 2px 0 rgba(255,255,255,.4)" }}>
          {place}
        </span>
      </div>
    </div>
  );
}

export default function AwardPresenter({ categories }: { categories: SummaryCategory[] }) {
  const steps = useMemo(() => buildSteps(categories), [categories]);
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);

  const next = useCallback(() => setI((n) => Math.min(n + 1, steps.length - 1)), [steps.length]);
  const back = useCallback(() => setI((n) => Math.max(n - 1, 0)), []);
  const close = useCallback(() => {
    setOpen(false);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  function start() {
    setI(0);
    setOpen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", " ", "Enter", "PageDown"].includes(e.key)) {
        e.preventDefault();
        next();
      } else if (["ArrowLeft", "PageUp", "Backspace"].includes(e.key)) {
        e.preventDefault();
        back();
      } else if (e.key === "Escape") close();
    };
    // Leaving full screen with the browser's own Esc also closes the show.
    const onFs = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    document.addEventListener("fullscreenchange", onFs);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("fullscreenchange", onFs);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, next, back, close]);

  const step = steps[i];
  const c = step ? categories[step.cat] : null;
  const firstShown = !!step?.shown.includes(1);

  return (
    <>
      <button
        type="button"
        onClick={start}
        disabled={steps.length === 0}
        className="award-shine relative overflow-hidden rounded-full px-6 py-3 text-base font-bold text-[#1c2536] shadow-[0_0_24px_rgba(255,207,77,.45)] disabled:opacity-50"
        style={{ background: "linear-gradient(180deg, #ffe08a, #ffcf4d 45%, #d9a22b)" }}
      >
        🎤 โหมดประกาศรางวัล
      </button>

      {open && c && step && (
        <div
          role="dialog"
          aria-label="ประกาศรางวัลมิชชั่นโคตรตึง"
          onClick={next}
          className="fixed inset-0 z-50 flex cursor-pointer select-none flex-col overflow-hidden font-[family-name:var(--font-pixel-body)] text-white"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, #6b4f1677, transparent 55%), radial-gradient(ellipse at 50% 110%, #1f3a6b, transparent 60%), #0b1220",
          }}
        >
          {/* Spotlight beams */}
          <span
            aria-hidden="true"
            className="award-beam pointer-events-none absolute left-1/2 top-0 h-full w-[70vw] -translate-x-1/2"
            style={{ background: "conic-gradient(from 180deg at 50% 0%, transparent 160deg, #ffcf4d1f 175deg, #ffffff14 180deg, #ffcf4d1f 185deg, transparent 200deg)" }}
          />
          {firstShown && <Confetti key={i} seed={i} />}

          <div className="relative flex items-center justify-between px-6 pt-4 text-[clamp(12px,1.6vh,16px)] text-[#8fa3bd]">
            <span>🏆 สรุปมิชชั่นโคตรตึง</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                close();
              }}
              className="rounded-full border border-white/20 px-3 py-1 hover:bg-white/10"
            >
              ออก (Esc)
            </button>
          </div>

          <div key={step.cat} className="award-title relative flex flex-col items-center gap-1 pt-[1vh] text-center">
            <span className="text-[clamp(40px,8vh,110px)] leading-none drop-shadow-[0_0_24px_rgba(255,207,77,.5)]">{c.icon}</span>
            <h1
              className="font-bold leading-tight"
              style={{
                fontSize: "clamp(30px,6vh,80px)",
                background: "linear-gradient(180deg, #fff6d6, #ffcf4d 55%, #c98f1e)",
                WebkitBackgroundClip: "text",
                backgroundClip: "text",
                color: "transparent",
                filter: "drop-shadow(0 0 18px rgba(255,207,77,.35))",
              }}
            >
              {c.title}
            </h1>
            {c.note && <span className="text-[clamp(13px,2vh,22px)] text-[#a9bdd3]">{c.note}</span>}
          </div>

          {c.rows.length === 0 ? (
            <p className="m-auto text-[clamp(18px,3vh,32px)] text-[#a9bdd3]">ยังไม่มีใครเข้าเกณฑ์</p>
          ) : (
            <div className="relative mx-auto mt-auto flex w-full max-w-[1400px] items-end justify-center gap-[2vw] px-[3vw]">
              {[2, 1, 3].map((place) => (
                <Podium
                  key={place}
                  place={place}
                  rows={c.rows.filter((r) => r.rank === place)}
                  unit={c.unit}
                  shown={step.shown.includes(place)}
                />
              ))}
            </div>
          )}

          <div className="relative flex items-center justify-center gap-2 py-3">
            {categories.map((cat, n) => (
              <span
                key={cat.id}
                className="h-2 rounded-full transition-all"
                style={{ width: n === step.cat ? 28 : 8, background: n === step.cat ? "#ffcf4d" : "#ffffff33" }}
              />
            ))}
            <span className="ml-3 text-[clamp(11px,1.4vh,14px)] text-[#5f7590]">คลิก / → ไปต่อ · ← ย้อน</span>
          </div>
        </div>
      )}
    </>
  );
}
