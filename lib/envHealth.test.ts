import { describe, it, expect } from "vitest";
import { envHealth, envProblems } from "./envHealth";

const ALL = {
  LINE_CHANNEL_SECRET: "s",
  ADMIN_SECRET: "s",
  CRON_SECRET: "s",
  LINE_CHANNEL_ACCESS_TOKEN: "s",
  LINE_GROUP_ID: "s",
};

describe("envHealth", () => {
  it("reports nothing wrong when everything is set", () => {
    expect(envProblems(ALL)).toEqual([]);
  });

  it("reports a missing key", () => {
    const p = envProblems({ ...ALL, CRON_SECRET: undefined });
    expect(p.map((c) => c.key)).toEqual(["CRON_SECRET"]);
  });

  it("treats a whitespace-only value as unset", () => {
    // A stray space pasted into a Vercel field would otherwise read as done.
    expect(envProblems({ ...ALL, LINE_CHANNEL_SECRET: "   " }).map((c) => c.key)).toEqual([
      "LINE_CHANNEL_SECRET",
    ]);
  });

  it("never exposes a value, only whether it is set", () => {
    const serialised = JSON.stringify(envHealth({ ...ALL, ADMIN_SECRET: "hunter2-super-secret" }));
    expect(serialised).not.toContain("hunter2");
  });

  it("ranks the two that weaken a security check as critical", () => {
    const critical = envHealth({}).filter((c) => c.severity === "critical").map((c) => c.key);
    expect(critical.sort()).toEqual(["ADMIN_SECRET", "LINE_CHANNEL_SECRET"]);
  });

  it("gives every check a reason, so a warning is never just a key name", () => {
    for (const c of envHealth({})) expect(c.impact.length).toBeGreaterThan(10);
  });
});
