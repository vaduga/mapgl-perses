import { defineConfig } from "vitest/config";
import { runtimeDependencies } from "./scripts/source-resolution.mjs";
export default defineConfig({
  resolve: {
    conditions: ["development"],
    preserveSymlinks: true,
    dedupe: runtimeDependencies,
  },
  test: {
    include: ["perses-adapter/src/**/*.test.ts"],
    environment: "node",
    server: { deps: { inline: [/@msagl\/core/] } },
  },
});
