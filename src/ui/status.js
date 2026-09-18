import { styleText } from "node:util";
import { displayWidth } from "../engine/width.js";

export { displayWidth };

/**
 * 터미널 상단 고정 상태 박스.
 *
 * 화면 위 5줄을 스크롤 영역에서 제외(DECSTBM)하고 거기에 위치·남은 시간·보이는 것·가방을 그린다.
 * 게임 출력은 그 아래에서만 스크롤된다. 1초마다 남은 시간을 다시 그리며,
 * 커서를 저장(ESC 7)/복원(ESC 8)하므로 입력 중에도 화면이 깨지지 않는다.
 * TTY 가 아니거나 화면이 너무 작으면 아무것도 하지 않는다.
 */

const HEIGHT = 5;
const MIN_ROWS = 10;

/** 표시 폭 기준으로 자르고 "…" 을 붙인다. */
function truncate(str, max) {
  if (displayWidth(str) <= max) return str;
  let out = "";
  for (const ch of str) {
    if (displayWidth(out + ch) > max - 1) break;
    out += ch;
  }
  return out + "…";
}

function pad(str, width) {
  return str + " ".repeat(Math.max(0, width - displayWidth(str)));
}

function timeStyle(remainingMs) {
  if (remainingMs <= 60_000) return ["bold", "red"];
  if (remainingMs <= 300_000) return ["yellow"];
  return ["green"];
}

/**
 * 박스 5줄을 만든다 (순수 함수, 테스트용).
 * @param {{ title: string, room: string, visible?: string[], items: string[], remainingMs: number, remainingText: string, width: number, color?: boolean }} p
 * @returns {string[]}
 */
export function renderStatus({ title, room, visible = [], items, remainingMs, remainingText, width, color = true }) {
  const c = (style, s) => (color ? styleText(style, s) : s);
  const inner = width - 2; // 양쪽 테두리 제외
  const line = (segments) => {
    // segments: [text, style][] — 폭은 색 없는 텍스트로 계산
    const plain = segments.map(([t]) => t).join("");
    const body = segments.map(([t, st]) => (st ? c(st, t) : t)).join("");
    return c(["cyan"], "│") + body + " ".repeat(Math.max(0, inner - displayWidth(plain))) + c(["cyan"], "│");
  };

  const head = truncate(` ${title} `, inner - 3);
  // "┌─" + 제목 + 채움 + "┐" = width
  const top = c(["cyan"], "┌─") + c(["bold", "cyan"], head) + c(["cyan"], "─".repeat(Math.max(0, inner - 1 - displayWidth(head))) + "┐");
  const bottom = c(["cyan"], "└" + "─".repeat(inner) + "┘");

  const timeLabel = " 남은 시간 ";
  const timeBlock = timeLabel + remainingText + " ";
  const roomMax = inner - displayWidth(timeBlock) - 7;
  const roomText = pad(truncate(room, roomMax), roomMax);
  const l1 = line([[" 위치  ", ["gray"]], [roomText, ["bold", "yellow"]], [timeLabel, ["gray"]], [remainingText + " ", timeStyle(remainingMs)]]);

  const seen = visible.length ? visible.join(", ") : "(없음)";
  const l2 = line([[" 보임  ", ["gray"]], [truncate(seen, inner - 8), visible.length ? ["cyan"] : ["gray"]]]);

  const bag = items.length ? items.join(", ") : "(비어 있음)";
  const l3 = line([[" 가방  ", ["gray"]], [truncate(bag, inner - 8), items.length ? ["magenta"] : ["gray"]]]);

  return [top, l1, l2, l3, bottom];
}

export class StatusBar {
  /**
   * @param {import("node:tty").WriteStream} output
   * @param {() => { title: string, room: string, items: string[], remainingMs: number, remainingText: string }} snapshot
   */
  constructor(output, snapshot) {
    this.output = output;
    this.snapshot = snapshot;
    this.active = false;
    this.timer = null;
    this.onResize = () => { if (this.active) this.#layout(); };
  }

  get enabled() {
    return Boolean(this.output.isTTY) && (this.output.rows ?? 0) >= MIN_ROWS && (this.output.columns ?? 0) >= 30;
  }

  /** 화면을 비우고 스크롤 영역을 설정한 뒤 박스를 그린다. */
  attach() {
    if (!this.enabled || this.active) return;
    this.active = true;
    this.output.write("\x1b[2J\x1b[H");
    this.#layout();
    this.timer = setInterval(() => this.update(), 1000);
    this.output.on("resize", this.onResize);
  }

  /** 스크롤 영역을 해제한다. 박스는 화면에 남지만 더 이상 갱신하지 않는다. */
  detach() {
    if (!this.active) return;
    this.active = false;
    clearInterval(this.timer);
    this.timer = null;
    this.output.off("resize", this.onResize);
    this.output.write("\x1b7\x1b[r\x1b8");
  }

  /** 현재 커서 위치를 유지한 채 박스만 다시 그린다. */
  update() {
    if (!this.active) return;
    this.output.write("\x1b7" + this.#draw() + "\x1b8");
  }

  #layout() {
    const rows = this.output.rows;
    // 스크롤 영역: HEIGHT+1 행 ~ 마지막 행. 설정하면 커서가 홈으로 가므로 영역 첫 줄로 옮긴다.
    this.output.write(`\x1b[${HEIGHT + 1};${rows}r` + this.#draw() + `\x1b[${HEIGHT + 1};1H`);
  }

  #draw() {
    const width = Math.min(this.output.columns, 100);
    const lines = renderStatus({ ...this.snapshot(), width });
    return lines.map((l, i) => `\x1b[${i + 1};1H\x1b[2K${l}`).join("");
  }
}
