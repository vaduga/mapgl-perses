// Adapted from the Perses percli panel module template (Apache-2.0).
import { pluginModuleFederation } from "@module-federation/rsbuild-plugin";
import { defineConfig } from "@rsbuild/core";
import { sourceAliases } from "./scripts/source-aliases";
import { pluginReact } from "@rsbuild/plugin-react";

const assetPrefix = "/plugins/Mapgl/";
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 3001,
    strictPort: true,
    cors: { origin: "*" },
    printUrls: process.env.PERSES_CLI
      ? ({ port }) => {
          console.log(
            `[PERSES_PLUGIN] PORT="${port}" NAME="Mapgl" PROTOCOL="http"`,
          );
          console.log(`Local: http://localhost:${port}`);
          return [];
        }
      : true,
  },
  dev: { assetPrefix },
  source: {
    alias: sourceAliases,
    include: [/panel-core[\\/]src/],
    entry: { main: "./src/index-federation.ts" },
  },
  output: {
    assetPrefix,
    copy: [
      { from: "package.json" },
      { from: "README.md" },
      { from: "LICENSE" },
    ],
    distPath: {
      root: "dist",
      js: "__mf/js",
      css: "__mf/css",
      font: "__mf/font",
    },
  },
  plugins: [
    pluginReact(),
    pluginModuleFederation({
      name: "Mapgl",
      exposes: { "./Mapgl": "./src/panels/mapgl" },
      shared: {
        react: { requiredVersion: "^18.2.0", singleton: true },
        "react-dom": { requiredVersion: "^18.2.0", singleton: true },
        "@perses-dev/plugin-system": { singleton: true },
      },
      dts: false,
      runtime: false,
      getPublicPath: `function() { return (window.PERSES_PLUGIN_ASSETS_PATH || window.PERSES_APP_CONFIG?.api_prefix || "") + "${assetPrefix}"; }`,
    }),
  ],
  tools: {
    htmlPlugin: false,
    rspack: (config) => {
      config.module ??= {};
      config.module.rules ??= [];
      config.module.rules.push({
        test: /mobx[\\/]dist[\\/]mobx\.esm\.js$/,
        type: "javascript/auto",
      });
      config.output ??= {};
      if (process.env.NODE_ENV !== "development")
        config.output.publicPath = "auto";
      return config;
    },
  },
});
