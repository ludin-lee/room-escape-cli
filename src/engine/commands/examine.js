import { apply } from "../effects.js";
import { pickHook } from "../hooks.js";

export default function examine(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 조사할까요? 예: 조사 책상")];
  const obj = ctx.findObject(ctx.target);
  if (!obj) return [ctx.notFound(ctx.target)];

  const messages = [{ type: "text", body: ctx.describe(obj.description) }];
  const lockId = obj.lock;
  if (lockId && ctx.state.solvedLocks.includes(lockId)) {
    messages.push({ type: "text", body: "자물쇠는 이미 풀려 있다." });
  }
  const hook = pickHook(obj.onExamine, ctx.state);
  if (hook) {
    messages.push(...apply(hook.effects, ctx.state));
    if (hook.message) messages.push({ type: "text", body: hook.message });
  }
  return messages;
}
