import { evaluate } from "./conditions.js";
import { apply } from "./effects.js";

/**
 * 훅(onExamine / onTake / onInteract / onEnter)은 객체 하나 또는 배열이다.
 * 배열이면 위에서부터 `when` 을 만족하는 첫 항목을 고른다. 없으면 null.
 */
export function pickHook(hook, state) {
  if (!hook) return null;
  const list = Array.isArray(hook) ? hook : [hook];
  return list.find((h) => evaluate(h.when, state)) ?? null;
}

/** 훅 목록을 배열로 정규화한다 (validate 용). */
export function hookList(hook) {
  if (!hook) return [];
  return Array.isArray(hook) ? hook : [hook];
}

/** 훅 실행: message 를 먼저, 효과를 그 다음에. (gameOver 메시지가 서사 뒤에 오도록) */
export function runHook(hook, state) {
  const messages = [];
  if (hook.message) messages.push({ type: "text", body: hook.message });
  messages.push(...apply(hook.effects, state));
  return messages;
}

/**
 * 조건부 설명. 문자열이면 그대로, 배열이면 `when` 을 만족하는 첫 항목의 text.
 * @param {string|{when?: object, text: string}[]} desc
 */
export function describe(desc, state) {
  if (typeof desc === "string") return desc;
  if (!Array.isArray(desc)) return "";
  return desc.find((d) => evaluate(d.when, state))?.text ?? "";
}
