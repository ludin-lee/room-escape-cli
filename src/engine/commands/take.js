import { apply } from "../effects.js";
import { pickHook } from "../hooks.js";
import { josa } from "../josa.js";

export default function take(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 주울까요? 예: 줍기 열쇠")];
  const obj = ctx.findObject(ctx.target, { includeInventory: false });
  if (!obj) {
    const inBag = ctx.findObject(ctx.target, { includeRoom: false });
    if (inBag) return [ctx.error(`${josa(inBag.names[0], "은/는")} 이미 가방에 있습니다.`)];
    return [ctx.notFound(ctx.target, { includeInventory: false })];
  }
  if (!obj.takeable) return [ctx.error(`${josa(obj.names[0], "은/는")} 가져갈 수 없습니다.`)];

  ctx.state.inventory.push(obj.id);
  const messages = [{ type: "item", body: `${josa(obj.names[0], "을/를")} 가방에 넣었다.` }];
  const hook = pickHook(obj.onTake, ctx.state);
  if (hook) {
    messages.push(...apply(hook.effects, ctx.state));
    if (hook.message) messages.push({ type: "text", body: hook.message });
  }
  return messages;
}
