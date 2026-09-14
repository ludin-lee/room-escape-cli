import { test } from "node:test";
import assert from "node:assert/strict";
import { parse, matchName } from "../src/engine/parser.js";

test("첫 토큰 verb", () => {
  assert.deepEqual(parse("조사 책상"), { verb: "examine", target: "책상", secondary: null, args: ["책상"] });
});

test("영어 별칭", () => {
  assert.equal(parse("examine desk").verb, "examine");
  assert.equal(parse("x desk").verb, "examine");
  assert.equal(parse("i").verb, "inventory");
});

test("마지막 토큰 verb + 연결어 제거", () => {
  const p = parse("열쇠를 문에 사용");
  assert.equal(p.verb, "use");
  assert.deepEqual(p.args, ["열쇠를", "문에"]);
  const q = parse("use key on door");
  assert.equal(q.verb, "use");
  assert.deepEqual(q.args, ["key", "door"]);
});

test("모르는 verb", () => {
  assert.equal(parse("춤추기 신나게").verb, null);
  assert.equal(parse("   ").verb, null);
});

test("matchName: 원문 우선, 실패 시 조사 제거", () => {
  const cands = [{ id: "door", names: ["문", "door"] }, { id: "shop", names: ["가게"] }];
  assert.equal(matchName("문", cands)?.id, "door");
  assert.equal(matchName("문을", cands)?.id, "door");
  assert.equal(matchName("DOOR", cands)?.id, "door");
  assert.equal(matchName("가게", cands)?.id, "shop");
  assert.equal(matchName("창문", cands), null);
});

test("josa: 받침에 따라 조사 선택", async () => {
  const { josa } = await import("../src/engine/josa.js");
  assert.equal(josa("열쇠", "을/를"), "열쇠를");
  assert.equal(josa("일기장", "을/를"), "일기장을");
  assert.equal(josa("복도", "으로/로"), "복도로");
  assert.equal(josa("지하실", "으로/로"), "지하실으로");
  assert.equal(josa("key", "은/는"), "key는");
});
