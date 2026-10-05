import {
  PanelRenderSession,
  type PanelRenderOptions,
} from "@vaduga/mapgl-core/render/session";
import type { PanelController } from "@vaduga/mapgl-core/runtime";

/** Host presentation choices; scene capture, geometry, factories and focus live in core. */
export const graphRenderOptions: PanelRenderOptions = {
  presentation: {
    isLogic: true,
    pointType: "circle",
    nodeVisibilityName: "circle",
    labels: true,
    graphVisibilityName: null,
    pickable: true,
    labelPickable: false,
    autoHighlight: false,
  },
};
export function createGraphRenderer(controller: PanelController) {
  return new PanelRenderSession(controller, graphRenderOptions);
}
