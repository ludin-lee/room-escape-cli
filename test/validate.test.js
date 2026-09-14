import { test } from "node:test";
import assert from "node:assert/strict";
import { validateScenario } from "../src/content/validate.js";
import { loadScenario, listScenarios } from "../src/content/loader.js";

function minimal() {
  return {
    id: "m", timeLimitSec: 60, startRoom: "a",
    endings: { success: "s", timeout: "t" },
    rooms: {
      a: { name: "A", objects: ["door"], exits: [{ names: ["b"], to: "b", lockedBy: "L" }] },
      b: { name: "B", objects: [], exits: [], isExit: true },
    },
    objects: { door: { names: ["문"], lock: "L" } },
    locks: { L: { type: "code", answer: "1" } },
  };
}

test("최소 시나리오 통과", () => {
  assert.deepEqual(validateScenario(minimal()), []);
});

test("참조 오류 검출", () => {
  const s = minimal();
  s.rooms.a.exits[0].to = "zzz";
  s.rooms.a.objects.push("ghost");
  s.objects.door.lock = "nolock";
  const errs = validateScenario(s);
  assert.ok(errs.some((e) => e.includes("'zzz'")));
  assert.ok(errs.some((e) => e.includes("'ghost'")));
  assert.ok(errs.some((e) => e.includes("'nolock'")));
});

test("isExit 없음 / endings 없음 / 도달 불가 방", () => {
  const s = minimal();
  s.rooms.b.isExit = false;
  delete s.endings.timeout;
  s.rooms.c = { name: "C", objects: [], exits: [] };
  const errs = validateScenario(s);
  assert.ok(errs.some((e) => e.includes("isExit")));
  assert.ok(errs.some((e) => e.includes("endings.timeout")));
  assert.ok(errs.some((e) => e.includes("'c'") && e.includes("도달")));
});

test("같은 방 이름 중복 / 다른 방은 허용", () => {
  const s = minimal();
  s.objects.door2 = { names: ["문"] };
  s.rooms.a.objects.push("door2");
  assert.ok(validateScenario(s).some((e) => e.includes("중복")));

  const t = minimal();
  t.objects.door2 = { names: ["문"] };
  t.rooms.b.objects.push("door2");
  assert.deepEqual(validateScenario(t), []);
});

test("takeable 이름은 모든 방과 비교", () => {
  const s = minimal();
  s.objects.key = { names: ["문"], takeable: true };
  s.rooms.b.objects.push("key");
  assert.ok(validateScenario(s).some((e) => e.includes("takeable")));
});

test("lock 타입별 필수 필드", () => {
  const s = minimal();
  s.locks.L = { type: "key" };
  assert.ok(validateScenario(s).some((e) => e.includes("keyItem")));
  s.locks.L = { type: "sequence" };
  assert.ok(validateScenario(s).some((e) => e.includes("지원하지 않습니다")));
});

test("실제 시나리오 파일이 모두 검증을 통과한다", async () => {
  const list = await listScenarios();
  assert.ok(list.length >= 1);
  for (const { id } of list) await loadScenario(id);
});
