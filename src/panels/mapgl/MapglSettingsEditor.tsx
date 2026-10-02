import type { OptionsEditorProps } from "@perses-dev/plugin-system";
import type { MapglOptions } from "./mapgl-types";

export function MapglSettingsEditor({
  value,
  onChange,
}: OptionsEditorProps<MapglOptions>) {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {(["nodeIdField", "targetField", "labelField"] as const).map((key) => (
        <label key={key}>
          {
            {
              nodeIdField: "Node ID field",
              targetField: "Target field",
              labelField: "Label field",
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
    </div>
  );
}
