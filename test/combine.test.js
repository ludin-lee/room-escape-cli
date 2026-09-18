import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine/game.js";
import { loadScenario } from "../src/content/loader.js";
import { validateScenario } from "../src/content/validate.js";
import { fakeClock } from "./helpers.js";

async function fresh() {
  const scenario = await loadScenario("zombie-street");
  const game = new Game(scenario, { now: fakeClock() });
  game.start();
  return game;
}
const run = (g, cmds) => cmds.map((c) => g.run(c));
const STORE = ["조사 계산대", "조사 리모컨", "줍기 건전지", "줍기 라이터", "조사 진열대", "줍기 못", "줍기 손전등", "줍기 야구방망이", "줍기 빈병", "줍기 헝겊"];

test("조합: 순서 무관, 결과물 생성, 재료 소모", async () => {
  const g = await fresh();
  run(g, STORE);
  const msgs = g.run("조합 못 야구방망이");
  assert.ok(msgs.some((m) => m.type === "item" && m.body.includes("못박힌방망이")));
  assert.ok(g.state.inventory.includes("spiked_bat"));
  assert.ok(!g.state.inventory.includes("bat"));
  assert.ok(!g.state.inventory.includes("nails"));
});

test("조합: consume 배열이면 지정한 재료만 사라지고 effects 만 적용된다", async () => {
  const g = await fresh();
  run(g, STORE);
  g.run("조합 손전등 건전지");
  assert.ok(g.state.inventory.includes("flashlight"));
  assert.ok(!g.state.inventory.includes("battery"));
  assert.ok(g.state.flags.includes("flashlight_powered"));
});

test("조합: 없는 레시피 / 가방에 없는 아이템 / 같은 아이템 / 인자 부족", async () => {
  const g = await fresh();
  run(g, STORE);
  assert.match(g.run("조합 빈병 못")[0].body, /합쳐지지 않는다/);
  assert.equal(g.run("조합 빈병 쇠지렛대")[0].type, "error");
  assert.equal(g.run("조합 빈병 빈병")[0].type, "error");
  assert.equal(g.run("조합 빈병")[0].type, "error");
  // 조사 붙여 써도 된다: "소독약과 붕대"
  assert.match(g.run("조합 빈병과 못을")[0].body, /합쳐지지 않는다/);
});

test("zombie-street: 손전등 없이 창고 진입 / 셔터 열기 / 맨 방망이 는 게임 오버", async () => {
  const a = await fresh();
  run(a, [...STORE, "입력 0724 창고문", "이동 창고"]);
  assert.equal(a.status, "lost");
  assert.equal(a.state.lostBy, "trap");

  const b = await fresh();
  b.run("열기 셔터");
  assert.equal(b.status, "lost");

  const c = await fresh();
  run(c, [...STORE, "조합 손전등 건전지", "사용 손전등", "입력 0724 창고문", "이동 창고", "줍기 쇠지렛대", "이동 편의점", "사용 쇠지렛대 뒷문", "이동 뒷골목"]);
  assert.equal(c.status, "playing");
  c.run("사용 야구방망이 좀비"); // 자물쇠에 안 맞는 아이템이지만 onUse 함정이 먼저 실행된다
  assert.equal(c.status, "lost");
  assert.ok(c.canRetry());
  c.retry();
  assert.equal(c.state.room, "alley");
});

test("zombie-street: 라이터 없이는 화염병을 못 쓰고, 좀비떼를 치우기 전엔 옥상문이 안 열린다", async () => {
  const g = await fresh();
  run(g, [...STORE, "조합 손전등 건전지", "사용 손전등", "입력 0724 창고문", "이동 창고", "줍기 쇠지렛대", "줍기 호스", "이동 편의점",
    "사용 쇠지렛대 뒷문", "이동 뒷골목", "사용 호스 자동차", "조합 휘발유병 헝겊", "이동 주유소"]);
  assert.ok(g.state.inventory.includes("molotov"));
  g.state.inventory.splice(g.state.inventory.indexOf("lighter"), 1);
  assert.equal(g.run("사용 화염병 좀비떼")[0].type, "error");
  assert.ok(g.state.inventory.includes("molotov"));
  g.state.inventory.push("rooftop_key");
  assert.match(g.run("사용 옥상열쇠 옥상문")[0].body, /좀비 떼/);
  g.state.inventory.push("lighter");
  assert.equal(g.run("사용 화염병 좀비떼")[0].type, "text");
  assert.equal(g.run("사용 옥상열쇠 옥상문")[0].type, "text");
});

test("zombie-street: 무전 전에는 조명탄이 낭비고, 옥상이 아니면 무전이 안 된다", async () => {
  const g = await fresh();
  g.state.inventory.push("flare", "radio_handset");
  g.state.flags.push("radio_fixed");
  assert.equal(g.run("사용 조명탄")[0].type, "error");
  assert.equal(g.run("사용 무전기")[0].type, "error");
  g.state.room = "rooftop";
  assert.equal(g.run("사용 무전기")[0].type, "text");
  g.run("사용 조명탄");
  assert.equal(g.status, "won");
});

test("validate: recipes 참조 검사", () => {
  const s = {
    id: "m", timeLimitSec: 60, startRoom: "a", endings: { success: "s", timeout: "t" },
    rooms: { a: { name: "A", objects: ["x", "y"], exits: [{ names: ["b"], to: "b" }] }, b: { name: "B", objects: [], exits: [], isExit: true } },
    objects: { x: { names: ["엑스"], takeable: true }, y: { names: ["와이"], takeable: true }, z: { names: ["엑스"] } },
    locks: {},
    recipes: [{ inputs: ["x", "y"], output: "z" }, { inputs: ["x", "nope"] }, { inputs: ["x", "x"], consume: ["y"], effects: [{ setFlag: "f" }] }],
  };
  const errs = validateScenario(s);
  assert.ok(errs.some((e) => e.includes("조합 결과 'z'") && e.includes("겹칩니다")));
  assert.ok(errs.some((e) => e.includes("'nope'")));
  assert.ok(errs.some((e) => e.includes("output 도 effects 도")));
  assert.ok(errs.some((e) => e.includes("같은 오브젝트")));
  assert.ok(errs.some((e) => e.includes("consume 'y'")));
});
