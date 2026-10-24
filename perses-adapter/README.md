# Perses adapter

This local package connects one Perses JSON query to the public OSS panel-core source checkout. The host shell in `src/panels/mapgl` owns Perses registration, the field editor and React presentation.

- `input.ts` validates and snapshots rows as an adapter-owned `JsonGraphSource` with node ID/target `ValueColumn`s, original row indexes and generic attribute access. The immutable JSON rows supply explicit tooltip fields without enumerating runtime graph objects.
- `visuals.ts` compiles one fixed `GraphPipelineLayerInput` and `GraphVisualConfig` with `isLogic: true`.
- `session.ts` owns a `PanelController`/`GraphScene`, selection, errors and lifecycle, including clearing removed-node focus after successful current refreshes. It retains source snapshots through weak references keyed by accepted graph snapshots and prepares properties only when interaction provenance matches the displayed source revision. Core normalization, graph construction, tooltip state, adjacency and render data remain authoritative.
- `worker.ts` / `layout.worker.ts` instantiate the public `LayoutWorkerClient` and worker entry. MSAGL computes one LR/Splines layout; cancellation and disposal protect commits.
- `layers.ts` configures the core `PanelRenderSession`; it owns graph capture, geometry, factories, visibility and focus. The adapter supplies abstract-graph presentation options without copying a rendering algorithm.
- `visibility.ts` configures core `VisLayers` with internal source/namespace entries for rendering and only Nodes, Labels and Edges entries exposed to the switcher. Core scene reconciliation retains choices across commits. Node/label gates remain independent; curves and arrowheads share the Edges gate.
- `viewport.ts` fits the core XY positions with a camera facing that plane. React controls subsequent pan/zoom and retains the viewport across same-topology refreshes and resize.

Tests use the real core normalizer/controller and layout runner. Worker lifecycle cases simulate the transport around the real `LayoutWorkerClient`, including stale results and unmounts. Focus integration tests use actual core node, label, curve and arrow layers to verify neighborhood opacity, retained picking, refresh reconciliation, immutable baseline colors and independent panel sessions. Visibility tests also check real layer restoration, persistence through empty/error/changed data and layout failure without changing focus, positions or the camera.

Use the root scripts for tests, type checking and builds. Do not import Grafana adapters or private Pro code, and do not run packaging/vendor sync during source development.

The host imports the core LayerSwitcher source entry directly to avoid loading unrelated viewport components through the broad components barrel. It binds the current scene visibility, mutates through scene.setVisibility, and uses the switcher redraw callback to refresh deck layers. No core UI implementation is copied.

The host also imports the graph-only `GraphTooltip` entry, supplies the displayed frame and adapter-prepared properties, and reads the native Perses MUI theme mode through the host-shared Emotion context. Core supplies the frame, light/dark icon defaults, adjacency controls, edge inspection and pin/highlight restoration. Closing the tooltip retains selection and its focus target; hover previews restore that focus when the pointer leaves, without reopening the closed view. Background clicks clear the core pin/selection without changing layout or viewport.
