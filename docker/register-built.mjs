// Register the static federation build with the same local dev API as percli.
import { readFile } from "node:fs/promises";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const response = await fetch("http://127.0.0.1:8080/api/v1/plugins/dev", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify([
    {
      name: pkg.perses.metadata.name,
      version: pkg.version,
      url: "http://localhost:3001",
      absolute_path: process.cwd(),
    },
  ]),
});
if (!response.ok)
  throw new Error(`Built module registration: ${await response.text()}`);
console.log("Registered built Mapgl federation module");
