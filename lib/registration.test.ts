import { describe, it, expect } from "vitest";
import { registrationOpensAt, registrationIsOpen } from "./registration";

/** Session dates are stored at UTC midnight of the intended Thai date. */
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);
/** A UTC instant for an ICT wall-clock time. */
const ictAt = (iso: string, h: number, m = 0) =>
  new Date(day(iso).getTime() + (h - 7) * 3_600_000 + m * 60_000);

// 2026-07-17 is a Friday; 07-20 Mon, 07-22 Wed, 07-19 Sun.
describe("registrationOpensAt", () => {
  it("opens Monday's session on the Friday before, 11:00 ICT", () => {
    expect(registrationOpensAt(day("2026-07-20"))).toEqual(ictAt("2026-07-17", 11));
  });

  it("opens Wednesday's session on the same Friday", () => {
    expect(registrationOpensAt(day("2026-07-22"))).toEqual(ictAt("2026-07-17", 11));
  });

  it("opens a Friday session that same morning", () => {
    expect(registrationOpensAt(day("2026-07-17"))).toEqual(ictAt("2026-07-17", 11));
  });

  it("opens a Sunday session on the Friday two days before", () => {
    expect(registrationOpensAt(day("2026-07-19"))).toEqual(ictAt("2026-07-17", 11));
  });

  it("opens a Saturday session on the Friday one day before", () => {
    expect(registrationOpensAt(day("2026-07-18"))).toEqual(ictAt("2026-07-17", 11));
  });
});

describe("registrationIsOpen", () => {
  const monday = day("2026-07-20");

  it("is shut before Friday 11:00 — including Friday morning", () => {
    expect(registrationIsOpen(monday, ictAt("2026-07-17", 10, 59))).toBe(false);
    expect(registrationIsOpen(monday, ictAt("2026-07-16", 23, 59))).toBe(false);
    expect(registrationIsOpen(monday, ictAt("2026-07-13", 11))).toBe(false); // week before
  });

  it("opens exactly at 11:00 ICT", () => {
    expect(registrationIsOpen(monday, ictAt("2026-07-17", 11))).toBe(true);
  });

  it("stays open afterwards, up to the session itself", () => {
    expect(registrationIsOpen(monday, ictAt("2026-07-17", 11, 1))).toBe(true);
    expect(registrationIsOpen(monday, ictAt("2026-07-19", 20))).toBe(true);
    expect(registrationIsOpen(monday, ictAt("2026-07-20", 19))).toBe(true);
  });

  it("does not open early just because the clock passed 11:00 on another day", () => {
    // Thursday 11:00 is not a Friday — must still be shut.
    expect(registrationIsOpen(monday, ictAt("2026-07-16", 11))).toBe(false);
  });
});
