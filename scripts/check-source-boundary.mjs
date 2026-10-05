import { readFileSync, realpathSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
const root = process.cwd();
const pkg = JSON.parse(readFileSync("package.json", "utf8"));
if (pkg.dependencies["@vaduga/mapgl-core"] !== "file:./panel-core")
  throw new Error("Core must remain a local checkout dependency");
if (realpathSync("panel-core") !== realpathSync("../mapgl/panel-core"))
  throw new Error("Core symlink must point to the OSS checkout");
if (
  /@grafana\/|mapgl-(?:extensions|pro|perses-pro)|file:vendor/.test(
    readFileSync("package-lock.json", "utf8"),
  )
)
  throw new Error("Host/private package leaked into dependencies");
function check(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) check(path);
    else if (
      /\.[cm]?[jt]sx?$/.test(path) &&
      /(?:from\s*|import\s*\()['"](?:@grafana\/|@(?:mapgl\/grafana-adapter|vaduga\/mapgl-grafana-adapter)|.*mapgl-(?:extensions|pro|perses-pro))/.test(
        readFileSync(path, "utf8"),
      )
    )
      throw new Error(`Forbidden host import in ${path}`);
  }
}
check(resolve(root, "src"));
check(resolve(root, "perses-adapter/src"));
console.log(
  "Public Perses shell consumes the local OSS core without Grafana or private packages.",
);
