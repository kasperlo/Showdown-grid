import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

/**
 * Tests cover the pure logic where a mistake is invisible: what gets written to
 * the database, which copy of a live game wins, and who the ranking says won.
 * UI behaviour is verified by running the app, not here.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["utils/__tests__/**/*.test.ts", "lib/__tests__/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
    },
  },
});
