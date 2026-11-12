import type { GraphSource } from "@vaduga/mapgl-core/data";
import type {
  GraphPipelineInput,
  GraphStyleChannels,
  GraphVisualConfig,
} from "@vaduga/mapgl-core/graph/frame";
import type { GraphOptions } from "./input";

export function createGraphInput(
  source: GraphSource,
  bindings: GraphOptions,
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
    base: {
      color: "#7b9ec4",
      size: 2,
      opacity: 1,
      arrow: bindings.arrow ?? 1,
      animate: bindings.animate ?? false,
      textConfig: { fontSize: 10 },
    },
    isFixed: true,
    text: { get: (row) => label(bindings.edgeLabelField, row) },
  };
  function label(field: string | undefined, row: number): string {
    const value = field ? source.value(field, row) : undefined;
    return typeof value === "string" ||
      (typeof value === "number" && Number.isFinite(value))
      ? String(value)
      : "";
  }
  const side = (field?: string): GraphStyleChannels => ({
    ...edge,
    text: { get: (row) => label(field, row) },
  });
  const visualConfig: GraphVisualConfig = {
    layerName: "Mapgl",
    layerIndex: 0,
    locationField: bindings.nodeIdField,
    isLogic: true,
    node: () => node,
    edge: () => edge,
    showStat2: Boolean(bindings.sideALabelField || bindings.sideBLabelField),
    sideA: () => side(bindings.sideALabelField),
    sideB: () => side(bindings.sideBLabelField),
    arcConfig: { height: 0, tiltIncrement: 0, capacity: { fixed: 100 } },
  };
  return {
    layers: [
      {
        sources: [source],
        options: {
          isLogic: true,
          layerName: "Mapgl",
          layoutSignature: JSON.stringify({
            nodeCards: bindings.nodeCards ?? false,
            edgeRouting: bindings.edgeRouting ?? "Splines",
          }),
        },
        visualConfig,
      },
    ],
  };
}
