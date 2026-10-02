import type { Layer } from "@deck.gl/core";
import {
  NodesGeojsonLayer,
  MainLabelTextLayer,
  EdgesGeojsonLayer,
  EdgeArrowLayer,
} from "@mapgl/panel-core/deckLayers";
import {
  buildGraphBinaryCollections,
  composeRenderLayers,
} from "@mapgl/panel-core/render";
import { getEdgesGeometry } from "@mapgl/panel-core/graph/utils";
import { Graph } from "@mapgl/panel-core/graph/main";
import type { PanelController } from "@mapgl/panel-core/runtime";

/** Only composes the public core factories; no graph geometry is reconstructed here. */
export function createGraphLayers(controller: PanelController): Layer[] {
  const state = controller.state;
  if (!state?.snapshot.nodes.length) return [];
  const render = controller.scene.render;
  const visibility = controller.scene.visibility;
  const graphs = [
    render.graph,
    ...(Array.from(render.graph.subgraphsBreadthFirst()) as Graph[]),
  ];
  const collections = buildGraphBinaryCollections({
    graphs,
    visibleNamespaces: visibility.getVisibleNamespaces(),
    features: render.features,
    positions: render.positions,
    colors: render.colors,
    muted: render.muted,
    annotations: render.annotations,
    groupIndices: render.groupIndices,
    showAnnotations: false,
    hide: false,
  });
  const props = {
    isLogic: true,
    isRouted: true,
    options: { common: {} },
    getVisLayers: visibility,
    getSelectedNode: controller.stores.pointStore.getSelectedNode,
    pickable: true,
    autoHighlight: true,
    highlightColor: [255, 210, 90, 180],
    visible: true,
    layoutGeometry: { ...render, edgeOffsetStrategies: [] },
    time: state.version,
    visRefresh: state.version,
  };
  const nodes = collections.map((biCol) =>
    NodesGeojsonLayer({ ...props, biCol, pointTypeOverride: "circle" }),
  );
  const labels = collections.map((biCol) =>
    MainLabelTextLayer({ ...props, biCol, pickable: false }),
  );
  const geometry = getEdgesGeometry({
    graph: render.graph,
    edgeIndex: render.edgeIndex,
    positions: render.positions,
    isLogic: true,
    visibleNamespaces: visibility.getVisibleNamespaces(),
    layerShift: {},
    layout: render,
    layoutReady: true,
    layoutIncludesProjection: false,
    snapshot: state.snapshot,
    edgeOffsetStrategies: [],
    terminalGeometryStrategies: [],
  });
  const edges = Object.entries(geometry[0]).flatMap(
    ([srcGraphId, features]) => {
      const edgeProps = {
        ...props,
        srcGraphId,
        linesCollection: { type: "FeatureCollection", features },
        edgeIndex: render.edgeIndex,
      };
      return [EdgesGeojsonLayer(edgeProps), EdgeArrowLayer(edgeProps)];
    },
  );
  return composeRenderLayers({ nodes, edges, labels });
}
