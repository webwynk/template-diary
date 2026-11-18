import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { tsconfigPaths: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e"],
    css: false,
    // RULES.md §8: the engine must stay at 95%+ line coverage. `npm test` enforces it.
    coverage: {
      provider: "v8",
      include: ["lib/engine/**/*.ts"],
      exclude: ["lib/engine/**/__tests__/**"],
      reporter: ["text-summary"],
      thresholds: { lines: 95, statements: 95, functions: 95, branches: 85 },
    },
  },
});
