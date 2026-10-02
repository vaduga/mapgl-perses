import type { JsonData } from "@perses-dev/spec";
import type { PanelProps } from "@perses-dev/plugin-system";
import type { GraphBindings } from "@mapgl/perses-adapter";
export type MapglOptions = GraphBindings;
export type MapglProps = PanelProps<MapglOptions, JsonData>;
