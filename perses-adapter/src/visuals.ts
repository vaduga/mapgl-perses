import type { GraphSource } from "@vaduga/mapgl-core/data";
import type {
  GraphPipelineInput,
  GraphStyleChannels,
  GraphVisualConfig,
} from "@vaduga/mapgl-core/graph/frame";
import type { GraphBindings } from "./input";

export function createGraphInput(
  source: GraphSource,
  bindings: GraphBindings,
): GraphPipelineInput {
  const scope = {
    revision: source.revision,
    sourceIndex: source.index,
    sourceKey: source.key,
  };
  const node: GraphStyleChannels = {
    scope,
    base: {
      color: "#4da6ff",
      size: 32,
      opacity: 1,
      textConfig: { fontSize: 13 },
    },
    isFixed: true,
    text: {
      get: (row) => {
        const label = bindings.labelField
          ? source.value(bindings.labelField, row)
          : undefined;
        return typeof label === "string" && label.trim()
          ? label
          : String(source.nodeId.get(row)).trim();
      },
    },
  };
  const edge: GraphStyleChannels = {
    scope,
    base: { color: "#7b9ec4", size: 2, opacity: 1, arrow: 1 },
    isFixed: true,
  };
  const visualConfig: GraphVisualConfig = {
    layerName: "Mapgl",
    layerIndex: 0,
    locationField: bindings.nodeIdField,
    isLogic: true,
    node: () => node,
    edge: () => edge,
    sideA: () => edge,
    sideB: () => edge,
    arcConfig: { height: 0, tiltIncrement: 0, capacity: { fixed: 100 } },
  };
  return {
    layers: [
      {
        sources: [source],
        options: { isLogic: true, layerName: "Mapgl" },
        visualConfig,
      },
    ],
  };
}
