import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine/game.js";
import { loadScenario } from "../src/content/loader.js";
import { fakeClock } from "./helpers.js";

async function fresh() {
  const scenario = await loadScenario("jigsaw");
  const now = fakeClock();
  const game = new Game(scenario, { now });
  game.start();
  return { game, now };
}
const run = (game, cmds) => cmds.map((c) => game.run(c));
const last = (msgs) => msgs.at(-1);

const TO_CORRIDOR = ["조사 거울", "줍기 철사", "사용 철사 욕조", "줍기 족쇄열쇠", "사용 족쇄열쇠 족쇄", "입력 1050 문", "이동 복도"];

test("jigsaw: 족쇄를 풀기 전에는 문 자물쇠에 손이 닿지 않는다", async () => {
  const { game } = await fresh();
  const msgs = game.run("입력 1050 문");
  assert.equal(msgs[0].type, "error");
  assert.match(msgs[0].body, /족쇄/);
  assert.deepEqual(game.state.attempts, {}); // requires 에 막힌 건 오답으로 세지 않는다
});

test("jigsaw: 욕실 문 오답 3회면 게임 오버", async () => {
  const { game } = await fresh();
  run(game, ["조사 거울", "줍기 철사", "사용 철사 욕조", "줍기 족쇄열쇠", "사용 족쇄열쇠 족쇄"]);

  const m1 = game.run("입력 0110 문");
  assert.equal(m1[0].type, "error");
  assert.ok(m1.some((m) => m.type === "system" && m.body.includes("2번")));
  game.run("입력 1234 문");
  assert.equal(game.status, "playing");

  const m3 = game.run("입력 9999 문");
  assert.equal(game.status, "lost");
  assert.equal(game.state.lostBy, "trap");
  assert.equal(last(m3).type, "ending");
  assert.deepEqual(game.run("보기"), [{ type: "system", body: "게임이 끝났습니다." }]);
});

test("jigsaw: 쐐기 없이 냉동창고에 들어가면 게임 오버, 쐐기를 괴면 1분 패널티만", async () => {
  const { game } = await fresh();
  run(game, TO_CORRIDOR);
  const msgs = game.run("이동 냉동창고");
  assert.equal(game.status, "lost");
  assert.equal(game.state.lostBy, "trap");
  assert.equal(last(msgs).type, "ending");

  const { game: g2 } = await fresh();
  run(g2, [...TO_CORRIDOR, "이동 작업장", "줍기 쐐기", "이동 복도", "사용 쐐기 냉동창고문"]);
  assert.ok(g2.state.flags.includes("freezer_wedged"));
  assert.ok(!g2.state.inventory.includes("wedge"));
  const before = g2.remainingMs();
  g2.run("이동 냉동창고");
  assert.equal(g2.status, "playing");
  assert.equal(before - g2.remainingMs(), 60_000);
});

test("jigsaw: 엉뚱한 상자를 열면 시간만 잃고, 23번 상자에서 얼음이 나온다", async () => {
  const { game } = await fresh();
  run(game, [...TO_CORRIDOR, "이동 작업장", "줍기 쐐기", "이동 복도", "사용 쐐기 냉동창고문", "이동 냉동창고"]);
  const before = game.remainingMs();
  game.run("열기 07번상자");
  assert.equal(before - game.remainingMs(), 60_000);
  assert.ok(!game.state.revealed.includes("ice"));

  game.run("열기 23번상자");
  assert.ok(game.state.revealed.includes("ice"));
  assert.match(game.run("열기 23번상자")[0].body, /이미/);
  // 토치 없이는 못 녹인다 (라이터도 소용없음)
  assert.equal(game.run("사용 토치 얼음덩이")[0].type, "error");
});

test("jigsaw: 사무실 키패드 오답은 3분 패널티, 공구함 오답은 1분", async () => {
  const { game } = await fresh();
  run(game, TO_CORRIDOR);
  let before = game.remainingMs();
  const msgs = game.run("입력 1923 사무실문");
  assert.equal(msgs[0].type, "error");
  assert.equal(before - game.remainingMs(), 180_000);
  assert.equal(game.status, "playing");

  game.run("이동 작업장");
  before = game.remainingMs();
  game.run("입력 416 공구함");
  assert.equal(before - game.remainingMs(), 60_000);
});

test("jigsaw: 작업장 뒷문을 잘못 고르면 게임 오버", async () => {
  for (const door of ["가운데문", "오른쪽문"]) {
    const { game } = await fresh();
    run(game, [...TO_CORRIDOR, "이동 작업장"]);
    const msgs = game.run(`이동 ${door}`);
    assert.equal(game.status, "lost", door);
    assert.equal(last(msgs).type, "ending");
  }
  const { game } = await fresh();
  run(game, [...TO_CORRIDOR, "이동 작업장", "이동 왼쪽문"]);
  assert.equal(game.status, "playing");
  assert.equal(game.state.room, "boiler");
});

test("jigsaw: 밸브 순서를 어기면 게임 오버", async () => {
  const path = [...TO_CORRIDOR, "이동 작업장", "이동 왼쪽문"];
  const { game: a } = await fresh();
  run(a, path);
  a.run("돌리기 급수밸브"); // 배출 전에 급수
  assert.equal(a.status, "lost");

  const { game: b } = await fresh();
  run(b, path);
  b.run("돌리기 배출밸브");
  b.run("돌리기 증기밸브"); // 급수 전에 증기
  assert.equal(b.status, "lost");

  const { game: c } = await fresh();
  run(c, path);
  assert.equal(c.run("입력 32 조절기")[0].type, "error"); // 조절기는 아직 안 보임
  run(c, ["돌리기 배출밸브", "돌리기 급수밸브", "돌리기 증기밸브"]);
  assert.equal(c.status, "playing");
  assert.ok(c.state.flags.includes("boiler_on"));
  assert.ok(c.visibleObjects().some((o) => o.id === "regulator"));
  const before = c.remainingMs();
  c.run("입력 64 조절기");
  assert.equal(before - c.remainingMs(), 300_000);
  assert.equal(c.run("입력 3.2 조절기")[0].type, "text");
  assert.ok(c.state.solvedLocks.includes("pressure_lock"));
});

test("jigsaw: 압력을 걸기 전에는 출구열쇠로 철문이 열리지 않는다", async () => {
  const { game } = await fresh();
  run(game, TO_CORRIDOR);
  game.state.inventory.push("exit_key"); // 지름길: 열쇠만 들고 있다고 가정
  const msgs = game.run("사용 출구열쇠 철문");
  assert.equal(msgs[0].type, "error");
  assert.match(msgs[0].body, /압력/);
  assert.ok(!game.state.solvedLocks.includes("exit_lock"));
  assert.equal(game.run("이동 밖")[0].type, "error");
});

test("jigsaw: 금고 오답 3회면 게임 오버 (달력 날짜는 함정)", async () => {
  const { game } = await fresh();
  run(game, [...TO_CORRIDOR, "입력 1912 사무실문", "이동 사무실"]);
  run(game, ["입력 1121 금고", "입력 2014 금고"]);
  assert.equal(game.status, "playing");
  game.run("입력 0000 금고");
  assert.equal(game.status, "lost");
  assert.equal(game.state.lostBy, "trap");
});

test("jigsaw: 조건부 설명이 상태에 따라 바뀐다", async () => {
  const { game } = await fresh();
  assert.match(game.run("조사 족쇄")[0].body, /발목/);
  run(game, ["조사 거울", "줍기 철사", "사용 철사 욕조", "줍기 족쇄열쇠", "사용 족쇄열쇠 족쇄"]);
  assert.match(game.run("조사 족쇄")[0].body, /풀린/);
  assert.match(game.run("보기")[1].body, /풀린 족쇄/);
});

test("jigsaw: 저장/불러오기에 오답 횟수가 유지된다", async () => {
  const { game, now } = await fresh();
  run(game, ["조사 거울", "줍기 철사", "사용 철사 욕조", "줍기 족쇄열쇠", "사용 족쇄열쇠 족쇄", "입력 0000 문"]);
  const snap = JSON.parse(JSON.stringify(game.toJSON()));
  assert.deepEqual(snap.attempts, { bath_lock: 1 });
  const g2 = Game.fromJSON(game.scenario, snap, { now });
  g2.run("입력 0001 문");
  g2.run("입력 0002 문");
  assert.equal(g2.status, "lost");
});

test("재도전: 함정 사망 직전 턴으로 돌아가고, 시간 패널티와 오답 초기화가 적용된다", async () => {
  const { game, now } = await fresh();
  run(game, ["조사 거울", "줍기 철사", "사용 철사 욕조", "줍기 족쇄열쇠", "사용 족쇄열쇠 족쇄", "입력 0000 문", "입력 0001 문"]);
  now.advance(10_000);
  game.run("입력 0002 문");
  assert.equal(game.status, "lost");
  assert.ok(game.canRetry());

  now.advance(5_000); // 죽고 나서 고민한 시간
  const msgs = game.retry();
  assert.equal(game.status, "playing");
  assert.equal(msgs[0].type, "system");
  assert.equal(game.state.retries, 1);
  assert.deepEqual(game.state.attempts, {});
  assert.ok(game.state.solvedLocks.includes("shackle_lock")); // 진행은 유지
  assert.equal(game.remainingMs(), 3600_000 - 15_000 - 180_000);
  assert.ok(!game.canRetry());

  // 시간 초과는 재도전 불가
  now.advance(3600_000);
  game.run("보기");
  assert.equal(game.state.lostBy, "timeout");
  assert.ok(!game.canRetry());
  assert.equal(game.retry()[0].type, "error");
});

test("재도전: 냉동창고 함정에서 돌아오면 복도에 서 있다", async () => {
  const { game } = await fresh();
  run(game, TO_CORRIDOR);
  game.run("이동 냉동창고");
  assert.equal(game.status, "lost");
  game.retry();
  assert.equal(game.state.room, "corridor");
  assert.equal(game.status, "playing");
});
