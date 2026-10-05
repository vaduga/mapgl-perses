import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { MapglComponent } from "../../src/panels/mapgl/MapglComponent";

const renderFrame = vi.hoisted(() => ({
  layers: [],
  error: "Factory unavailable" as string | undefined,
}));
vi.mock("@vaduga/mapgl-core/render/react", () => ({
  useRenderFrame: () => renderFrame,
}));
vi.mock("@deck.gl/react", () => ({ default: () => null }));

it("uses the existing Perses status surface for renderer failures and clears it after recovery", () => {
  const props = {
    queryResults: [],
    spec: { nodeIdField: "id", targetField: "target", labelField: "label" },
    contentDimensions: { width: 600, height: 400 },
  };
  let html = renderToStaticMarkup(createElement(MapglComponent, props));
  expect(html).toContain('role="alert"');
  expect(html).toContain("Render update failed: Factory unavailable");
  expect(html).not.toContain('data-phase="fatal"');
  renderFrame.error = undefined;
  html = renderToStaticMarkup(createElement(MapglComponent, props));
  expect(html).not.toContain("Render update failed");
  expect(html).toContain('role="status"');
});
