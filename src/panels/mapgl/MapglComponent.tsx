import { useEffect, useRef, useState } from "react";
import { useRenderFrame } from "@vaduga/mapgl-core/render/react";
import { useDelayedHover } from "@vaduga/mapgl-core/render";
import DeckGL from "@deck.gl/react";
import { useTheme } from "@mui/material/styles";
import { GraphTooltip } from "@vaduga/mapgl-core/components/Tooltips/GraphTooltip";
import LayerSwitcher from "@vaduga/mapgl-core/components/Menu/LayerSwitcher";
import {
  OrbitView,
  type PickingInfo,
  type ViewStateChangeParameters,
} from "@deck.gl/core";
import type { GraphViewport } from "@vaduga/mapgl-perses-adapter";
import {
  PersesGraphSession,
  createLayoutClient,
  fitGraph,
  initialViewport,
} from "@vaduga/mapgl-perses-adapter";
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
  const [hoverInfo, setHoverInfo] = useState<PickingInfo>();
  const dark = useTheme().palette.mode === "dark";
  const [, redraw] = useState(0);
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
  const {
    frame,
    layers,
    error: renderError,
  } = useRenderFrame(session?.renderer);
  useEffect(() => setHoverInfo(undefined), [frame?.input.generation]);
  const focusHover = useDelayedHover((info) => session?.hover(info));
  const status =
    session?.error ??
    (renderError === undefined
      ? undefined
      : `Render update failed: ${renderError}`) ??
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
      style={{ colorScheme: dark ? "dark" : "light" }}
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
        onClick={(info: PickingInfo) => {
          session?.pick(info);
          setHoverInfo(undefined);
        }}
        onHover={(info: PickingInfo) => {
          setHoverInfo(info);
          focusHover(info);
        }}
        getCursor={({ isHovering }) => (isHovering ? "pointer" : "grab")}
      />
      {session && (
        <div
          className="mapgl-perses-controls"
          onPointerDown={(event) => event.stopPropagation()}
          onWheel={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
        >
          <LayerSwitcher
            label="Graph display"
            className="mapgl-perses-switcher"
            bindings={{
              visibility: session.controller.scene.visibility,
              readComments: () => [],
              setVisibility: (layer, visible, style) =>
                session.controller.scene.setVisibility(
                  layer,
                  visible,
                  style,
                  [],
                ),
            }}
          />
        </div>
      )}
      {status && (
        <div
          className="mapgl-perses-status"
          role={
            session?.error || renderError !== undefined ? "alert" : "status"
          }
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
      {session && frame && (
        <GraphTooltip
          controller={session.controller}
          scene={{
            snapshot: frame.input.snapshot,
            render: frame.input.render,
            isRouted: frame.input.presentation.isRouted,
          }}
          info={hoverInfo}
          dark={dark}
          getContent={(inspection) => session.tooltipContent(inspection)}
          onClose={() => {
            setHoverInfo(undefined);
          }}
        />
      )}
    </div>
  );
}
