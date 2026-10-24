import { describe, expect, it } from "vitest";
import {
  graphTooltipSections,
  inspectGraphTooltip,
  inspectTooltipEdge,
  rebindGraphTooltip,
  type TooltipInspection,
} from "@vaduga/mapgl-core/components/Tooltips/GraphTooltip";
import { adjacentEdgeTooltipSectionContributor } from "@vaduga/mapgl-core/featureContracts";
import { getLayoutResult } from "@vaduga/mapgl-core/graph/utils/layout-worker-runner";
import { createLayoutRequest } from "@vaduga/mapgl-core/graph/utils/layout-worker-client";
import { blankHoverInfo } from "@vaduga/mapgl-core/types/defaults";
import { PersesGraphSession, type LayoutClient } from "./session";

const options = {
  nodeIdField: "id",
  targetField: "target",
  labelField: "label",
};
const rows = [
  { id: "a", target: ["a", "b", "c"], label: "Alpha", note: "route row" },
  { id: "a", target: "b", label: "Other Alpha", note: "direct row" },
  { id: "b", target: "c", label: "Beta", note: "b row" },
  { id: "c", target: null, label: "Gamma", note: "c row" },
];

function layoutClient() {
  let count = 0;
  let fail = false;
  let gate: Promise<void> | undefined;
  const client: LayoutClient = {
    async requestLayout(input) {
      count++;
      await gate;
      if (fail) throw Error("layout unavailable");
      const result = getLayoutResult(createLayoutRequest(input));
      return {
        positions: result.positions,
        graphBounds: new Map(result.graphs.map((graph) => [graph.id, graph])),
        curveGroups: new Map(
          (result.curveGroups ?? []).map((group) => [group.graphId, group]),
        ),
        edgeIndexes: new Map(),
        edgeKeys: [],
        arrowTips: new Map(),
      };
    },
    dispose() {},
  };
  return {
    client,
    requests: () => count,
    fail: (value: boolean) => {
      fail = value;
    },
    pause() {
      let resume!: () => void;
      gate = new Promise<void>((resolve) => {
        resume = resolve;
      });
      return () => {
        gate = undefined;
        resume();
      };
    },
  };
}
function scene(session: PersesGraphSession) {
  const input = session.renderer.frame!.input;
  return {
    snapshot: input.snapshot,
    render: input.render,
    isRouted: input.presentation.isRouted,
  };
}
function nodePick(session: PersesGraphSession, id: string) {
  return {
    picked: true,
    x: 80,
    y: 60,
    object: scene(session).render.features.find(
      (feature) => feature.locName === id,
    )!,
  };
}
function node(session: PersesGraphSession, id: string) {
  return inspectGraphTooltip(scene(session), nodePick(session, id))!;
}
function values(session: PersesGraphSession, inspection: TooltipInspection) {
  return Object.fromEntries(
    session
      .tooltipContent(inspection)!
      .properties!.map((row) => [row.key, row.text]),
  );
}

describe("Perses shared graph tooltip", () => {
  it("supplies the primary JSON row's own fields in order without dropping zero or false", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(
        [
          {
            id: 0,
            target: "b",
            label: "Zero",
            load: 0,
            enabled: false,
          },
          { id: 0, target: null, label: "Duplicate", load: 99 },
          { id: "b", target: null },
        ],
        options,
      );
      await session.renderer.build();
      const inspection = node(session, "0");
      expect(
        session.tooltipContent(inspection)!.properties!.map((row) => row.key),
      ).toEqual([
        "id",
        "target",
        "label",
        "load",
        "enabled",
      ]);
      expect(values(session, inspection)).toEqual({
        id: "0",
        target: "b",
        label: "Zero",
        load: "0",
        enabled: "false",
      });
    } finally {
      session.dispose();
    }
  });

  it("uses core adjacency counts and connection identities for repeated rows, self edges and isolated nodes", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(
        [
          { id: 0, target: "b" },
          { id: 0, target: "b" },
          { id: 0, target: 0 },
          { id: "b", target: null },
          { id: "isolated", target: null },
        ],
        options,
      );
      await session.renderer.build();
      const sections = (id: string) =>
        graphTooltipSections(
          scene(session),
          node(session, id),
          session.controller.stores.pointStore.graphHighlighter,
          [adjacentEdgeTooltipSectionContributor],
        );
      expect(sections("0")[0].outgoing).toHaveLength(2);
      expect(
        new Set(sections("0")[0].outgoing.map((record) => record.id)).size,
      ).toBe(2);
      expect(sections("b")[0].incoming).toHaveLength(1);
      expect(sections("isolated")).toEqual([]);
    } finally {
      session.dispose();
    }
  });

  it("uses route-row data for a clicked hop and whole-record data for an arc", async () => {
    const session = new PersesGraphSession(layoutClient().client);
    try {
      await session.update(rows, options);
      await session.renderer.build();
      const snapshot = session.controller.state!.snapshot;
      const routeRef = snapshot.relations.getRecordRefsById("a-c")![0];
      const edge = Array.from(
        scene(session).render.edgeIndex.recordEdges(routeRef),
      )[1];
      const hop = inspectTooltipEdge(scene(session), edge)!;
      expect(hop.target.hop?.ordinal).toBe(1);
      expect(hop.edge?.source.id).toBe("b");
      expect(values(session, hop).note).toBe("route row");
      const routed = session.controller.scene.visibility
        .getLayerTree()
        .find((layer) => layer.label === "Routed")!;
      session.controller.scene.setVisibility(routed, false, "group", []);
      await session.renderer.build();
      const arc = inspectGraphTooltip(scene(session), {
        object: { edgeId: "a-c" },
      })!;
      expect(arc.target.hop).toBeUndefined();
      expect(values(session, arc).note).toBe("route row");
    } finally {
      session.dispose();
    }
  });

  it("pins a canvas pick, restores a selected adjacency hop after hover and clears without layout or viewport changes", async () => {
    const layout = layoutClient();
    const session = new PersesGraphSession(layout.client);
    try {
      await session.update(rows, options);
      await session.renderer.build();
      session.pick(nodePick(session, "b"));
      const points = session.controller.stores.pointStore;
      expect(points.getTooltipObject).toMatchObject({
        x: 80,
        y: 60,
        mapglPinned: true,
      });
      const context = node(session, "b");
      const section = graphTooltipSections(
        scene(session),
        context,
        points.graphHighlighter,
        [adjacentEdgeTooltipSectionContributor],
      )[0];
      const selected = inspectTooltipEdge(
        scene(session),
        section.outgoing[0].edge,
      )!;
      points.setGraphTooltip({
        target: selected.target,
        context: context.target,
        anchor: { x: 80, y: 60 },
      });
      const state = session.controller.state;
      const viewport = session.controller.stores.viewStore.viewState;
      const requests = layout.requests();
      session.hover(nodePick(session, "a"));
      expect(points.focusedNodeId).toBe("a");
      session.hover({ picked: false });
      expect(points.focusedEdgeId).toBe(selected.edge!.id);
      expect(points.graphTooltip?.target).toEqual(selected.target);
      expect(session.controller.state).toBe(state);
      expect(layout.requests()).toBe(requests);
      expect(session.controller.stores.viewStore.viewState).toEqual(viewport);
      for (const outgoing of [true, false]) {
        points.setIsDefDir(outgoing);
        points.setEdgeListed(true);
        const id = outgoing ? "a" : "b";
        session.pick(nodePick(session, id));
        expect(points.getSelectedNode?.id).toBe(id);
        expect(points.getisEdgeListed).toBe(true);
        expect(points.isDefDir).toBe(outgoing);
      }
      points.setEdgeListed(false);
      session.pick(nodePick(session, "a"));
      expect(points.getisEdgeListed).toBe(false);
      session.pick({ picked: false });
      expect(points.graphTooltip).toBeUndefined();
      expect(points.getSelectedNode).toBeNull();
      expect(points.getHasFocusHighlight).toBe(false);
    } finally {
      session.dispose();
    }
  });

  it.each(["node", "routed edge", "arc edge"])(
    "restores the selected %s after closing its tooltip and hovering other objects",
    async (kind) => {
      const layout = layoutClient();
      const session = new PersesGraphSession(layout.client);
      try {
        await session.update(rows, options);
        if (kind === "arc edge") {
          const routed = session.controller.scene.visibility
            .getLayerTree()
            .find((layer) => layer.label === "Routed")!;
          session.controller.scene.setVisibility(routed, false, "group", []);
        }
        await session.renderer.build();
        const edgePick = (id: string) => {
          const input = scene(session);
          const record = input.snapshot!.relations.getRecordRefsById(id)![0];
          const edge = [...input.render.edgeIndex.recordEdges(record)].at(-1)!;
          return {
            picked: true,
            x: 80,
            y: 60,
            object: {
              edgeId: kind === "arc edge" ? id : edge.id,
              edgeRef:
                kind === "arc edge"
                  ? undefined
                  : input.render.edgeIndex.getEdgeRef(edge),
            },
          };
        };
        const pick = kind === "node" ? nodePick(session, "b") : edgePick("a-c");
        session.pick(pick);
        await session.renderer.build();
        const inspection = inspectGraphTooltip(scene(session), pick)!;
        const points = session.controller.stores.pointStore;
        // GraphTooltip retains its target with closed=true when the view is dismissed.
        points.setTooltipObject(blankHoverInfo);
        points.setGraphTooltip({
          target: inspection.target,
          anchor: { x: 80, y: 60 },
          closed: true,
        });
        const selected = points.getSelectedNode;
        const edges = points.getSelEdges;
        expect(selected?.id).toBe(kind === "node" ? "b" : "a");
        expect(edges.length).toBeGreaterThan(0);
        const focus = () => ({
          node: points.focusedNodeId,
          edge: points.focusedEdgeId,
          connected: [...points.getFocusedConnectedNodeIds].sort(),
        });
        const expectedFocus = focus();
        const pin = points.graphTooltip;
        const state = session.controller.state;
        const frame = session.renderer.frame;
        const viewport = session.controller.stores.viewStore.viewState;
        const requests = layout.requests();
        for (const hover of [pick, nodePick(session, "a"), edgePick("a-b")]) {
          session.hover(hover);
          if (hover !== pick) expect(focus()).not.toEqual(expectedFocus);
          expect(points.getSelectedNode).toBe(selected);
          expect(points.getSelEdges).toEqual(edges);
          session.hover({ picked: false });
          expect(focus()).toEqual(expectedFocus);
          expect(points.graphTooltip).toEqual(pin);
          expect(points.graphTooltip?.closed).toBe(true);
        }
        expect(session.controller.state).toBe(state);
        expect(session.renderer.frame).toBe(frame);
        expect(session.controller.stores.viewStore.viewState).toEqual(viewport);
        expect(layout.requests()).toBe(requests);
        session.pick({ picked: false });
        expect(points.getSelectedNode).toBeNull();
        expect(points.getSelEdges).toEqual([]);
        expect(points.graphTooltip).toBeUndefined();
        expect(points.getHasFocusHighlight).toBe(false);
      } finally {
        session.dispose();
      }
    },
  );

  it("keeps displayed properties through pending/failed refreshes and rejects old provenance after a successful refresh", async () => {
    const layout = layoutClient();
    const session = new PersesGraphSession(layout.client);
    try {
      await session.update(rows, options);
      await session.renderer.build();
      session.pick(nodePick(session, "a"));
      const old = node(session, "a");
      const state = session.controller.state;
      const resume = layout.pause();
      layout.fail(true);
      const pending = session.update(
        [
          ...rows.map((row) => ({ ...row, note: "pending data" })),
          { id: "new", target: null, label: "New", note: "new row" },
        ],
        options,
      );
      await new Promise((resolve) => setTimeout(resolve, 0));
      expect(values(session, old).note).toBe("route row");
      resume();
      await pending;
      expect(session.error).toBe("layout unavailable");
      expect(session.controller.state).toBe(state);
      expect(values(session, old).note).toBe("route row");
      layout.fail(false);
      await session.update(
        rows.map((row) => ({ ...row, note: "updated" })),
        options,
      );
      await session.renderer.build();
      expect(
        values(session, rebindGraphTooltip(scene(session), old.target)!).note,
      ).toBe("updated");
      expect(session.tooltipContent(old)).toBeUndefined();
      await session.update([{ id: "remaining", target: null }], options);
      expect(
        session.controller.stores.pointStore.getTooltipObject.object,
      ).toBeUndefined();
      expect(session.controller.stores.pointStore.getSelectedNode).toBeNull();
    } finally {
      session.dispose();
    }
  });
});
