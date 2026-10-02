import { describe, it, expect } from "vitest";
import { fitGraph } from "./viewport";
describe("abstract viewport fit", () => {
  it("waits for usable panel dimensions and rejects empty or invalid positions", () => {
    expect(fitGraph(new Float64Array([1, 2]), 0, 400)).toBeUndefined();
    expect(fitGraph(new Float64Array(), 600, 400)).toBeUndefined();
    expect(fitGraph(new Float64Array([NaN, 0]), 600, 400)).toBeUndefined();
  });
  it("centers and fits all node extents with padding", () => {
    const positions = new Float64Array([-200, -40, 300, 160]);
    const fit = fitGraph(positions, 600, 400)!;
    expect(fit.target).toEqual([50, 60, 0]);
    expect((500 + 70) * 2 ** fit.zoom).toBeLessThanOrEqual(500);
  });
});
