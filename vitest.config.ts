import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // Pure matchmaking/billing logic only — no DB, no server. Fast enough to run
    // on every change.
    include: ["lib/**/*.test.ts"],
    environment: "node",
  },
});
