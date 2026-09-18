import { styleText } from "node:util";

export function title() {
  const art = String.raw`
  ____                        _____
 |  _ \ ___   ___  _ __ ___  | ____|___  ___ __ _ _ __   ___
 | |_) / _ \ / _ \| '_ \` _ \ |  _| / __|/ __/ _\` | '_ \ / _ \
 |  _ < (_) | (_) | | | | | || |___\__ \ (_| (_| | |_) |  __/
 |_| \_\___/ \___/|_| |_| |_||_____|___/\___\__,_| .__/ \___|
                                                 |_|
`;
  return styleText(["cyan"], art) + styleText(["gray"], "        텍스트 방탈출 · '도움말' 로 명령어 확인\n");
}

export function win(elapsedText, hintsUsed, retries = 0) {
  return styleText(["bold", "green"], `
  ╔══════════════════════════╗
  ║       탈 출   성 공       ║
  ╚══════════════════════════╝
`) + styleText(["gray"], `  걸린 시간 ${elapsedText} · 힌트 ${hintsUsed}회${retries ? ` · 재도전 ${retries}회` : ""}\n`);
}

export function lose() {
  return styleText(["bold", "red"], `
  ╔══════════════════════════╗
  ║       시 간   초 과       ║
  ╚══════════════════════════╝
`);
}

export function gameOver() {
  return styleText(["bold", "red"], `
  ╔══════════════════════════╗
  ║       게 임   오 버       ║
  ╚══════════════════════════╝
`) + styleText(["gray"], "  실수는 용납되지 않았다.\n");
}
