import type { OptionsEditorProps } from "@perses-dev/plugin-system";
import type { MapglOptions } from "./mapgl-types";

export function MapglSettingsEditor({
  value,
  onChange,
}: OptionsEditorProps<MapglOptions>) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(
        [
          "nodeIdField",
          "targetField",
          "labelField",
          "edgeLabelField",
          "sideALabelField",
          "sideBLabelField",
        ] as const
      ).map((key) => (
        <label key={key}>
          {
            {
              nodeIdField: "Node ID field",
              targetField: "Target field",
              labelField: "Label field",
              edgeLabelField: "Middle edge label field",
              sideALabelField: "Side A label field (source)",
              sideBLabelField: "Side B label field (target)",
            }[key]
          }
          <input
            style={{ display: "block" }}
            value={value[key] ?? ""}
            onChange={(event) =>
              onChange({ ...value, [key]: event.target.value })
            }
          />
        </label>
      ))}
      <label>
        Edge routing
        <select
          value={value.edgeRouting ?? "Splines"}
          onChange={(e) =>
            onChange({
              ...value,
              edgeRouting: e.target.value as MapglOptions["edgeRouting"],
            })
          }
        >
          <option value="Splines">Splines</option>
          <option value="Rectilinear">Rectilinear</option>
        </select>
      </label>
      <label>
        Arrow
        <select
          value={value.arrow ?? 1}
          onChange={(e) =>
            onChange({
              ...value,
              arrow: Number(e.target.value) as MapglOptions["arrow"],
            })
          }
        >
          <option value={0}>None</option>
          <option value={1}>Forward</option>
          <option value={-1}>Reverse</option>
          <option value={2}>Both</option>
        </select>
      </label>
      {(["nodeCards", "animate", "edgeLabels"] as const).map((key) => (
        <label key={key}>
          <input
            type="checkbox"
            checked={value[key] ?? false}
            onChange={(e) => onChange({ ...value, [key]: e.target.checked })}
          />
          {
            {
              nodeCards: "Node cards",
              animate: "Animate",
              edgeLabels: "Edge labels always on",
            }[key]
          }
        </label>
      ))}
    </div>
  );
}
