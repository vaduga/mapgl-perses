import { PanelController } from "@vaduga/mapgl-core/runtime";
import {
  createGraphFrameViewState,
  resolveGraphPanelLayout,
} from "@vaduga/mapgl-core/graph/frame";
import { type ViewState } from "@vaduga/mapgl-core/types";
import type {
  GraphLayoutRequestInput,
  GraphLayoutWorkerResult,
} from "@vaduga/mapgl-core/graph/utils/layout-worker-client";
import { JsonGraphBindings, type GraphBindings } from "./input";
import { createGraphInput } from "./visuals";
import { createGraphRenderer } from "./layers";
import { PersesVisibility } from "./visibility";

export interface LayoutClient {
  requestLayout(
    input: GraphLayoutRequestInput,
  ): Promise<GraphLayoutWorkerResult | undefined>;
  dispose(): void;
}
/** One mounted panel owns this session and its core controller/worker. */
export class PersesGraphSession {
  readonly controller: PanelController;
  readonly renderer: ReturnType<typeof createGraphRenderer>;
  private readonly bindings = new JsonGraphBindings();
  private request = 0;
  private disposed = false;
  error?: string;
  constructor(private readonly layout: LayoutClient) {
    this.controller = new PanelController({
      layout: (context) =>
        resolveGraphPanelLayout(
          context,
          { config: { layoutDirection: "LR", edgeRouting: "Splines" } },
          async (input) => {
            if (!context.snapshot.nodes.length) return undefined;
            const result = await layout.requestLayout({
              ...input,
              signal: context.signal,
            });
            if (!result && context.isCurrent())
              throw new Error("Graph layout did not return positions.");
            return result;
          },
        ),
      prepareCommit: (state) => ({
        visibility: new PersesVisibility(
          state.graph.state.graph,
          state.visual.state.groups.length,
        ),
      }),
    });
    this.renderer = createGraphRenderer(this.controller);
  }
  async update(
    payload: unknown,
    options: GraphBindings,
    queryCount = 1,
  ): Promise<void> {
    if (this.disposed) return;
    const request = ++this.request;
    this.error = undefined;
    try {
      const source = this.bindings.bind(payload, options, queryCount);
      const result = await this.controller.update(
        createGraphInput(source, options),
      );
      const points = this.controller.stores.pointStore;
      // Core retains semantic focus keys across commits; clear a removed node.
      if (
        result?.ok &&
        !this.disposed &&
        request === this.request &&
        points.getHasFocusHighlight &&
        !points.getSelectedNode
      ) {
        this.controller.select(undefined);
      }
    } catch (error) {
      if (this.disposed || request !== this.request) return;
      this.error = error instanceof Error ? error.message : String(error);
      this.controller.invalidate();
      this.controller.setStatus(
        createGraphFrameViewState({
          phase: "fatal",
          pending: false,
          runtime: this.controller.state,
        }),
      );
    }
  }
  pick(info: unknown): void {
    const state = this.controller.state;
    if (!state || this.disposed) return;
    const key = this.renderer.resolvePick(info);
    if (key) this.controller.selectElement(key);
    else if (!(info as { picked?: boolean })?.picked)
      this.controller.select(undefined);
  }
  hover(info: unknown): void {
    if (!this.disposed)
      this.controller.stores.pointStore.focus(this.renderer.resolvePick(info));
  }
  viewport(value: ViewState): void {
    this.controller.setViewport(value);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.request++;
    this.renderer.dispose();
    this.controller.dispose();
    this.layout.dispose();
  }
}
