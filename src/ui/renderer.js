import { styleText } from "node:util";

const STYLE = {
  room: ["bold", "cyan"],
  text: [],
  item: ["yellow"],
  error: ["red"],
  system: ["gray"],
  hint: ["magenta"],
  ending: ["bold", "green"],
};

export function render(message, { color = true } = {}) {
  const style = STYLE[message.type] ?? [];
  let body = message.body;
  if (message.type === "room") body = `\n== ${body} ==`;
  if (message.type === "ending") body = `\n${body}`;
  return color && style.length ? styleText(style, body) : body;
}

export function renderAll(messages, opts) {
  return messages.map((m) => render(m, opts)).join("\n");
}

const TYPED = new Set(["text", "ending"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 메시지를 한 글자씩 출력한다 (서사 메시지만). 나머지는 즉시 출력.
 * @param {(s: string) => void} write
 */
export async function typeOut(messages, write, { msPerChar = 12, color = true } = {}) {
  for (const m of messages) {
    const line = render(m, { color });
    if (!TYPED.has(m.type) || msPerChar <= 0) { write(line + "\n"); continue; }
    for (const ch of line) {
      write(ch);
      if (ch !== " " && ch !== "\n") await sleep(msPerChar);
    }
    write("\n");
  }
}
