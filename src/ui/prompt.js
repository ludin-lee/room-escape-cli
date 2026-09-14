import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { styleText } from "node:util";
import { parse } from "../engine/parser.js";
import { Game } from "../engine/game.js";
import { formatMs } from "../engine/timer.js";
import { renderAll, typeOut } from "./renderer.js";
import { saveSlot, loadSlot, listSlots } from "../save/store.js";
import * as screens from "./screens.js";

const DEFAULT_SLOT = "auto";

/**
 * readline 루프. 저장/불러오기/종료는 여기서 처리하고 나머지는 game.run() 에 넘긴다.
 * 줄은 async iterator 로 읽어서 파이프 입력도 한 줄씩 순서대로 처리된다.
 * @param {Game} game
 * @param {object} scenario
 */
export async function runLoop(game, scenario, { input = stdin, output = stdout, typing = false } = {}) {
  const rl = readline.createInterface({ input, output });
  const say = (s) => output.write(s + "\n");
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
    rl.setPrompt(gray(`[남은 시간 ${game.remainingText()}] `) + "> ");
    rl.prompt();
  };

  await show(game.start());
  showPrompt();

  let confirmingQuit = false;
  try {
    for await (const line of rl) {
      if (confirmingQuit) {
        confirmingQuit = false;
        if (/^y/i.test(line.trim())) break;
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
        const slot = target ?? DEFAULT_SLOT;
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
        const slot = target ?? DEFAULT_SLOT;
        try {
          const snapshot = await loadSlot(slot);
          game.state = Game.fromJSON(scenario, snapshot, { now: game.now }).state;
          say(gray(`슬롯 '${slot}' 을 불러왔습니다.`));
          await show(game.describeRoom());
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
      if (game.status !== "playing") break;
      showPrompt();
    }
  } finally {
    rl.close();
  }

  if (game.status === "won") {
    const elapsed = scenario.timeLimitSec * 1000 - game.remainingMs();
    say(screens.win(formatMs(elapsed), game.state.hintsUsed));
  } else if (game.status === "lost") {
    say(screens.lose());
  }
}
