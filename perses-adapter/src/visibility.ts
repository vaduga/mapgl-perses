import { VisLayers } from "@vaduga/mapgl-core/store";
import { Graph } from "@vaduga/mapgl-core/graph/main";
import { colTypes } from "@vaduga/mapgl-core/types";

const controls = [
  ["Nodes", colTypes.Circle],
  ["Labels", colTypes.Label],
  ["Edges", colTypes.Edges],
] as const;

/** Core visibility owns state; only the menu presentation is limited to the MVP. */
export class PersesVisibility extends VisLayers {
  constructor(graph: Graph, groupCount: number) {
    super();
    // Renderer categories need the source and namespaces even though they have no UI controls.
    this.addLayer(
      "Mapgl",
      "Mapgl",
      colTypes.Markers,
      false,
      true,
      false,
      null,
      false,
    );
    for (const namespace of [graph, ...graph.subgraphsBreadthFirst()]) {
      this.addLayer(
        namespace.id,
        namespace.id,
        "graph",
        false,
        true,
        false,
        null,
        false,
      );
    }
    for (const [label, name] of controls) {
      this.addLayer(label, name, name, false, true, false, null, false);
    }
    this.setActiveGroups(new Uint8Array(groupCount).fill(1));
  }
  override getLayerTree() {
    return super
      .getLayerTree()
      .filter((layer) => controls.some(([, name]) => name === layer.name));
  }
}
