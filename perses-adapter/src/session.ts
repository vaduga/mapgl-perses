import { PanelController } from "@mapgl/panel-core/runtime";
import {
  createGraphFrameViewState,
  resolveGraphInteraction,
  resolveGraphPanelLayout,
} from "@mapgl/panel-core/graph/frame";
import { type ViewState } from "@mapgl/panel-core/types";
import type {
  GraphLayoutRequestInput,
  GraphLayoutWorkerResult,
} from "@mapgl/panel-core/graph/utils/layout-worker-client";
import { JsonGraphBindings, type GraphBindings } from "./input";
import { createGraphInput } from "./visuals";
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
    const interaction = resolveGraphInteraction(
      {
        snapshot: state.snapshot,
        graph: this.controller.scene.readGraph(),
        features: this.controller.scene.render.features,
      },
      info,
    );
    if (interaction?.kind === "node")
      this.controller.select({
        id: interaction.record.id,
        namespaceId: interaction.record.namespaceId,
      });
    else if (!(info as { picked?: boolean })?.picked)
      this.controller.select(undefined);
  }
  viewport(value: ViewState): void {
    this.controller.setViewport(value);
  }
  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.request++;
    this.controller.dispose();
    this.layout.dispose();
  }
}
