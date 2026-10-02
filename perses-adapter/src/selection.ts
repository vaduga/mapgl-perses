import type { PanelController } from "@mapgl/panel-core/runtime";
import type { Graph, Node } from "@mapgl/panel-core/graph/main";
import { adjacentEdgeTooltipSectionContributor } from "@mapgl/panel-core/featureContracts";

export function getNodeDetails(
  controller: PanelController,
  node: Node | undefined,
) {
  if (!node) return undefined;
  const namespaceId = String((node.parent as Graph | undefined)?.id ?? "");
  const record = controller.state?.snapshot.nodes.find(
    (record) => record.id === node.id && record.namespaceId === namespaceId,
  );
  if (!record) return undefined;
  const label = controller.state?.visual.state.nodes.find(
    (visual) => visual.key === record.key,
  )?.style.text;
  return {
    key: record.key,
    id: record.id,
    namespaceId,
    label: label || record.id,
  };
}

export function getSelectedNodeDetails(controller: PanelController) {
  const points = controller.stores.pointStore;
  const node = points.getSelectedNode;
  const details = getNodeDetails(controller, node ?? undefined);
  const graph = controller.scene.readGraph()?.graph;
  if (!details || !graph) return undefined;
  const highlighter = points.graphHighlighter;
  const sections = adjacentEdgeTooltipSectionContributor.getSections({
    graph,
    node: node ?? undefined,
    edgeIndex: controller.scene.render.edgeIndex,
    adjacentEdges: {
      incoming: highlighter.getInEdges(node),
      outgoing: highlighter.getOutEdges(node),
    },
  });
  return { ...details, sections };
}
