# Mapgl for Perses

Public Perses panel shell with a local `@mapgl/perses-adapter`. The MVP displays one JSON query as an abstract node graph using the OSS Mapgl core: automatic left-to-right layout, directed edges, labels, pan/zoom and node ID/label selection.

## Local source development

Keep `mapgl-perses`, `mapgl` and `mapgl-spec` as sibling checkouts. The repository `panel-core -> ../mapgl/panel-core` symlink supplies `@mapgl/panel-core` through a local file dependency. TypeScript, Rsbuild and Vitest resolve its source entry points; no core build, package archive or vendor sync is needed. Bundler aliases resolve shared runtime dependencies from this shell to keep React, MobX and deck.gl identities consistent across the symlink.

```sh
npm ci
npm run test
npm run typecheck
npm run check:boundary
npm run build
```

`npm run build` creates the federation bundle and layout worker in `dist/`; it does not package panel-core. No Grafana or private Pro packages are installed.

## Docker development

```sh
docker compose up -d --build
```

Open [the demo dashboard](http://localhost:8090/projects/mapgl/dashboards/mapgl-demo). The stack registers the Mapgl module and CUE schema, provisions a project, JSON datasource and dashboard, and serves `fixtures/graph.json` through the datasource proxy. Perses and Rsbuild share a container so the CLI's localhost registration is reachable by the backend. Source changes rebuild automatically; reload the dashboard to load a changed federated component.

The OSS checkout is mounted read-only at `/workspace/mapgl`. Named volumes hold installed dependencies and Perses data. A separate dependency volume under panel-core isolates npm's writes from the sibling checkout. After dependency changes:

```sh
docker compose stop dev
docker compose run --rm --no-deps dev npm ci --no-audit --no-fund
docker compose up -d --build
```

To exercise the **built** federation bundle through the same local Perses host, without creating plugin archives:

```sh
MAPGL_PERSES_BUILT=true docker compose up -d --force-recreate dev
# Return to live source rebuilding:
docker compose up -d --force-recreate dev
# Stop the stack, retaining data and installed dependencies:
docker compose down
```

Provisioning is idempotent and resets the demo dashboard to `provisioning/dashboard.json` on each dev service start. Use a separate dashboard for changes you want to retain.

Verified versions: Perses `v0.55.0-beta.4`, bundled JSON module `0.1.0-beta.2`, plugin-system `0.55.0-beta.15`, spec `0.3.0-beta.10`, React `18.3.1`, Node `22.15.0` / npm `10.9.2` in Docker. JSON queries are a beta feature and are absent from stable Perses 0.54.

## JSON graph contract

Configure exactly one `JsonQuery`. The panel reads `queryResults[0].data.data` as an array of plain JSON objects. Use the JSON datasource's JSONata expression to reshape nested API responses before they reach the panel.

```json
[
  { "id": 0, "target": "api", "label": "Browser" },
  { "id": "api", "target": "database", "label": "API" },
  { "id": "database", "target": null, "label": "Database" },
  { "id": "isolated", "target": null }
]
```

The Graph options editor exposes only `nodeIdField`, `targetField`, and optional `labelField`, defaulting to `id`, `target`, and `label`. These are literal top-level property names, including names containing dots. Required mappings must contain a non-whitespace character; CUE rejects invalid saved settings.

IDs and nonempty targets must be strings or finite numbers; numeric zero is valid. Missing, null or empty-string targets make terminal/isolated nodes. The target field must exist in at least one nonempty row so a misspelled mapping is detected. Repeated IDs support fan-out, with the core selecting the primary row for the node label. Labels must be strings when present and fall back to the normalized ID. Dangling targets produce visible core diagnostics without synthesizing nodes. Arrays/objects as targets are rejected; emit one row per relationship instead.

The adapter clones and freezes accepted rows, preserves original row indexes, and assigns revisions only when query data or bindings change. It supplies the core `GraphSource` directly, without emulating Grafana DataFrames. Pan, zoom and selection do not change source revisions.

Successful empty responses clear the graph. Adapter/layout failures show an error while retaining previously committed data. Perses handles datasource loading and query errors. The viewport fits after a usable size and layout are available, preserves pan/zoom during same-topology refreshes and grid resize, and fits again when topology changes. Each mounted panel owns and disposes its controller, subscriptions and worker; obsolete layouts cannot commit.

Geographic maps, search, multiple graph layers, field overrides and Pro editing are outside this MVP.

## Verification (2026-10-02)

34 input, viewport and core-backed lifecycle tests pass, along with TypeScript, the source-boundary check and the federation build. Tests cover normalization, zero IDs, repeated rows, terminal/isolated nodes, dangling targets, labels/provenance, errors/empty data, out-of-order refreshes, invalidation, disposal and independent panel sessions.

The Docker dashboard renders five nodes and three directed edges from the JSON datasource. Browser checks verified labels, worker layout, picking/clear selection, pan/zoom, grid resize, viewport preservation across a changed-label refresh, malformed-target errors, empty-result clearing and saved mappings after reload. Blank and whitespace-only required mappings were rejected by the Perses API. The static federation bundle and its hashed worker/MSAGL assets also rendered successfully. Fresh storage provisioning and service restart were checked.

## Shared planning

`openspec -> ../mapgl-spec/openspec` attaches this repository to the shared OpenSpec store. The proposal, design, specs and completed tasks are in `add-perses-node-graph-mvp`; `openspec validate add-perses-node-graph-mvp --strict` validates the change.

Official references: [plugin creation](https://perses.dev/perses/docs/plugins/creation/), [JSON plugin release](https://github.com/perses/plugins/releases/tag/json/v0.1.0-beta.2), [Perses beta release](https://github.com/perses/perses/releases/tag/v0.55.0-beta.4).
