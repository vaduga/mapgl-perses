import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import {
  OrbitView,
  type PickingInfo,
  type ViewStateChangeParameters,
} from "@deck.gl/core";
import type { GraphViewport } from "@mapgl/perses-adapter";
import {
  PersesGraphSession,
  createLayoutClient,
  createGraphLayers,
  fitGraph,
  initialViewport,
} from "@mapgl/perses-adapter";
import type { MapglProps } from "./mapgl-types";
import "./mapgl.css";

const views = [new OrbitView({ id: "3d-scene", controller: true })];
export function MapglComponent({
  queryResults,
  spec,
  contentDimensions,
  definition,
}: MapglProps) {
  const container = useRef<HTMLDivElement>(null);
  const [session, setSession] = useState<PersesGraphSession>();
  const [revision, redraw] = useState(0);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [viewport, setViewport] = useState<GraphViewport>(initialViewport);
  const fitSignature = useRef<string>();
  useEffect(() => {
    const instance = new PersesGraphSession(createLayoutClient());
    fitSignature.current = undefined;
    const unsubscribe = instance.controller.subscribe((event) => {
      if (event.type !== "viewport") redraw((v) => v + 1);
    });
    setSession(instance);
    return () => {
      unsubscribe();
      instance.dispose();
    };
  }, []);
  useEffect(() => {
    const element = container.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) =>
      setDimensions({
        width: entry.contentRect.width,
        height: entry.contentRect.height,
      }),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const queryCount = definition?.spec.queries?.length ?? queryResults.length;
  useEffect(() => {
    void session?.update(queryResults[0]?.data?.data, spec, queryCount);
  }, [
    session,
    queryResults,
    spec.nodeIdField,
    spec.targetField,
    spec.labelField,
    queryCount,
  ]);
  const state = session?.controller.state;
  const view = session?.controller.view;
  const width = contentDimensions?.width ?? dimensions.width;
  const height = contentDimensions?.height ?? dimensions.height;
  useEffect(() => {
    if (!session || !state || !state.snapshot.nodes.length) return;
    const signature = state.snapshot.topologySignature;
    if (fitSignature.current === signature) return;
    const next = fitGraph(
      session.controller.scene.render.positions,
      width,
      height,
    );
    if (next) {
      fitSignature.current = signature;
      setViewport(next);
      session.controller.setViewport(next, "host");
    }
  }, [session, state, width, height]);
  const layers = useMemo(
    () => (session ? createGraphLayers(session.controller) : []),
    [session, state?.version, revision],
  );
  const selected = session?.controller.stores.pointStore.getSelectedNode;
  const selectedRecord =
    selected && state?.snapshot.nodes.find((node) => node.id === selected.id);
  const selectedLabel =
    selectedRecord &&
    state?.visual.state.nodes.find((node) => node.key === selectedRecord.key)
      ?.style.text;
  const status =
    session?.error ??
    (view?.pending
      ? "Calculating graph layout…"
      : view?.phase === "empty"
        ? "No graph nodes."
        : !state
          ? "Loading graph…"
          : undefined);
  return (
    <div
      ref={container}
      className="mapgl-perses"
      data-testid="mapgl-graph"
      data-phase={view?.phase ?? "loading"}
    >
      <DeckGL
        views={views}
        viewState={{ "3d-scene": viewport }}
        layers={layers}
        controller={{
          dragMode: "pan",
          dragRotate: false,
          touchRotate: false,
          doubleClickZoom: false,
          inertia: true,
        }}
        onViewStateChange={({ viewState }: ViewStateChangeParameters) => {
          const next = { ...viewport, ...viewState } as GraphViewport;
          setViewport(next);
          session?.viewport(next);
        }}
        onClick={(info: PickingInfo) => session?.pick(info)}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      />
      {status && (
        <div
          className="mapgl-perses-status"
          role={session?.error ? "alert" : "status"}
        >
          {status}
        </div>
      )}
      {!!view?.diagnostics.length && (
        <div className="mapgl-perses-diagnostics" role="status">
          {view.diagnostics.map((diagnostic) => (
            <div key={diagnostic.code}>
              {diagnostic.message} ({diagnostic.count})
            </div>
          ))}
        </div>
      )}
      <div className="mapgl-perses-summary" aria-label="Graph summary">
        {state
          ? `${state.snapshot.nodes.length} nodes · ${state.snapshot.relations.recordCount} edges`
          : ""}
      </div>
      {selectedRecord && (
        <div className="mapgl-perses-selection" role="status">
          <strong>{selectedLabel || selectedRecord.id}</strong>
          <span>Node ID: {selectedRecord.id}</span>
          <button
            onClick={() => session?.controller.select(undefined)}
            aria-label="Clear node selection"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
