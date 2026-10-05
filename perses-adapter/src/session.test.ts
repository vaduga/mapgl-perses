import { describe, it, expect } from "vitest";
import { getLayoutResult } from "@vaduga/mapgl-core/graph/utils/layout-worker-runner";
import {
  createLayoutRequest,
  LayoutWorkerClient,
} from "@vaduga/mapgl-core/graph/utils/layout-worker-client";
type LayoutRequest = Parameters<typeof getLayoutResult>[0];
import { PersesGraphSession, type LayoutClient } from "./session";
import { initialViewport } from "./viewport";
const options = {
  nodeIdField: "id",
  targetField: "target",
  labelField: "label",
};
const rows = [
  { id: 0, target: "b", label: "Zero" },
  { id: 0, target: "c", label: "Duplicate" },
  { id: "b", target: null },
  { id: "c", target: null },
  { id: "isolated", target: null },
];
function client(): LayoutClient {
  return {
    requestLayout: async (input) => {
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
}

describe("core-backed Perses lifecycle", () => {
  it("normalizes fan-out and isolated nodes, uses primary-row labels and runs MSAGL layout", async () => {
    const session = new PersesGraphSession(client());
    await session.update(rows, options);
    expect(session.error).toBeUndefined();
    const state = session.controller.state!;
    expect(state.snapshot.nodes).toHaveLength(4);
    expect(state.snapshot.relations.recordCount).toBe(2);
    expect(state.visual.state.nodes[0].style.text).toBe("Zero");
    expect(state.snapshot.nodes[0].rows.map((row) => row.rowIndex)).toEqual([
      0, 1,
    ]);
    expect(new Set(Array.from(state.render.state.positions))).not.toEqual(
      new Set([7]),
    );
    expect(
      session.controller.scene.visibility.getVisibleNamespaces(),
    ).toContain("external");
    session.pick({ picked: true, object: state.visual.state.features[0] });
    expect(session.controller.stores.pointStore.getSelectedNode?.id).toBe("0");
    const revision = state.snapshot.frames[0].revision;
    session.viewport({ ...initialViewport, zoom: 1 });
    expect(session.controller.state!.snapshot.frames[0].revision).toBe(
      revision,
    );
    session.dispose();
  });
  it("surfaces dangling targets and preserves valid nodes without synthesis", async () => {
    const session = new PersesGraphSession(client());
    await session.update([{ id: "a", target: "missing" }], options);
    expect(session.controller.state!.snapshot.nodes).toHaveLength(1);
    expect(
      session.controller.view.diagnostics.some(
        (entry) => entry.code === "dangling-target",
      ),
    ).toBe(true);
    session.dispose();
  });
  it("keeps a failed refresh visibly fatal and clears a later successful empty result", async () => {
    const session = new PersesGraphSession(client());
    await session.update(rows, options);
    const committed = session.controller.state;
    await session.update([{ target: null }], options);
    expect(session.controller.state).toBe(committed);
    expect(session.error).toContain('field "id"');
    expect(session.controller.view.phase).toBe("fatal");
    await session.update([], options);
    expect(session.error).toBeUndefined();
    expect(session.controller.view.phase).toBe("empty");
    expect(session.controller.state!.snapshot.nodes).toHaveLength(0);
    session.dispose();
  });
  it("cancels obsolete worker requests and commits only the latest refresh", async () => {
    let handler: ((event: { data: unknown }) => void) | null = null;
    const requests: LayoutRequest[] = [];
    let terminated = false;
    const worker = {
      get onmessage() {
        return handler;
      },
      set onmessage(value) {
        handler = value;
      },
      onerror: null,
      postMessage(request: LayoutRequest) {
        requests.push(request);
      },
      terminate() {
        terminated = true;
      },
    };
    const layout = new LayoutWorkerClient(() => ({
      worker: worker as unknown as Worker,
      dispose: () => worker.terminate(),
    }));
    const session = new PersesGraphSession(layout);
    const first = session.update([{ id: "old", target: null }], options);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const second = session.update([{ id: "new", target: null }], options);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requests).toHaveLength(2);
    handler!({ data: getLayoutResult(requests[1]) });
    await second;
    handler!({ data: getLayoutResult(requests[0]) });
    await first;
    expect(session.controller.state!.snapshot.nodes[0].id).toBe("new");
    const invalidated = session.update(
      [{ id: "obsolete", target: null }],
      options,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    await session.update([{ target: null }], options);
    handler!({ data: getLayoutResult(requests[2]) });
    await invalidated;
    expect(session.controller.state!.snapshot.nodes[0].id).toBe("new");
    expect(session.controller.view.phase).toBe("fatal");
    const pending = session.update(
      [{ id: "unmounted", target: null }],
      options,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    session.dispose();
    await pending;
    expect(terminated).toBe(true);
    expect(session.controller.state).toBeUndefined();
    await session.update(rows, options);
    expect(session.controller.state).toBeUndefined();
  });
  it("isolates two panels", async () => {
    const one = new PersesGraphSession(client());
    const two = new PersesGraphSession(client());
    await Promise.all([one.update(rows, options), two.update(rows, options)]);
    one.pick({ object: one.controller.state!.visual.state.features[0] });
    expect(two.controller.stores.pointStore.getSelectedNode).toBeNull();
    one.dispose();
    expect(two.controller.view.phase).toBe("ready");
    two.dispose();
  });
});
