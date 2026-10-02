# Perses adapter

This local package connects one Perses JSON query to the public OSS panel-core source checkout. The host shell in `src/panels/mapgl` owns Perses registration, the field editor and React presentation.

- `input.ts` validates and snapshots rows as a revision-scoped `GraphSource` with node ID/target `ValueColumn`s, original row indexes and generic attribute access.
- `visuals.ts` compiles one fixed `GraphPipelineLayerInput` and `GraphVisualConfig` with `isLogic: true`.
- `session.ts` owns a `PanelController`/`GraphScene`, selection, errors and lifecycle, including clearing removed-node focus after successful current refreshes. Core normalization, graph construction and render data remain authoritative.
- `worker.ts` / `layout.worker.ts` instantiate the public `LayoutWorkerClient` and worker entry. MSAGL computes one LR/Splines layout; cancellation and disposal protect commits.
- `layers.ts` composes public `buildGraphBinaryCollections`, `getEdgesGeometry`, `NodesGeojsonLayer`, `MainLabelTextLayer`, `EdgesGeojsonLayer`, `EdgeArrowLayer` and `composeRenderLayers`, then applies `getDimmedGraphLayers` using the existing PointStore neighborhood. The factories receive scene visibility, render arrays/edge index, selected node, fixed common options and layout geometry with an empty `edgeOffsetStrategies` collection. No geometry algorithm is copied into this adapter.
- `viewport.ts` fits the core XY positions with a camera facing that plane. React controls subsequent pan/zoom and retains the viewport across same-topology refreshes and resize.

Tests use the real core normalizer/controller and layout runner. Worker lifecycle cases simulate the transport around the real `LayoutWorkerClient`, including stale results and unmounts. Focus integration tests use actual core node, label, curve and arrow layers to verify neighborhood opacity, retained picking, refresh reconciliation, immutable baseline colors and independent panel sessions.

Use the root scripts for tests, type checking and builds. Do not import Grafana adapters or private Pro code, and do not run packaging/vendor sync during source development.
