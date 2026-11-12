import type { JsonData } from "@perses-dev/spec";
import type { PanelProps } from "@perses-dev/plugin-system";
import type { GraphOptions } from "@vaduga/mapgl-perses-adapter";
export type MapglOptions = GraphOptions;
export type MapglProps = PanelProps<MapglOptions, JsonData>;
