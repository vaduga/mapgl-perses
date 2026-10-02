import type {
  PluginModuleResource,
  PluginModuleSpec,
} from "@perses-dev/plugin-system";
import packageJson from "../package.json";

export function getPluginModule(): PluginModuleResource {
  return {
    kind: "PluginModule",
    metadata: { ...packageJson.perses.metadata, version: packageJson.version },
    spec: {
      schemasPath: packageJson.perses.schemasPath,
      plugins: packageJson.perses.plugins,
    } as PluginModuleSpec,
  };
}
