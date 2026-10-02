import { defineConfig } from "vitest/config";
import { sourceAliases } from "./scripts/source-aliases";
export default defineConfig({
  resolve: { alias: sourceAliases },
  test: {
    include: ["perses-adapter/src/**/*.test.ts"],
    environment: "node",
    server: { deps: { inline: [/@msagl\/core/] } },
  },
});
