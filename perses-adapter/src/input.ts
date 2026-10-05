import type { GraphSource, ValueColumn } from "@vaduga/mapgl-core/data";

export interface GraphBindings {
  nodeIdField: string;
  targetField: string;
  labelField?: string;
}
export type JsonRow = Readonly<Record<string, unknown>>;
export class GraphInputError extends Error {}
const own = (row: JsonRow, field: string) => Object.hasOwn(row, field);
const validId = (value: unknown) =>
  (typeof value === "string" && value.trim().length > 0) ||
  (typeof value === "number" && Number.isFinite(value));
const validTarget = (value: unknown) =>
  validId(value) ||
  (Array.isArray(value) && value.length >= 2 && value.every(validId));
function freeze(value: unknown): void {
  if (value && typeof value === "object") {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
}

/** Owns accepted immutable row snapshots; revisions never depend on view/selection. */
export class JsonGraphBindings {
  private revision = 0;
  private signature?: string;
  private source?: GraphSource;
  bind(
    payload: unknown,
    bindings: GraphBindings,
    queryCount: number,
  ): GraphSource {
    if (queryCount !== 1)
      throw new GraphInputError("Configure exactly one JSON query.");
    if (!bindings.nodeIdField?.trim() || !bindings.targetField?.trim())
      throw new GraphInputError("Set both the node ID field and target field.");
    if (!Array.isArray(payload))
      throw new GraphInputError(
        "JSON query must return an array of node rows. Use JSONata in the query to reshape a nested response.",
      );
    for (const [index, value] of payload.entries()) {
      const row = value as JsonRow;
      if (
        !row ||
        typeof row !== "object" ||
        Array.isArray(row) ||
        Object.getPrototypeOf(row) !== Object.prototype
      )
        throw new GraphInputError(`Row ${index + 1} must be a JSON object.`);
      if (
        !own(row, bindings.nodeIdField) ||
        !validId(row[bindings.nodeIdField])
      )
        throw new GraphInputError(
          `Row ${index + 1}: field "${bindings.nodeIdField}" must be a nonempty string or finite number.`,
        );
      const target = row[bindings.targetField];
      if (target != null && target !== "" && !validTarget(target))
        throw new GraphInputError(
          `Row ${index + 1}: target field "${bindings.targetField}" must be a node ID, a path of node IDs, or null.`,
        );
      const label = bindings.labelField ? row[bindings.labelField] : undefined;
      if (label != null && typeof label !== "string")
        throw new GraphInputError(
          `Row ${index + 1}: label field "${bindings.labelField}" must be a string.`,
        );
    }
    if (
      payload.length &&
      !payload.some((row) => own(row, bindings.targetField))
    )
      throw new GraphInputError(
        `Target field "${bindings.targetField}" is missing from every row. Check the field mapping.`,
      );
    const signature = JSON.stringify([payload, bindings]);
    if (signature === this.signature && this.source) return this.source;
    const rows: readonly JsonRow[] = structuredClone(payload);
    freeze(rows);
    const column = (key: string): ValueColumn =>
      Object.freeze({
        key,
        length: rows.length,
        get: (row: number) =>
          own(rows[row], key) ? rows[row][key] : undefined,
      });
    this.source = Object.freeze({
      revision: `json:${++this.revision}`,
      key: "query:0",
      index: 0,
      rowCount: rows.length,
      nodeId: column(bindings.nodeIdField),
      target: column(bindings.targetField),
      value: (key: string, index: number) =>
        own(rows[index], key) ? rows[index][key] : undefined,
      position: () => undefined,
    });
    this.signature = signature;
    return this.source;
  }
}
