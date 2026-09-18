import { apply } from "../effects.js";
import { evaluate } from "../conditions.js";

function normalize(code) {
  return String(code).toLowerCase().replace(/[\s\-_.]/g, "");
}

export default function enter(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 입력할까요? 예: 입력 731 문")];
  const code = ctx.target;

  let target;
  if (ctx.secondary) {
    target = ctx.findObject(ctx.secondary, { includeInventory: false });
    if (!target) return [ctx.notFound(ctx.secondary, { includeInventory: false })];
    if (!target.lock) return [ctx.error(`${target.names[0]}에는 입력할 곳이 없다.`)];
  } else {
    const locked = ctx.visibleObjects().filter((o) => o.lock && ctx.scenario.locks[o.lock]?.type === "code");
    if (locked.length === 0) return [ctx.error("여기에는 코드를 입력할 곳이 없다.")];
    if (locked.length > 1) {
      const names = locked.map((o) => o.names[0]).join(", ");
      return [ctx.error(`어디에 입력할까요? (${names}) 예: 입력 ${code} ${locked[0].names[0]}`)];
    }
    target = locked[0];
  }

  const lockId = target.lock;
  const lock = ctx.scenario.locks[lockId];
  if (lock.type !== "code") return [ctx.error(`${target.names[0]}은(는) 코드로 열 수 없다.`)];
  if (ctx.state.solvedLocks.includes(lockId)) return [{ type: "text", body: "이미 열려 있다." }];
  if (lock.requires && !evaluate(lock.requires, ctx.state)) {
    return [ctx.error(lock.requiresMessage ?? "지금은 손댈 수 없다.")];
  }

  if (normalize(code) === normalize(lock.answer)) return ctx.solveLock(lockId);

  // 오답: failMessage → onFail 효과 → 횟수 제한(maxAttempts) 처리
  const messages = [ctx.error(lock.failMessage ?? "아무 일도 일어나지 않는다.")];
  const attempts = (ctx.state.attempts[lockId] ?? 0) + 1;
  ctx.state.attempts[lockId] = attempts;
  if (lock.onFail?.message) messages.push({ type: "text", body: lock.onFail.message });
  messages.push(...apply(lock.onFail?.effects, ctx.state));

  if (lock.maxAttempts) {
    if (attempts >= lock.maxAttempts) {
      if (lock.onMaxAttempts?.message) messages.push({ type: "text", body: lock.onMaxAttempts.message });
      messages.push(...apply(lock.onMaxAttempts?.effects, ctx.state));
    } else {
      messages.push({ type: "system", body: `(남은 기회 ${lock.maxAttempts - attempts}번)` });
    }
  }
  return messages;
}
