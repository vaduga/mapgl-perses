import { getFeatureBounds, fitCartesianBounds } from "@vaduga/mapgl-core/utils";
import type { ViewState } from "@vaduga/mapgl-core/types";
export type GraphViewport = ViewState & { target: [number, number, number] };
export const initialViewport: GraphViewport = {
  longitude: 0,
  latitude: 0,
  yZoom: 1,
  zoom: 0,
  target: [0, 0, 0],
  rotationX: -90,
  rotationOrbit: 0,
  minZoom: -8,
  maxZoom: 4,
};
export function fitGraph(
  positions: Float64Array,
  width: number,
  height: number,
): GraphViewport | undefined {
  if (!positions.length || width <= 100 || height <= 100) return undefined;
  const bounds = getFeatureBounds(
    Array.from({ length: positions.length / 2 }, (_, id) => ({ id })),
    positions,
  );
  if (!bounds) return undefined;
  const fit = fitCartesianBounds(bounds, width, height, {
    maxZoom: 2,
    viewportMargin: 100,
    extentMargin: [70, 90],
  });
  return {
    ...initialViewport,
    target: [fit.longitude, fit.latitude, 0],
    zoom: fit.zoom,
  };
}
