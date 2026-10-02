import type { PanelPlugin } from "@perses-dev/plugin-system";
import { MapglComponent } from "./MapglComponent";
import { MapglSettingsEditor } from "./MapglSettingsEditor";
import type { MapglOptions, MapglProps } from "./mapgl-types";

export const Mapgl: PanelPlugin<MapglOptions, MapglProps> = {
  PanelComponent: MapglComponent,
  LoadingComponent: () => (
    <div role="status" style={{ padding: 16 }}>
      Loading graph query…
    </div>
  ),
  panelOptionsEditorComponents: [
    { label: "Graph", content: MapglSettingsEditor },
  ],
  supportedQueryTypes: ["JsonQuery"],
  createInitialOptions: () => ({
    nodeIdField: "id",
    targetField: "target",
    labelField: "label",
  }),
};
