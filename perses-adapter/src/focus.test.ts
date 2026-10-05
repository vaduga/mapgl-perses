import { describe, it, expect } from "vitest";
import type { Layer } from "@deck.gl/core";
import { LayoutWorkerClient } from "@vaduga/mapgl-core/graph/utils/layout-worker-client";
import { getLayoutResult } from "@vaduga/mapgl-core/graph/utils/layout-worker-runner";
import { PersesGraphSession } from "./session";
import { createGraphRenderer } from "./layers";
function createGraphLayers(
  controller: import("@vaduga/mapgl-core/runtime").PanelController,
  _revision = 0,
) {
  const renderer = createGraphRenderer(controller);
  void renderer.build();
  const layers = [...renderer.layers];
  renderer.dispose();
  return layers;
}
import { getSelectedNodeDetails, getNodeDetails } from "./selection";
import { initialViewport } from "./viewport";
import demoRows from "../../fixtures/graph.json";

const options = {
  nodeIdField: "id",
  targetField: "target",
  labelField: "label",
};
const rows = [
  { id: 0, target: "api", label: "Browser" },
  { id: "api", target: "database", label: "API" },
  { id: "database", target: null, label: "Database" },
  { id: "worker", target: "database", label: "Worker" },
  { id: "isolated", target: null, label: "Isolated" },
];

// Real worker client and MSAGL runner; only the asynchronous transport is local.
function layoutClient() {
  let requests = 0;
  let disposed = false;
  const worker = {
    onmessage: null as
      null | ((event: { data: ReturnType<typeof getLayoutResult> }) => void),
    onerror: null,
    postMessage(request: Parameters<typeof getLayoutResult>[0]) {
      requests++;
      queueMicrotask(() => {
        if (!disposed) worker.onmessage?.({ data: getLayoutResult(request) });
      });
    },
    terminate() {
      disposed = true;
    },
  };
  const client = new LayoutWorkerClient(() => ({
    worker: worker as unknown as Worker,
    dispose: () => worker.terminate(),
  }));
  return { client, requests: () => requests };
}
function select(session: PersesGraphSession, id: string) {
  const feature = session.controller.scene.render.features.find(
    (feature) => feature.locName === id,
  )!;
  expect(feature).toBeDefined();
  session.pick({ picked: true, object: feature });
}
function connected(session: PersesGraphSession) {
  return Array.from(
    session.controller.stores.pointStore.getFocusedConnectedNodeIds,
    (key) => key.split("\u0000").at(-1),
  ).sort();
}
function nodeAlphas(layers: Layer[]) {
  const layer = layers.find((layer) => (layer.props.data as any)?.points)!;
  const points = (layer.props.data as any).points;
  return Object.fromEntries(
    Array.from(points.featureIds.value as Uint32Array, (featureId, index) => [
      points.properties[featureId].locName,
      points.attributes.getFillColor.value[index * 4 + 3],
    ]),
  );
}
function labelAlphas(layers: Layer[]) {
  const layer = layers.find((layer) => layer.id.includes("-view-label-text"))!;
  const data = layer.props.data as any;
  return Object.fromEntries(
    data.map((feature: any, index: number) => [
      feature.properties.locName,
      data.attributes.getColor.value[index * 4 + 3],
    ]),
  );
}

describe("Perses neighborhood focus through public core layers", () => {
  it("renders the demo multi-hop path as one logical edge and focuses every hop from a curve or arc pick", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(demoRows, options);
      await session.renderer.build();
      const snapshot = session.controller.state!.snapshot;
      expect(snapshot.nodes).toHaveLength(10);
      expect(snapshot.relations.recordCount).toBe(12);
      const recordRef =
        snapshot.relations.getRecordRefsById("gateway-metrics")![0];
      const unitRef = snapshot.relations.getRecordUnitStart(recordRef);
      expect(
        snapshot.relations.materializeUnitRoute(
          unitRef,
          (ref) => snapshot.nodes[ref].id,
        ),
      ).toEqual(["gateway", "api", "queue", "worker", "metrics"]);
      const frame = session.renderer.frame!;
      const index = frame.input.render.edgeIndex;
      const hops = Array.from(index.recordEdges(recordRef));
      expect(hops).toHaveLength(4);
      const curve = session.renderer.layers.find((layer) =>
        layer.id.startsWith("edges-view"),
      )!;
      const data = curve.props.data as any;
      const mappings = hops.map(
        (edge) => frame.prepared.geometry.mappings[index.getEdgeRef(edge)!]!,
      );
      const lineIds = mappings.map((mapping) => mapping.lineId!);
      const frameBeforeHover = session.renderer.frame;
      (curve as any).state = {};
      for (const featureIndex of lineIds) {
        const segmentIndex = (data.segmentFeatureIndexes as Int32Array).indexOf(
          featureIndex,
        );
        expect(segmentIndex).toBeGreaterThanOrEqual(0);
        const pick = (curve as any).getPickingInfo({
          info: { picked: true, index: segmentIndex },
        });
        expect(pick.object).toBe(data.features[featureIndex]);
        session.hover(pick);
        const focusedCurve = session.renderer.layers.find((layer) =>
          layer.id.startsWith("edges-view"),
        )!;
        for (const hopIndex of lineIds)
          expect(
            (focusedCurve.props as any).getHighlightDepth({
              featureIndex: hopIndex,
            }),
          ).toBe(0);
        expect(connected(session)).toEqual(["gateway", "metrics"]);
        expect(session.renderer.frame).toBe(frameBeforeHover);
      }
      session.hover({ picked: false });
      expect(session.controller.stores.pointStore.getHasFocusHighlight).toBe(
        false,
      );
      session.pick({
        picked: true,
        object: data.features[lineIds[3]],
        index: lineIds[3],
      });
      expect(session.controller.stores.pointStore.getSelectedNode?.id).toBe(
        "gateway",
      );
      expect(connected(session)).toEqual(["gateway", "metrics"]);
      const focusedCurve = session.renderer.layers.find((layer) =>
        layer.id.startsWith("edges-view"),
      )!;
      for (const featureIndex of lineIds)
        expect(
          (focusedCurve.props as any).getHighlightDepth({ featureIndex }),
        ).toBe(0);
      expect(
        session.controller.stores.pointStore.getFocusedConnectedEdgeIndexes
          .map((mapping) => mapping.lineId)
          .sort(),
      ).toEqual([...lineIds].sort());
      toggle(session, "Routed", false);
      await session.renderer.build();
      const arcLayer = session.renderer.layers.find((layer) =>
        layer.id.startsWith("edges-arc-base"),
      )!;
      const arc = (arcLayer.props.data as any[])[mappings[0].arcId!];
      session.pick({ picked: true, object: arc });
      expect(session.controller.stores.pointStore.getSelectedNode?.id).toBe(
        "gateway",
      );
      expect(connected(session)).toEqual(["gateway", "metrics"]);
      expect(
        (arcLayer.props.data as any[]).filter(
          (arc) => arc.edgeId === "gateway-metrics",
        ),
      ).toHaveLength(1);
    } finally {
      session.dispose();
    }
  });

  it("emphasizes only one-hop incoming/outgoing nodes, labels, routed curves and arrows without changing baseline colors", async () => {
    const { client } = layoutClient();
    const session = new PersesGraphSession(client);
    try {
      await session.update(rows, options);
      const baseline = createGraphLayers(session.controller);
      const baseAlphas = nodeAlphas(baseline);
      const colors = session.controller.scene.render.colors.slice();
      select(session, "api");
      expect(connected(session)).toEqual(["0", "api", "database"]);
      const layers = createGraphLayers(session.controller);
      expect(nodeAlphas(layers)).toEqual({
        "0": 255,
        api: 255,
        database: 255,
        worker: 46,
        isolated: 46,
      });
      const labels = labelAlphas(layers);
      expect(labels.worker).toBeLessThan(labels.api);
      expect(labels.isolated).toBeLessThan(labels.database);
      const curve = layers.find((layer) => layer.id.startsWith("edges-view"))!;
      const curveData = curve.props.data as any;
      expect(curveData.length).toBeGreaterThan(0);
      const depths = Array.from(
        curveData.segmentFeatureIndexes as Int32Array,
        (featureIndex) =>
          (curve.props as any).getHighlightDepth({ featureIndex }),
      );
      expect(depths).toContain(1);
      expect(depths).toContain(Number.MAX_SAFE_INTEGER);
      const arrows = layers.find((layer) =>
        layer.id.startsWith("edges-arrow-"),
      )!;
      const arrowData = arrows.props.data as any[];
      expect(arrowData).toHaveLength(3);
      expect(
        arrowData
          .map(
            (arrow, index) =>
              (arrows.props as any).getColor(arrow, { index })[3],
          )
          .sort((a, b) => a - b),
      ).toEqual([46, 255, 255]);
      expect(
        layers
          .filter(
            (layer) =>
              layer.id.startsWith("edges") || (layer.props.data as any)?.points,
          )
          .every((layer) => layer.props.pickable),
      ).toBe(true);
      expect(nodeAlphas(baseline)).toEqual(baseAlphas);
      expect(session.controller.scene.render.colors).toEqual(colors);
      session.controller.select(undefined);
      expect(session.controller.stores.pointStore.getHasFocusHighlight).toBe(
        false,
      );
      expect(nodeAlphas(createGraphLayers(session.controller))).toEqual(
        baseAlphas,
      );
    } finally {
      session.dispose();
    }
  });

  it("handles terminal, isolated and zero IDs, switches selection, and preserves viewport/revision/layout", async () => {
    const layout = layoutClient();
    const session = new PersesGraphSession(layout.client);
    try {
      await session.update(rows, options);
      session.viewport({ ...initialViewport, zoom: 1, target: [70, 80, 0] });
      const viewport = session.controller.stores.viewStore.viewState;
      const committed = session.controller.state;
      const requests = layout.requests();
      select(session, "database");
      expect(connected(session)).toEqual(["api", "database", "worker"]);
      select(session, "isolated");
      expect(connected(session)).toEqual(["isolated"]);
      expect(
        session.controller.stores.pointStore.getFocusedConnectedEdgeIndexes,
      ).toEqual([]);
      select(session, "0");
      expect(connected(session)).toEqual(["0", "api"]);
      expect(nodeAlphas(createGraphLayers(session.controller)).database).toBe(
        46,
      );
      session.pick({ picked: false });
      expect(session.controller.stores.pointStore.getSelectedNode).toBeNull();
      expect(session.controller.stores.pointStore.getHasFocusHighlight).toBe(
        false,
      );
      expect(nodeAlphas(createGraphLayers(session.controller)).database).toBe(
        255,
      );
      expect(layout.requests()).toBe(requests);
      expect(session.controller.state).toBe(committed);
      expect(session.controller.stores.viewStore.viewState).toEqual(viewport);
    } finally {
      session.dispose();
    }
  });

  it("recomputes a surviving selection, retains focus on failure and clears focus when removed or empty", async () => {
    const { client } = layoutClient();
    const session = new PersesGraphSession(client);
    try {
      await session.update(rows, options);
      select(session, "api");
      await session.update(
        rows.map((row) =>
          row.id === "api" ? { ...row, target: "worker" } : row,
        ),
        options,
      );
      expect(connected(session)).toEqual(["0", "api", "worker"]);
      expect(session.controller.stores.pointStore.getSelectedNode?.id).toBe(
        "api",
      );
      await session.update([{ id: "invalid", target: [] }], options);
      expect(session.error).toBeDefined();
      expect(connected(session)).toEqual(["0", "api", "worker"]);
      await session.update(
        rows
          .filter((row) => row.id !== "api")
          .map((row) => (row.id === 0 ? { ...row, target: null } : row)),
        options,
      );
      expect(session.controller.stores.pointStore.getSelectedNode).toBeNull();
      expect(session.controller.stores.pointStore.getHasFocusHighlight).toBe(
        false,
      );
      expect(
        Object.values(nodeAlphas(createGraphLayers(session.controller))),
      ).toEqual([255, 255, 255, 255]);
      select(session, "worker");
      await session.update([], options);
      expect(session.controller.stores.pointStore.getHasFocusHighlight).toBe(
        false,
      );
      expect(createGraphLayers(session.controller)).toEqual([]);
    } finally {
      session.dispose();
    }
  });

  it("keeps focus and dimming local to each panel", async () => {
    const one = new PersesGraphSession(layoutClient().client);
    const two = new PersesGraphSession(layoutClient().client);
    try {
      await Promise.all([one.update(rows, options), two.update(rows, options)]);
      select(one, "api");
      expect(nodeAlphas(createGraphLayers(one.controller)).worker).toBe(46);
      expect(nodeAlphas(createGraphLayers(two.controller)).worker).toBe(255);
      select(two, "worker");
      expect(connected(one)).toEqual(["0", "api", "database"]);
      expect(connected(two)).toEqual(["database", "worker"]);
      one.controller.select(undefined);
      expect(nodeAlphas(createGraphLayers(one.controller)).worker).toBe(255);
      expect(nodeAlphas(createGraphLayers(two.controller)).api).toBe(46);
    } finally {
      one.dispose();
      two.dispose();
    }
  });
});

function toggle(session: PersesGraphSession, label: string, visible: boolean) {
  const layer = session.controller.scene.visibility
    .getLayerTree()
    .find((layer) => layer.label === label)!;
  expect(layer).toBeDefined();
  session.controller.scene.setVisibility(layer, visible, "group", []);
}
function displayLayers(session: PersesGraphSession) {
  const layers = createGraphLayers(
    session.controller,
    session.controller.scene.revision,
  );
  return {
    nodes: layers.find((layer) => (layer.props.data as any)?.points)!,
    labels: layers.find((layer) => layer.id.includes("-view-label-text"))!,
    edges: layers.filter((layer) => layer.id.startsWith("edges")),
  };
}

describe("Perses core LayerSwitcher visibility integration", () => {
  it("switches routed curves/arrows and non-routed arcs without layout, loses no visibility choices or edge focus", async () => {
    const layout = layoutClient();
    const session = new PersesGraphSession(layout.client);
    try {
      await session.update(rows, options);
      await session.renderer.build();
      const routed = session.renderer.layers.find((layer) =>
        layer.id.startsWith("edges-view"),
      )!;
      const feature = (routed.props.data as any).features.find(
        (feature: any) => feature.edgeId,
      );
      session.pick({ picked: true, object: feature });
      expect(connected(session)).toEqual(["0", "api"]);
      expect(session.controller.stores.pointStore.focusedEdgeId).toBe(
        feature.edgeId,
      );
      session.viewport({ ...initialViewport, zoom: 1, target: [30, 50, 0] });
      const viewport = session.controller.stores.viewStore.viewState;
      const prepared = session.renderer.frame!.prepared;
      const state = session.controller.state;
      const requests = layout.requests();
      toggle(session, "Routed", false);
      await session.renderer.build();
      expect(session.renderer.frame!.input.presentation.isRouted).toBe(false);
      expect(session.renderer.frame!.prepared.geometry).toEqual(
        prepared.geometry,
      );
      expect(
        session.renderer.layers.some((layer) =>
          layer.id.startsWith("edges-view"),
        ),
      ).toBe(false);
      const arcs = session.renderer.layers.filter((layer) =>
        layer.id.startsWith("edges-arc"),
      );
      expect(arcs).toHaveLength(2);
      const arc = arcs.find((layer) => layer.id.startsWith("edges-arc-base"))!;
      const arcData = arc.props.data as any[];
      session.pick({ picked: true, object: arcData[2] });
      expect(connected(session)).toEqual(["database", "worker"]);
      expect(session.controller.stores.pointStore.focusedEdgeId).toBe(
        arcData[2].edgeId,
      );
      toggle(session, "Edges", false);
      await session.renderer.build();
      expect(
        session.renderer.layers
          .filter((layer) => layer.id.startsWith("edges-arc"))
          .every((layer) => !layer.props.visible),
      ).toBe(true);
      await session.update(
        rows.map((row) => ({ ...row, label: row.label + " updated" })),
        options,
      );
      await session.renderer.build();
      expect(session.renderer.frame!.input.presentation.isRouted).toBe(false);
      expect(connected(session)).toEqual(["database", "worker"]);
      toggle(session, "Routed", true);
      toggle(session, "Edges", true);
      await session.renderer.build();
      const curve = session.renderer.layers.find((layer) =>
        layer.id.startsWith("edges-view"),
      )!;
      expect(curve.props.visible).toBe(true);
      const curveData = curve.props.data as any;
      const depths = Array.from(
        curveData.segmentFeatureIndexes as Int32Array,
        (featureIndex) =>
          (curve.props as any).getHighlightDepth({ featureIndex }),
      );
      expect(depths).toContain(0);
      expect(depths).toContain(Number.MAX_SAFE_INTEGER);
      expect(session.controller.stores.viewStore.viewState).toEqual(viewport);
      expect(layout.requests()).toBe(requests);
      expect(session.controller.state!.snapshot.topologySignature).toBe(
        state!.snapshot.topologySignature,
      );
      session.pick({ picked: false });
      expect(session.controller.stores.pointStore.getHasFocusHighlight).toBe(
        false,
      );
    } finally {
      session.dispose();
    }
  });

  it("exposes display and route controls, independently toggles real layers and preserves focused layout/viewport", async () => {
    const layout = layoutClient();
    const session = new PersesGraphSession(layout.client);
    try {
      await session.update(rows, options);
      expect(
        session.controller.scene.visibility
          .getLayerTree()
          .map((layer) => [layer.label, layer.visible]),
      ).toEqual([
        ["Nodes", true],
        ["Labels", true],
        ["Edges", true],
        ["Routed", true],
      ]);
      select(session, "api");
      session.viewport({ ...initialViewport, zoom: 1, target: [30, 50, 0] });
      const viewport = session.controller.stores.viewStore.viewState;
      const baseline = session.controller.state;
      const positions = session.controller.scene.render.positions;
      const colors = session.controller.scene.render.colors.slice();
      const requests = layout.requests();
      toggle(session, "Nodes", false);
      expect(displayLayers(session).nodes.props.visible).toBe(false);
      expect(displayLayers(session).labels.props.visible).toBe(true);
      expect(
        displayLayers(session).edges.every((layer) => layer.props.visible),
      ).toBe(true);
      toggle(session, "Labels", false);
      expect(displayLayers(session).labels.props.visible).toBe(false);
      toggle(session, "Edges", false);
      const edges = displayLayers(session).edges;
      expect(edges.some((layer) => layer.id.startsWith("edges-arrow-"))).toBe(
        true,
      );
      expect(edges.some((layer) => layer.id.startsWith("edges-view"))).toBe(
        true,
      );
      expect(edges.every((layer) => layer.props.visible === false)).toBe(true);
      for (const label of ["Nodes", "Labels", "Edges"])
        toggle(session, label, true);
      const restored = displayLayers(session);
      expect(
        [restored.nodes, restored.labels, ...restored.edges].every(
          (layer) => layer.props.visible,
        ),
      ).toBe(true);
      expect(nodeAlphas(createGraphLayers(session.controller)).worker).toBe(46);
      expect(connected(session)).toEqual(["0", "api", "database"]);
      expect(session.controller.state).toBe(baseline);
      expect(session.controller.scene.render.positions).toBe(positions);
      expect(session.controller.scene.render.colors).toEqual(colors);
      expect(session.controller.stores.viewStore.viewState).toEqual(viewport);
      expect(layout.requests()).toBe(requests);
    } finally {
      session.dispose();
    }
  });

  it("preserves choices on data/tree replacement, errors, empty responses and recovery", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(rows, options);
      toggle(session, "Labels", false);
      toggle(session, "Edges", false);
      const original = session.controller.scene.visibility;
      await session.update(
        rows.concat([{ id: "new", target: null, label: "New" }]),
        options,
      );
      expect(session.controller.scene.visibility).not.toBe(original);
      expect(displayLayers(session).nodes.props.visible).toBe(true);
      expect(displayLayers(session).labels.props.visible).toBe(false);
      expect(
        displayLayers(session).edges.every(
          (layer) => layer.props.visible === false,
        ),
      ).toBe(true);
      await session.update([{ id: "bad", target: [] }], options);
      expect(session.error).toBeDefined();
      await session.update([], options);
      expect(createGraphLayers(session.controller)).toEqual([]);
      await session.update(rows, options);
      expect(
        session.controller.scene.visibility
          .getLayerTree()
          .map((layer) => layer.visible),
      ).toEqual([true, false, false, true]);
      toggle(session, "Labels", true);
      expect(displayLayers(session).labels.props.visible).toBe(true);
    } finally {
      session.dispose();
    }
  });

  it("retains visibility on layout failure and keeps mounted panels independent", async () => {
    const layout = layoutClient();
    let fail = false;
    const one = new PersesGraphSession({
      requestLayout: (input) =>
        fail
          ? Promise.reject(new Error("layout unavailable"))
          : layout.client.requestLayout(input),
      dispose: () => layout.client.dispose(),
    });
    const two = new PersesGraphSession(layoutClient().client);
    try {
      await Promise.all([one.update(rows, options), two.update(rows, options)]);
      toggle(one, "Nodes", false);
      toggle(one, "Edges", false);
      fail = true;
      await one.update(
        rows.concat([{ id: "new", target: null, label: "New" }]),
        options,
      );
      expect(one.error).toBe("layout unavailable");
      expect(displayLayers(one).nodes.props.visible).toBe(false);
      expect(
        displayLayers(one).edges.every(
          (layer) => layer.props.visible === false,
        ),
      ).toBe(true);
      expect(displayLayers(two).nodes.props.visible).toBe(true);
      expect(
        displayLayers(two).edges.every((layer) => layer.props.visible),
      ).toBe(true);
    } finally {
      one.dispose();
      two.dispose();
    }
  });
});

describe("Perses selected-node core relationship sections", () => {
  it("resolves labels and zero IDs, navigates neighbors without layout and handles isolated/terminal nodes", async () => {
    const layout = layoutClient();
    const session = new PersesGraphSession(layout.client);
    try {
      await session.update(rows, options);
      select(session, "api");
      const selected = getSelectedNodeDetails(session.controller)!;
      expect(selected.label).toBe("API");
      expect(selected.sections).toHaveLength(1);
      const section = selected.sections[0];
      expect(section.incoming).toHaveLength(1);
      expect(section.outgoing).toHaveLength(1);
      const neighbor = getNodeDetails(
        session.controller,
        section.incoming[0].source,
      )!;
      expect(neighbor).toMatchObject({ id: "0", label: "Browser" });
      session.viewport({ ...initialViewport, zoom: 1, target: [30, 50, 0] });
      const viewport = session.controller.stores.viewStore.viewState;
      const state = session.controller.state;
      const requests = layout.requests();
      session.controller.select({
        id: neighbor.id,
        namespaceId: neighbor.namespaceId,
      });
      expect(getSelectedNodeDetails(session.controller)?.id).toBe("0");
      expect(connected(session)).toEqual(["0", "api"]);
      expect(layout.requests()).toBe(requests);
      expect(session.controller.state).toBe(state);
      expect(session.controller.stores.viewStore.viewState).toEqual(viewport);
      select(session, "database");
      expect(
        getSelectedNodeDetails(session.controller)?.sections[0].incoming,
      ).toHaveLength(2);
      expect(
        getSelectedNodeDetails(session.controller)?.sections[0].outgoing,
      ).toHaveLength(0);
      select(session, "isolated");
      expect(getSelectedNodeDetails(session.controller)?.sections).toEqual([]);
      session.controller.select(undefined);
      expect(getSelectedNodeDetails(session.controller)).toBeUndefined();
    } finally {
      session.dispose();
    }
  });

  it("refreshes connections and labels, retains committed details on errors, and removes stale selection", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(rows, options);
      select(session, "api");
      await session.update(
        rows.map((row) =>
          row.id === "api"
            ? { ...row, target: "worker", label: "Updated API" }
            : row,
        ),
        options,
      );
      const details = getSelectedNodeDetails(session.controller)!;
      expect(details.label).toBe("Updated API");
      expect(
        getNodeDetails(
          session.controller,
          details.sections[0].outgoing[0].target,
        )?.label,
      ).toBe("Worker");
      await session.update([{ id: "bad", target: [] }], options);
      expect(getSelectedNodeDetails(session.controller)?.label).toBe(
        "Updated API",
      );
      await session.update(
        rows
          .filter((row) => row.id !== "api")
          .map((row) => (row.id === 0 ? { ...row, target: null } : row)),
        options,
      );
      expect(getSelectedNodeDetails(session.controller)).toBeUndefined();
    } finally {
      session.dispose();
    }
  });

  it("follows core repeated-row deduplication and outgoing self relationships", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(
        [
          { id: "a", target: "b" },
          { id: "a", target: "b" },
          { id: "a", target: "a" },
          { id: "b", target: null },
        ],
        options,
      );
      select(session, "a");
      const section = getSelectedNodeDetails(session.controller)!.sections[0];
      expect(section.outgoing).toHaveLength(2);
      expect(section.incoming).toHaveLength(0);
      expect(new Set(section.outgoing.map((record) => record.id)).size).toBe(2);
    } finally {
      session.dispose();
    }
  });
});
