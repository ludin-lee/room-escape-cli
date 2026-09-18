import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { styleText } from "node:util";
import { parse } from "../engine/parser.js";
import { Game } from "../engine/game.js";
import { formatMs } from "../engine/timer.js";
import { renderAll, typeOut } from "./renderer.js";
import { saveSlot, loadSlot, listSlots, deleteSlot, AUTO_SLOT } from "../save/store.js";
import * as screens from "./screens.js";
import { StatusBar } from "./status.js";

/**
 * readline 루프. 저장/불러오기/종료는 여기서 처리하고 나머지는 game.run() 에 넘긴다.
 * 줄은 async iterator 로 읽어서 파이프 입력도 한 줄씩 순서대로 처리된다.
 *
 * 자동 저장: 매 턴이 끝날 때마다 `auto` 슬롯에 저장한다. 게임이 끝나면(성공/시간초과) 지운다.
 * 종료·Ctrl+C 로 나가도 `auto` 에 남아 있어서 다음 실행 때 이어할 수 있다.
 * 상태 박스: TTY 면 화면 상단에 위치·남은 시간·보이는 것·가방을 고정 표시한다 (statusBar 옵션으로 끔).
 * @param {Game} game
 * @param {object} scenario
 */
export async function runLoop(game, scenario, { input = stdin, output = stdout, typing = false, autosave = true, statusBar = true } = {}) {
  const rl = readline.createInterface({ input, output });
  const say = (s) => output.write(s + "\n");
  const status = new StatusBar(output, () => ({
    title: scenario.title,
    room: game.currentRoom().name,
    visible: game.visibleObjects().map((o) => o.names[0]),
    items: game.inventoryObjects().map((o) => o.names[0]),
    remainingMs: game.remainingMs(),
    remainingText: game.remainingText(),
  }));
  if (statusBar) status.attach();
  // 서사 메시지는 타자 효과로, 나머지는 즉시. 타자 중에는 입력을 잠시 멈춘다.
  const show = async (messages) => {
    if (!typing) { say(renderAll(messages)); return; }
    rl.pause();
    await typeOut(messages, (s) => output.write(s));
    rl.resume();
  };
  const gray = (s) => styleText(["gray"], s);
  const red = (s) => styleText(["red"], s);

  const showPrompt = () => {
    if (rl.closed) return;
    status.update();
    rl.setPrompt(gray(`[남은 시간 ${game.remainingText()}] `) + "> ");
    rl.prompt();
  };

  let autosaveWarned = false;
  const autoSave = async () => {
    if (!autosave || game.status !== "playing") return;
    try {
      await saveSlot(AUTO_SLOT, game.toJSON());
    } catch (e) {
      if (!autosaveWarned) { say(red(`자동 저장 실패: ${e.message}`)); autosaveWarned = true; }
    }
  };

  // Ctrl+C: 확인 없이 바로 나간다. 루프가 끝나면 아래에서 자동 저장 + 이어하기 안내.
  rl.on("SIGINT", () => rl.close());

  await show(game.start());
  showPrompt();

  // 함정으로 죽으면 게임 오버 화면을 띄우고 재도전 여부를 묻는다. 수락하면 죽기 직전 턴으로 돌아간다.
  const askRetry = () => {
    say(screens.gameOver());
    const penalty = Math.round((scenario.retryPenaltySec ?? 180) / 60);
    rl.setPrompt(styleText(["yellow"], `다시 도전할까요? 죽기 직전으로 돌아갑니다. (남은 시간 -${penalty}분) (Y/n) `));
    rl.prompt();
  };

  let confirmingQuit = false;
  let confirmingRetry = false;
  try {
    for await (const line of rl) {
      if (confirmingQuit) {
        confirmingQuit = false;
        if (/^y/i.test(line.trim())) break;
        showPrompt();
        continue;
      }
      if (confirmingRetry) {
        confirmingRetry = false;
        if (/^n/i.test(line.trim())) break;
        await show(game.retry());
        await autoSave();
        if (game.status !== "playing") break;
        showPrompt();
        continue;
      }

      const { verb, target } = parse(line);

      if (verb === "quit") {
        confirmingQuit = true;
        if (rl.closed) break;
        rl.setPrompt("정말 종료할까요? (y/N) ");
        rl.prompt();
        continue;
      }
      if (verb === "save") {
        const slot = target ?? AUTO_SLOT;
        try {
          await saveSlot(slot, game.toJSON());
          say(gray(`슬롯 '${slot}' 에 저장했습니다.`));
        } catch (e) {
          say(red(`저장 실패: ${e.message}`));
        }
        showPrompt();
        continue;
      }
      if (verb === "load") {
        const slot = target ?? AUTO_SLOT;
        try {
          const snapshot = await loadSlot(slot);
          game.state = Game.fromJSON(scenario, snapshot, { now: game.now }).state;
          say(gray(`슬롯 '${slot}' 을 불러왔습니다.`));
          await show(game.describeRoom());
          await autoSave();
        } catch (e) {
          const slots = await listSlots();
          const hint = slots.length ? ` (있는 슬롯: ${slots.join(", ")})` : "";
          const why = e.code === "ENOENT" ? `슬롯 '${slot}' 이 없습니다.` : e.message;
          say(red(`불러오기 실패: ${why}${hint}`));
        }
        showPrompt();
        continue;
      }

      const messages = game.run(line);
      if (messages.length) await show(messages);
      await autoSave();
      if (game.canRetry()) {
        confirmingRetry = true;
        askRetry();
        continue;
      }
      if (game.status !== "playing") break;
      showPrompt();
    }
  } finally {
    rl.close();
    status.update();
    status.detach();
  }

  if (game.status === "won") {
    const elapsed = scenario.timeLimitSec * 1000 - game.remainingMs();
    say(screens.win(formatMs(elapsed), game.state.hintsUsed, game.state.retries));
    if (autosave) await deleteSlot(AUTO_SLOT);
  } else if (game.status === "lost") {
    // 함정 사망은 재도전을 물을 때 이미 게임 오버 화면을 띄웠다
    if (game.state.lostBy !== "trap") say(screens.lose());
    if (autosave) await deleteSlot(AUTO_SLOT);
  } else {
    // 도중에 나감(종료 / Ctrl+C / 입력 끝): 마지막 턴 이후 흐른 시간까지 반영해서 한 번 더 저장
    await autoSave();
    if (autosave) say(gray(`\n진행 상황을 자동 저장했습니다. 다음에 실행하면 이어할 수 있습니다. (남은 시간 ${game.remainingText()})`));
  }
}
