# Mapgl Perses

This repository is the public Perses panel shell. Shared graph/rendering behavior belongs to `../mapgl/panel-core`; Perses-specific integration belongs in `perses-adapter`.

- Use npm and the Rsbuild module federation configuration.
- Read `README.md` and the shared OpenSpec change before implementation.
- No Grafana imports, private Pro code, compatibility shims, vendor sync, or tarball generation during development.
- Build directly against OSS checkout sources when adding panel-core; preserve the sibling checkout layout in Docker.
- MVP: one JsonQuery, one abstract node graph layer, fixed appearance, automatic layout, pan/zoom, labels and basic selection. No Geo mode, ReactSelectSearch or layer editor.
- Never search for WASM sources; any future integration must use explicitly provided generated interfaces.
- `openspec` is a symlink to `../mapgl-spec/openspec`; keep planning artifacts in that store.

## Local build validation

- **Must restart the Perses dev container after every frontend rebuild** before browser validation. Rebuilding the federated panel entry changes its asset hash, and Perses can retain the previous federation manifest until the dev service restarts. From this repository, run `docker compose restart dev`.
