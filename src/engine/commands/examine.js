import { apply } from "../effects.js";
import { evaluate } from "../conditions.js";

export default function examine(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 조사할까요? 예: 조사 책상")];
  const obj = ctx.findObject(ctx.target);
  if (!obj) return [ctx.error(`'${ctx.target}' 은(는) 여기에 없습니다.`)];

  const messages = [{ type: "text", body: obj.description }];
  const lockId = obj.lock;
  if (lockId && ctx.state.solvedLocks.includes(lockId)) {
    messages.push({ type: "text", body: "자물쇠는 이미 풀려 있다." });
  }
  const hook = obj.onExamine;
  if (hook && evaluate(hook.when, ctx.state)) {
    messages.push(...apply(hook.effects, ctx.state));
    if (hook.message) messages.push({ type: "text", body: hook.message });
  }
  return messages;
}
