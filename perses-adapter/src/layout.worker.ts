import type { LayoutPassRequest } from "@vaduga/mapgl-core/graph/utils";
import { getLayoutResult } from "@vaduga/mapgl-core/graph/utils/layout-worker-runner";
import { getLayoutTransferables } from "@vaduga/mapgl-core/graph/utils/layout-result";

// Perses deliberately adopts MSAGL only; ELK integration is deferred.
self.onmessage = ({ data }: MessageEvent<LayoutPassRequest>) => {
  try {
    const result = getLayoutResult(data);
    self.postMessage(result, { transfer: getLayoutTransferables(result) });
  } catch (error) {
    self.postMessage({
      type: "error",
      requestId: data.requestId,
      message: error instanceof Error ? error.message : String(error),
    });
  }
};
