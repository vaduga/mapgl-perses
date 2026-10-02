#!/usr/bin/env bash
set -euo pipefail
server_pid=""
plugin_pid=""
cleanup() {
  if [[ -n "$plugin_pid" ]]; then kill "$plugin_pid" 2>/dev/null || true; fi
  if [[ -n "$server_pid" ]]; then kill "$server_pid" 2>/dev/null || true; fi
}
trap cleanup EXIT
trap 'exit 0' INT TERM
mkdir -p /perses/data /perses/plugins
perses --config=/workspace/mapgl-perses/docker/config.yaml --log.level=info &
server_pid=$!
node docker/wait-for.mjs http://127.0.0.1:8080/api/v1/projects
percli --percliconfig=/tmp/mapgl-percli.json login http://127.0.0.1:8080
if [[ "${MAPGL_PERSES_BUILT:-false}" == "true" ]]; then
  npm run build
  PERSES_CLI=true npm run preview &
  plugin_pid=$!
  node docker/wait-for.mjs http://127.0.0.1:3001/plugins/Mapgl/mf-manifest.json
  node docker/register-built.mjs
else
  percli --percliconfig=/tmp/mapgl-percli.json plugin start /workspace/mapgl-perses &
  plugin_pid=$!
fi
node docker/provision.mjs
wait -n "$server_pid" "$plugin_pid"
