import { describe, it, expect } from "vitest";
import { JsonGraphBindings } from "./input";
const options = {
  nodeIdField: "id",
  targetField: "target",
  labelField: "label",
};

describe("Perses JSON boundary", () => {
  it("preserves zero, terminal rows, original properties and immutable revisions", () => {
    const binding = new JsonGraphBindings();
    const rows = [
      { id: 0, target: "b", label: "Zero", nested: { value: 1 } },
      { id: "b", target: null },
    ];
    const source = binding.bind(rows, options, 1);
    expect(source.nodeId.get(0)).toBe(0);
    expect(source.target?.get(1)).toBeNull();
    expect(source.position(0)).toBeUndefined();
    rows[0].nested!.value = 2;
    expect(source.value("nested", 0)).toEqual({ value: 1 });
    expect(Object.isFrozen(source.value("nested", 0))).toBe(true);
    const unchanged = binding.bind(
      [
        { id: 0, target: "b", label: "Zero", nested: { value: 1 } },
        { id: "b", target: null },
      ],
      options,
      1,
    );
    expect(unchanged).toBe(source);
    expect(binding.bind(rows, options, 1).revision).not.toBe(source.revision);
  });
  it("accepts empty results without inferred fields", () => {
    expect(new JsonGraphBindings().bind([], options, 1).rowCount).toBe(0);
  });
  it("accepts missing targets on individual terminal rows", () => {
    const source = new JsonGraphBindings().bind(
      [{ id: "a", target: "b" }, { id: "b" }],
      options,
      1,
    );
    expect(source.target?.get(1)).toBeUndefined();
  });
  it.each([0, 2])("rejects %s configured queries", (count) => {
    expect(() => new JsonGraphBindings().bind([], options, count)).toThrow(
      "exactly one",
    );
  });
  it.each([null, 3, {}, "a"])("rejects non-array payload %j", (payload) => {
    expect(() => new JsonGraphBindings().bind(payload, options, 1)).toThrow(
      "array of node rows",
    );
  });
  it.each([null, [], 3])("rejects non-object rows %j", (row) => {
    expect(() => new JsonGraphBindings().bind([row], options, 1)).toThrow(
      "Row 1",
    );
  });
  it.each([undefined, "", "  ", {}, [], true, NaN, Infinity])(
    "rejects invalid ID %j with field context",
    (id) => {
      expect(() =>
        new JsonGraphBindings().bind([{ id, target: null }], options, 1),
      ).toThrow('field "id"');
    },
  );
  it.each([[], ["b", {}], { id: "b" }, false, Infinity, "  "])(
    "rejects invalid target %j",
    (target) => {
      expect(() =>
        new JsonGraphBindings().bind([{ id: "a", target }], options, 1),
      ).toThrow('target field "target"');
    },
  );
  it("accepts and freezes an ordered multi-hop path with a numeric zero ID", () => {
    const rows = [{ id: 0, target: [0, "via", "destination"] }];
    const source = new JsonGraphBindings().bind(rows, options, 1);
    rows[0].target[1] = "changed";
    expect(source.target?.get(0)).toEqual([0, "via", "destination"]);
    expect(Object.isFrozen(source.target?.get(0))).toBe(true);
  });
  it("reports a missing target mapping without dropping rows", () => {
    expect(() =>
      new JsonGraphBindings().bind([{ id: "a", other: null }], options, 1),
    ).toThrow("missing from every row");
  });
  it("uses literal top-level keys and rejects invalid bindings and labels", () => {
    expect(
      new JsonGraphBindings()
        .bind(
          [{ "node.id": "a", target: null }],
          { ...options, nodeIdField: "node.id" },
          1,
        )
        .nodeId.get(0),
    ).toBe("a");
    expect(() =>
      new JsonGraphBindings().bind([], { ...options, nodeIdField: "" }, 1),
    ).toThrow("Set both");
    expect(() =>
      new JsonGraphBindings().bind(
        [{ id: "a", target: null, label: 5 }],
        options,
        1,
      ),
    ).toThrow("label field");
  });
});
