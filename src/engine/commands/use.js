import { apply } from "../effects.js";
import { evaluate } from "../conditions.js";
import { josa } from "../josa.js";

export default function use(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 사용할까요? 예: 사용 열쇠 문")];
  const item = ctx.findObject(ctx.target, { includeRoom: false });
  if (!item) return [ctx.error(`가방에 '${ctx.target}' 이(가) 없습니다.`)];

  // 대상 없이 사용: onUse 훅만 실행
  if (!ctx.secondary) {
    if (item.onUse) return runHook(item.onUse, ctx);
    return [ctx.error(`${josa(item.names[0], "을/를")} 어디에 사용할까요? 예: 사용 ${item.names[0]} 문`)];
  }

  const target = ctx.findObject(ctx.secondary, { includeInventory: false });
  if (!target) return [ctx.error(`'${ctx.secondary}' 은(는) 여기에 없습니다.`)];

  // 1) key 타입 자물쇠
  const lock = target.lock ? ctx.scenario.locks[target.lock] : null;
  if (lock && lock.type === "key") {
    if (ctx.state.solvedLocks.includes(target.lock)) {
      return [{ type: "text", body: "이미 열려 있다." }];
    }
    if (lock.keyItem !== item.id) {
      return [ctx.error(`${josa(item.names[0], "은/는")} ${target.names[0]}에 맞지 않는다.`)];
    }
    return ctx.solveLock(target.lock, { consumeItem: lock.consume ? item.id : null });
  }

  // 2) 아이템별 대상 지정 onUse (onUse: { "door": {...} } 또는 onUse: { target: "door", ... })
  const hook = pickUseHook(item.onUse, target.id);
  if (hook) return runHook(hook, ctx);

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
