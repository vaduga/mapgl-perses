import { describe, it, expect } from "vitest";
import type { Layer } from "@deck.gl/core";
import { LayoutWorkerClient } from "@mapgl/panel-core/graph/utils/layout-worker-client";
import { getLayoutResult } from "@mapgl/panel-core/graph/utils/layout-worker-runner";
import { PersesGraphSession } from "./session";
import { createGraphLayers } from "./layers";
import { initialViewport } from "./viewport";

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
