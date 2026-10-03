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
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 2) {
    minX = Math.min(minX, positions[i]);
    maxX = Math.max(maxX, positions[i]);
    minY = Math.min(minY, positions[i + 1]);
    maxY = Math.max(maxY, positions[i + 1]);
  }
  if (![minX, minY, maxX, maxY].every(Number.isFinite)) return undefined;
  return {
    ...initialViewport,
    target: [(minX + maxX) / 2, (minY + maxY) / 2, 0],
    zoom: Math.min(
      2,
      Math.log2(
        Math.min(
          (width - 100) / (maxX - minX + 70),
          (height - 100) / (maxY - minY + 90),
        ),
      ),
    ),
  };
}
