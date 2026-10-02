import { readFile } from "node:fs/promises";
const origin = "http://127.0.0.1:8080";
const resources = [
  ["projects", "mapgl", "project.json"],
  ["globaldatasources", "mapgl-json", "datasource.json"],
  ["projects/mapgl/dashboards", "mapgl-demo", "dashboard.json"],
];
for (const [collection, name, file] of resources) {
  const body = await readFile(`provisioning/${file}`, "utf8");
  let failure;
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const check = await fetch(`${origin}/api/v1/${collection}/${name}`);
      const response = await fetch(
        `${origin}/api/v1/${collection}${check.ok ? `/${name}` : ""}`,
        {
          method: check.ok ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      if (response.ok) {
        console.log(`Provisioned ${name}`);
        failure = undefined;
        break;
      }
      failure = await response.text();
    } catch (error) {
      failure = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  if (failure) throw new Error(`Could not provision ${name}: ${failure}`);
}
console.log("Demo: http://localhost:8090/projects/mapgl/dashboards/mapgl-demo");
