import { resolve } from "node:path";
import { readFileSync } from "node:fs";

const root = process.cwd();
const core = resolve(root, "panel-core/src");
const peers = Object.keys(
  JSON.parse(readFileSync(resolve(root, "panel-core/package.json"), "utf8"))
    .peerDependencies,
);
export const sourceAliases = {
  "@mapgl/panel-core/featureContracts": resolve(
    core,
    "extension-points/featureContracts.ts",
  ),
  "@mapgl/panel-core/graph/packed-relations": resolve(
    core,
    "graph/frame/packedRelationReaders.ts",
  ),
  "@mapgl/panel-core": core,
  "@mapgl/perses-adapter": resolve(root, "perses-adapter/src"),
  ...Object.fromEntries(
    [...peers, "@msagl/core", "@loaders.gl/schema", "react-dom"].map((name) => [
      name,
      resolve(root, "node_modules", name),
    ]),
  ),
};
