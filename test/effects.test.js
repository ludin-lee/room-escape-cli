import { test } from "node:test";
import assert from "node:assert/strict";
import { apply } from "../src/engine/effects.js";
import { evaluate } from "../src/engine/conditions.js";
import { createState } from "../src/engine/state.js";

const scenario = { id: "t", startRoom: "a" };

test("효과 적용", () => {
  const s = createState(scenario, 0);
  const msgs = apply([
    { addItem: "key" }, { setFlag: "f" }, { reveal: "x" }, { message: "hi" }, { moveTo: "b" },
  ], s);
  assert.deepEqual(s.inventory, ["key"]);
  assert.deepEqual(s.flags, ["f"]);
  assert.deepEqual(s.revealed, ["x"]);
  assert.equal(s.room, "b");
  assert.deepEqual(msgs, [{ type: "text", body: "hi" }]);

  apply([{ removeItem: "key" }, { clearFlag: "f" }, { hide: "x" }], s);
  assert.deepEqual(s.inventory, []);
  assert.deepEqual(s.flags, []);
  assert.deepEqual(s.revealed, []);
  assert.deepEqual(s.hidden, ["x"]);
});

test("중복 추가 방지 / 알 수 없는 효과", () => {
  const s = createState(scenario, 0);
  apply([{ addItem: "k" }, { addItem: "k" }], s);
  assert.deepEqual(s.inventory, ["k"]);
  assert.throws(() => apply([{ explode: true }], s), /알 수 없는 효과/);
});

test("조건 평가", () => {
  const s = createState(scenario, 0);
  s.inventory.push("key"); s.flags.push("f"); s.solvedLocks.push("L");
  assert.equal(evaluate(undefined, s), true);
  assert.equal(evaluate({ hasItem: "key" }, s), true);
  assert.equal(evaluate({ hasItem: "nope" }, s), false);
  assert.equal(evaluate({ flag: "f", notFlag: "g" }, s), true);
  assert.equal(evaluate({ solved: "L" }, s), true);
  assert.equal(evaluate({ notSolved: "L" }, s), false);
  assert.equal(evaluate({ inRoom: "a" }, s), true);
  assert.equal(evaluate({ all: [{ flag: "f" }, { inRoom: "b" }] }, s), false);
  assert.equal(evaluate({ any: [{ flag: "f" }, { inRoom: "b" }] }, s), true);
  assert.throws(() => evaluate({ weird: 1 }, s), /알 수 없는 조건/);
});
