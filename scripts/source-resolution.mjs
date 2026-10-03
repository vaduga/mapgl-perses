import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const corePackage = JSON.parse(
  readFileSync(resolve("panel-core/package.json"), "utf8"),
);
// Linked sources share the shell's runtimes; package exports choose src entries.
export const runtimeDependencies = [
  ...Object.keys({ ...corePackage.peerDependencies, ...corePackage.dependencies }),
  "react-dom",
];
