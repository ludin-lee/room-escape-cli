import { apply } from "../effects.js";
import { evaluate } from "../conditions.js";
import { josa } from "../josa.js";

export default function use(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 사용할까요? 예: 사용 열쇠 문")];
  const item = ctx.findObject(ctx.target, { includeRoom: false });
  if (!item) return [ctx.notFound(ctx.target, { includeRoom: false })];

  // 대상 없이 사용: onUse 훅만 실행
  if (!ctx.secondary) {
    if (item.onUse) return runHook(item.onUse, ctx);
    return [ctx.error(`${josa(item.names[0], "을/를")} 어디에 사용할까요? 예: 사용 ${item.names[0]} 문`)];
  }

  const target = ctx.findObject(ctx.secondary, { includeInventory: false });
  if (!target) return [ctx.notFound(ctx.secondary, { includeInventory: false })];

  // 1) key 타입 자물쇠에 맞는 아이템
  const lock = target.lock ? ctx.scenario.locks[target.lock] : null;
  const isKeyLock = lock && lock.type === "key";
  if (isKeyLock && lock.keyItem === item.id) {
    if (ctx.state.solvedLocks.includes(target.lock)) {
      return [{ type: "text", body: "이미 열려 있다." }];
    }
    if (lock.requires && !evaluate(lock.requires, ctx.state)) {
      return [ctx.error(lock.requiresMessage ?? "지금은 열 수 없다.")];
    }
    return ctx.solveLock(target.lock, { consumeItem: lock.consume ? item.id : null });
  }

  // 2) 아이템별 대상 지정 onUse (onUse: { "door": {...} } 또는 onUse: { target: "door", ... })
  //    자물쇠에 맞지 않는 아이템이라도 훅이 있으면 그 반응을 우선한다 (엉뚱한 도구를 쓰는 함정 등)
  const hook = pickUseHook(item.onUse, target.id);
  if (hook) return runHook(hook, ctx);

  if (isKeyLock) {
    if (ctx.state.solvedLocks.includes(target.lock)) return [{ type: "text", body: "이미 열려 있다." }];
    return [ctx.error(`${josa(item.names[0], "은/는")} ${target.names[0]}에 맞지 않는다.`)];
  }
  return [ctx.error(`${josa(item.names[0], "을/를")} ${target.names[0]}에 사용해도 아무 일도 일어나지 않는다.`)];
}

function pickUseHook(onUse, targetId) {
  if (!onUse) return null;
  if (onUse.target) return onUse.target === targetId ? onUse : null;
  if (onUse[targetId]) return onUse[targetId];
  return null;
}

function runHook(hook, ctx) {
  if (!evaluate(hook.when, ctx.state)) {
    return [ctx.error(hook.failMessage ?? "지금은 사용할 수 없다.")];
  }
  const messages = apply(hook.effects, ctx.state);
  if (hook.message) messages.unshift({ type: "text", body: hook.message });
  return messages;
}
