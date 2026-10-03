import { LayoutWorkerClient } from "@vaduga/mapgl-core/graph/utils/layout-worker-client";
export function createLayoutClient(): LayoutWorkerClient {
  return new LayoutWorkerClient(() => {
    const worker = new Worker(new URL("./layout.worker.ts", import.meta.url), {
      type: "module",
      name: "mapgl-layout",
    });
    return { worker, dispose: () => worker.terminate() };
  });
}
