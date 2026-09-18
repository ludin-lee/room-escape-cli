import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readdir } from "node:fs/promises";
import { Readable, Writable } from "node:stream";
import os from "node:os";
import path from "node:path";

// SAVE_DIR 은 모듈 로드 시 결정되므로 import 전에 환경변수를 잡는다.
const dir = await mkdtemp(path.join(os.tmpdir(), "escape-save-"));
process.env.ESCAPE_SAVE_DIR = dir;
const store = await import("../src/save/store.js");
const { Game } = await import("../src/engine/game.js");
const { loadScenario } = await import("../src/content/loader.js");
const { runLoop } = await import("../src/ui/prompt.js");
const { fakeClock } = await import("./helpers.js");

after(async () => { await rm(dir, { recursive: true, force: true }); });

test("saveSlot / loadSlot / listSlots / deleteSlot", async () => {
  assert.equal(store.SAVE_DIR, dir);
  await store.saveSlot("s1", { scenarioId: "x", status: "playing", room: "a" });
  await store.saveSlot("s2", { scenarioId: "x", status: "won" });
  const loaded = await store.loadSlot("s1");
  assert.equal(loaded.room, "a");
  assert.ok(typeof loaded.savedAt === "number");
  assert.deepEqual(await store.listSlots(), ["s1", "s2"]);
  assert.ok(!(await readdir(dir)).some((f) => f.endsWith(".tmp")), "임시 파일이 남으면 안 된다");

  await store.deleteSlot("s1");
  await store.deleteSlot("nosuch");
  assert.deepEqual(await store.listSlots(), ["s2"]);
  await assert.rejects(() => store.saveSlot("../evil", {}), /슬롯 이름/);
  await store.deleteSlot("s2");
});

test("findResumable: 진행 중인 auto 저장만, 시나리오가 지정되면 일치할 때만", async () => {
  assert.equal(await store.findResumable(), null);
  await store.saveSlot(store.AUTO_SLOT, { scenarioId: "old-study", status: "playing" });
  assert.equal((await store.findResumable()).scenarioId, "old-study");
  assert.equal((await store.findResumable("old-study")).scenarioId, "old-study");
  assert.equal(await store.findResumable("midnight-ward"), null);
  await store.saveSlot(store.AUTO_SLOT, { scenarioId: "old-study", status: "won" });
  assert.equal(await store.findResumable(), null);
  await store.deleteSlot(store.AUTO_SLOT);
});

function collect() {
  let text = "";
  const out = new Writable({ write(chunk, _enc, cb) { text += chunk; cb(); } });
  out.isTTY = false;
  return { out, text: () => text };
}

async function play(lines, { scenarioId = "midnight-ward", now = fakeClock() } = {}) {
  const scenario = await loadScenario(scenarioId);
  const game = new Game(scenario, { now });
  const input = Readable.from(lines.map((l) => l + "\n"));
  const { out, text } = collect();
  await runLoop(game, scenario, { input, output: out, typing: false });
  return { game, output: text() };
}

test("runLoop: 매 턴 auto 슬롯에 자동 저장되고, 종료해도 남는다", async () => {
  const now = fakeClock();
  const { game, output } = await play(["조사 침대", "줍기 팔찌", "종료", "y"], { now });
  assert.equal(game.status, "playing");
  const auto = await store.loadSlot(store.AUTO_SLOT);
  assert.equal(auto.scenarioId, "midnight-ward");
  assert.equal(auto.status, "playing");
  assert.deepEqual(auto.inventory, ["wristband"]);
  assert.ok(auto.flags.includes("bed_checked"));
  assert.match(output, /자동 저장했습니다/);
  assert.equal((await store.findResumable("midnight-ward")).inventory[0], "wristband");
});

test("runLoop: 클리어하면 auto 슬롯이 지워진다", async () => {
  const { game } = await play([
    "조사 침대", "줍기 팔찌", "입력 0427 사물함", "줍기 손전등",
    "이동 복도", "사용 손전등", "줍기 카드키", "사용 카드키 약제실문",
    "이동 약제실", "입력 327 약장", "줍기 계단열쇠",
    "이동 복도", "사용 계단열쇠 비상문", "이동 비상계단",
  ]);
  assert.equal(game.status, "won");
  assert.equal(await store.findResumable(), null);
  assert.ok(!(await store.listSlots()).includes(store.AUTO_SLOT));
});

test("runLoop: 시간 초과로 끝나도 auto 슬롯이 지워진다", async () => {
  const now = fakeClock();
  const scenario = await loadScenario("midnight-ward");
  const game = new Game(scenario, { now });
  const lines = ["조사 침대", "보기"];
  const input = new Readable({ read() {} });
  const { out } = collect();
  const done = runLoop(game, scenario, { input, output: out, typing: false });
  input.push(lines[0] + "\n");
  await new Promise((r) => setTimeout(r, 20));
  assert.ok((await store.listSlots()).includes(store.AUTO_SLOT));
  now.advance(scenario.timeLimitSec * 1000 + 1);
  input.push(lines[1] + "\n");
  input.push(null);
  await done;
  assert.equal(game.status, "lost");
  assert.ok(!(await store.listSlots()).includes(store.AUTO_SLOT));
});
