import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine/game.js";
import { loadScenario } from "../src/content/loader.js";
import { fakeClock } from "./helpers.js";

const WALKTHROUGHS = {
  "old-study": [
    "조사 책상", "줍기 일기장", "조사 일기장",
    "조사 그림", "입력 731 금고", "줍기 놋쇠열쇠", "사용 놋쇠열쇠 문",
    "이동 복도",
    "조사 시계", "입력 315 오르골", "줍기 쪽지", "조사 쪽지", "줍기 등불",
    "이동 지하실", "사용 등불", "입력 513 궤짝", "줍기 철열쇠",
    "이동 복도", "사용 철열쇠 철문", "이동 정원",
  ],
  "midnight-ward": [
    "조사 침대", "줍기 팔찌", "조사 팔찌", "입력 0427 사물함", "줍기 손전등", "조사 차트",
    "이동 복도", "사용 손전등", "줍기 카드키", "사용 카드키 약제실문",
    "이동 약제실", "입력 327 약장", "줍기 계단열쇠",
    "이동 복도", "사용 계단열쇠 비상문", "이동 비상계단",
  ],
  "observatory": [
    "조사 망원경", "조사 성도", "입력 1203 문", "조사 받침대", "줍기 육각렌치", "조사 행성모형",
    "이동 복도", "조사 초상화", "조사 게시판",
    "이동 기록실", "조사 관측일지", "입력 545 상자", "줍기 퓨즈",
    "줍기 사다리", "사용 사다리 서가", "조사 항성목록", "줍기 소장실열쇠",
    "이동 복도", "이동 기계실", "사용 퓨즈 배전반",
    "이동 복도", "사용 소장실열쇠 소장실문", "이동 소장실",
    "조사 책상", "조사 근무카드", "조사 달력", "입력 3257 금고", "줍기 필름",
    "이동 복도", "입력 1112 암실문", "이동 암실", "사용 필름 인화기", "줍기 사진", "조사 사진",
    "이동 복도", "입력 1583 제어판", "이동 승강기",
  ],
};

test("모든 시나리오에 walkthrough 가 있다", async () => {
  const { listScenarios } = await import("../src/content/loader.js");
  const ids = (await listScenarios()).map((s) => s.id).sort();
  assert.deepEqual(ids, Object.keys(WALKTHROUGHS).sort());
});

for (const [id, commands] of Object.entries(WALKTHROUGHS)) {
  test(`walkthrough: ${id}`, async () => {
    const scenario = await loadScenario(id);
    const game = new Game(scenario, { now: fakeClock() });
    game.start();
    for (const cmd of commands) {
      const msgs = game.run(cmd);
      const errors = msgs.filter((m) => m.type === "error");
      assert.deepEqual(errors, [], `'${cmd}' 에서 에러: ${JSON.stringify(errors)}`);
      if (game.status !== "playing") break;
    }
    assert.equal(game.status, "won");
  });
}

test("잘못된 코드 / 잠긴 문 / 없는 대상", async () => {
  const scenario = await loadScenario("old-study");
  const game = new Game(scenario, { now: fakeClock() });
  assert.equal(game.run("이동 복도")[0].type, "error");
  assert.equal(game.run("조사 금고")[0].type, "error"); // 아직 hidden
  game.run("조사 그림");
  assert.equal(game.run("입력 000 금고")[0].type, "error");
  assert.equal(game.run("입력 000")[0].type, "error");
  assert.equal(game.run("사용 등불 문")[0].type, "error"); // 가방에 없음
  assert.equal(game.run("춤추기")[0].type, "error");
  assert.deepEqual(game.run(""), []);
});

test("힌트 순서와 패널티, 타이머", async () => {
  const scenario = await loadScenario("old-study");
  const now = fakeClock();
  const game = new Game(scenario, { now });
  assert.equal(game.remainingMs(), 1800_000);

  const h1 = game.run("힌트");
  assert.match(h1[0].body, /책상/);
  assert.equal(game.state.hintsUsed, 1);
  assert.equal(game.remainingMs(), 1800_000 - 120_000);

  game.run("조사 책상");
  assert.match(game.run("힌트")[0].body, /일기장/);

  now.advance(1800_000);
  const msgs = game.run("보기");
  assert.equal(game.status, "lost");
  assert.equal(msgs.at(-1).type, "ending");
  assert.deepEqual(game.run("보기"), [{ type: "system", body: "게임이 끝났습니다." }]);
});

test("저장/불러오기 라운드트립 (시간 누적 유지)", async () => {
  const scenario = await loadScenario("old-study");
  const now = fakeClock();
  const game = new Game(scenario, { now });
  game.run("조사 책상"); game.run("줍기 일기장");
  now.advance(60_000);

  const snap = JSON.parse(JSON.stringify(game.toJSON()));
  assert.equal(snap.elapsedMs, 60_000);
  assert.deepEqual(snap.inventory, ["diary"]);

  const now2 = fakeClock(5_000_000);
  const g2 = Game.fromJSON(scenario, snap, { now: now2 });
  assert.equal(g2.remainingMs(), 1800_000 - 60_000);
  now2.advance(30_000);
  assert.equal(g2.remainingMs(), 1800_000 - 90_000);
  assert.ok(g2.visibleObjects().every((o) => o.id !== "diary")); // 가방에 있으니 방에서 안 보임
  assert.throws(() => Game.fromJSON({ id: "other" }, snap), /시나리오/);
});

test("key 자물쇠: 소모 및 잘못된 아이템", async () => {
  const scenario = await loadScenario("old-study");
  const game = new Game(scenario, { now: fakeClock() });
  for (const c of ["조사 책상", "줍기 일기장", "조사 그림", "입력 7-3-1", "줍기 놋쇠열쇠"]) game.run(c);
  assert.equal(game.run("사용 일기장 문")[0].type, "error");
  assert.equal(game.run("사용 놋쇠열쇠 문")[0].type, "text");
  assert.ok(!game.state.inventory.includes("brass_key"));
  assert.deepEqual(game.state.solvedLocks, ["safe_lock", "study_door_lock"]);
  assert.equal(game.run("이동 hallway")[0].type, "system");
});

test("observatory: 전원 없이는 승강기 패널이 안 보이고 필름 인화도 안 된다", async () => {
  const scenario = await loadScenario("observatory");
  const game = new Game(scenario, { now: fakeClock() });
  for (const c of ["입력 1203 문", "이동 복도"]) game.run(c);
  assert.equal(game.run("입력 1583 제어판")[0].type, "error"); // 패널은 아직 hidden
  assert.equal(game.run("이동 승강기")[0].type, "error");

  // 렌치 없이 퓨즈만으로는 배전반을 열 수 없다
  for (const c of ["이동 기록실", "입력 545 상자", "줍기 퓨즈", "이동 복도", "이동 기계실"]) game.run(c);
  const noWrench = game.run("사용 퓨즈 배전반");
  assert.equal(noWrench[0].type, "error");
  assert.ok(game.state.inventory.includes("fuse"));
  assert.ok(!game.state.flags.includes("power_on"));

  // 녹슨 열쇠는 어디에도 맞지 않는다
  for (const c of ["조사 공구함", "줍기 녹슨열쇠", "이동 복도"]) game.run(c);
  assert.equal(game.run("사용 녹슨열쇠 소장실문")[0].type, "error");
});
