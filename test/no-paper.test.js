import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine/game.js";
import { loadScenario } from "../src/content/loader.js";
import { fakeClock } from "./helpers.js";

async function fresh() {
  const game = new Game(await loadScenario("no-paper"), { now: fakeClock() });
  game.start();
  return game;
}
const run = (g, cmds) => cmds.map((c) => g.run(c));
const TO_SINK = ["조사 주머니", "줍기 동전", "줍기 휴대폰", "누르기 휴대폰", "줍기 젖은휴지", "사용 동전 칸막이문", "이동 세면대"];

test("no-paper: 휴지가 변기에 있을 때 물을 내리면 게임 오버, 건진 뒤엔 무사", async () => {
  const a = await fresh();
  run(a, ["조사 주머니", "줍기 휴대폰", "누르기 휴대폰"]);
  assert.ok(a.state.flags.includes("paper_in_toilet"));
  a.run("누르기 변기");
  assert.equal(a.status, "lost");

  const b = await fresh();
  run(b, ["조사 주머니", "줍기 휴대폰", "누르기 휴대폰", "줍기 젖은휴지"]);
  assert.ok(!b.state.flags.includes("paper_in_toilet"));
  b.run("누르기 변기");
  assert.equal(b.status, "playing");
});

test("no-paper: 해결 전에 복도로 나가면 사회적 사망, 손 안 씻어도 사망, 순서대로 하면 성공", async () => {
  const a = await fresh();
  run(a, TO_SINK);
  a.run("이동 복도");
  assert.equal(a.status, "lost");
  assert.equal(a.state.lostBy, "trap");

  const b = await fresh();
  run(b, [...TO_SINK, "입력 0315 청소도구함", "줍기 고무장갑", "줍기 관리열쇠", "사용 관리열쇠 디스펜서", "줍기 종이타월",
    "사용 젖은휴지 핸드드라이어", "조합 마른휴지 종이타월", "이동 칸", "사용 완벽한휴지"]);
  assert.ok(b.state.flags.includes("clean"));
  run(b, ["이동 세면대", "이동 복도"]);
  assert.equal(b.status, "lost"); // 손을 안 씻었다
  b.retry();
  run(b, ["누르기 비누", "이동 복도"]);
  assert.equal(b.status, "won");
});

test("no-paper: 장갑 없이는 못 말리고, 완벽한휴지는 칸에서만, 종이타월을 변기에 넣으면 막힌다", async () => {
  const g = await fresh();
  run(g, [...TO_SINK, "입력 0315 청소도구함", "줍기 관리열쇠", "사용 관리열쇠 디스펜서", "줍기 종이타월"]);
  assert.equal(g.run("사용 젖은휴지 핸드드라이어")[0].type, "error");
  g.run("줍기 고무장갑");
  const before = g.remainingMs();
  g.run("사용 젖은휴지 핸드드라이어");
  assert.equal(before - g.remainingMs(), 120_000);
  assert.ok(g.state.inventory.includes("dry_paper"));
  g.run("조합 마른휴지 종이타월");
  assert.equal(g.run("사용 완벽한휴지")[0].type, "error"); // 세면대에서는 안 됨
  assert.ok(g.state.inventory.includes("perfect_paper"));
  assert.equal(g.run("누르기 비누")[0].type, "text");
  assert.ok(!g.state.flags.includes("washed")); // 순서가 틀렸다

  const h = await fresh();
  run(h, [...TO_SINK, "입력 0315 청소도구함", "줍기 관리열쇠", "사용 관리열쇠 디스펜서", "줍기 종이타월", "이동 칸"]);
  h.run("사용 종이타월 변기");
  assert.equal(h.status, "lost");
});
