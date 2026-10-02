import { useState } from "react";
import copy from "copy-to-clipboard";
import { DeckWidgetButton } from "@mapgl/panel-core/components/DeckWidgetButton";
import {
  TooltipEdgeSectionList,
  type TooltipEdgeDirection,
} from "@mapgl/panel-core/components/Tooltips/tooltipEdgeSections";
import {
  getNodeDetails,
  getSelectedNodeDetails,
  type PersesGraphSession,
} from "@mapgl/perses-adapter";

type Selection = NonNullable<ReturnType<typeof getSelectedNodeDetails>>;

export function NodeSelectionCard({
  session,
  selected,
}: {
  session: PersesGraphSession;
  selected: Selection;
}) {
  const [expanded, setExpanded] = useState<
    Partial<Record<TooltipEdgeDirection, boolean>>
  >({});
  const [copyStatus, setCopyStatus] = useState("");
  async function copyId() {
    try {
      setCopyStatus(
        (await copy(selected.id))
          ? "Node ID copied."
          : "Could not copy node ID.",
      );
    } catch {
      setCopyStatus("Could not copy node ID.");
    }
  }
  return (
    <section
      className="mapgl-perses-selection"
      aria-label="Selected node"
      onMouseDown={(event) => event.stopPropagation()}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="mapgl-perses-selection-heading">
        <strong>{selected.label}</strong>
        <button
          type="button"
          className="mapgl-perses-selection-clear"
          onClick={() => session.controller.select(undefined)}
          aria-label="Clear node selection"
        >
          ×
        </button>
      </div>
      <div className="mapgl-perses-selection-id">
        <span>Node ID: {selected.id}</span>
        <DeckWidgetButton icon="copy" label="Copy node ID" onClick={copyId} />
      </div>
      <span role="status" className="mapgl-perses-copy-status">
        {copyStatus}
      </span>
      {selected.sections.length ? (
        <TooltipEdgeSectionList
          sections={selected.sections}
          classNames={{
            headerRow: "mapgl-perses-relationship-counts",
            header: "mapgl-perses-relationship-count",
          }}
          isListed={(_section, direction) => !!expanded[direction]}
          onToggle={(_section, direction) =>
            setExpanded((value) => ({
              ...value,
              [direction]: !value[direction],
            }))
          }
          renderEdge={(record, _index, direction) => {
            const neighbor = getNodeDetails(
              session.controller,
              direction === "incoming" ? record.source : record.target,
            );
            return neighbor ? (
              <li>
                <span>{direction === "incoming" ? "From" : "To"} </span>
                <button
                  type="button"
                  className="mapgl-perses-neighbor"
                  title={`Node ID: ${neighbor.id}`}
                  onClick={() =>
                    session.controller.select({
                      id: neighbor.id,
                      namespaceId: neighbor.namespaceId,
                    })
                  }
                >
                  {neighbor.label}
                </button>
              </li>
            ) : null;
          }}
        />
      ) : (
        <span>No relationships.</span>
      )}
    </section>
  );
}
