#!/usr/bin/env node
import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { parseArgs } from "node:util";
import { listScenarios, loadScenario } from "../src/content/loader.js";
import { Game } from "../src/engine/game.js";
import { runLoop } from "../src/ui/prompt.js";
import { loadSlot, findResumable } from "../src/save/store.js";
import { formatMs } from "../src/engine/timer.js";
import * as screens from "../src/ui/screens.js";

const { values } = parseArgs({
  options: {
    scenario: { type: "string", short: "s" },
    load: { type: "string", short: "l" },
    list: { type: "boolean" },
    new: { type: "boolean", short: "n" },
    fast: { type: "boolean", short: "f" },
    "no-status": { type: "boolean" },
    help: { type: "boolean", short: "h" },
  },
});

if (values.help) {
  console.log(`사용법: escape [옵션]
  -s, --scenario <id>   시나리오 지정 (생략 시 목록에서 선택)
  -l, --load <slot>     저장 슬롯에서 이어하기
  -n, --new             자동 저장을 무시하고 새로 시작
      --list            시나리오 목록 출력
  -f, --fast            타자 효과 끄기 (ESCAPE_FAST=1 도 동일)
      --no-status       상단 상태 박스 끄기 (ESCAPE_NO_STATUS=1 도 동일)`);
  process.exit(0);
}

const scenarios = await listScenarios();
if (scenarios.length === 0) {
  console.error("시나리오가 없습니다.");
  process.exit(1);
}

if (values.list) {
  for (const s of scenarios) console.log(`${s.id}\t${s.title}\t${Math.round(s.timeLimitSec / 60)}분`);
  process.exit(0);
}

stdout.write(screens.title());

let snapshot = null;
let scenarioId = values.scenario;
if (values.load) {
  try {
    snapshot = await loadSlot(values.load);
  } catch (e) {
    console.error(e.code === "ENOENT" ? `저장 슬롯 '${values.load}' 이 없습니다.` : `불러오기 실패: ${e.message}`);
    process.exit(1);
  }
  scenarioId = snapshot.scenarioId;
}

// 진행 중인 자동 저장이 있으면 이어할지 묻는다 (TTY 에서만. 파이프 입력은 항상 새로 시작).
if (!snapshot && !values.new && stdin.isTTY) {
  const auto = await findResumable(scenarioId ?? null);
  if (auto) {
    try {
      const s = await loadScenario(auto.scenarioId);
      const remaining = s.timeLimitSec * 1000 - auto.elapsedMs - auto.penaltyMs;
      const when = auto.savedAt ? new Date(auto.savedAt).toLocaleString("ko-KR") : "";
      console.log(`진행 중인 게임이 있습니다: ${s.title}  (남은 시간 ${formatMs(remaining)}${when ? `, 저장 ${when}` : ""})`);
      const rl = readline.createInterface({ input: stdin, output: stdout });
      const ans = (await rl.question("이어할까요? (Y/n) ")).trim();
      rl.close();
      if (!/^n/i.test(ans)) {
        snapshot = auto;
        scenarioId = auto.scenarioId;
      }
    } catch { /* 저장된 시나리오가 사라졌으면 새로 시작 */ }
  }
}

if (!scenarioId) {
  if (scenarios.length === 1) {
    scenarioId = scenarios[0].id;
  } else {
    const rl = readline.createInterface({ input: stdin, output: stdout });
    scenarios.forEach((s, i) => console.log(`  ${i + 1}. ${s.title} (${Math.round(s.timeLimitSec / 60)}분)`));
    const ans = await rl.question("시나리오 번호를 고르세요: ");
    rl.close();
    const idx = Number.parseInt(ans, 10) - 1;
    scenarioId = scenarios[idx]?.id ?? scenarios[0].id;
  }
}

const scenario = await loadScenario(scenarioId);
const game = snapshot ? Game.fromJSON(scenario, snapshot) : new Game(scenario);
console.log(`\n▶ ${scenario.title}  (제한 시간 ${Math.round(scenario.timeLimitSec / 60)}분)\n`);
const typing = stdout.isTTY && !values.fast && !process.env.ESCAPE_FAST;
const statusBar = !values["no-status"] && !process.env.ESCAPE_NO_STATUS;
await runLoop(game, scenario, { typing, statusBar });
