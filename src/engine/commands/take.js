import { apply } from "../effects.js";
import { josa } from "../josa.js";

export default function take(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 주울까요? 예: 줍기 열쇠")];
  const obj = ctx.findObject(ctx.target, { includeInventory: false });
  if (!obj) {
    const inBag = ctx.findObject(ctx.target, { includeRoom: false });
    if (inBag) return [ctx.error(`${josa(inBag.names[0], "은/는")} 이미 가방에 있습니다.`)];
    return [ctx.error(`'${ctx.target}' 은(는) 여기에 없습니다.`)];
  }
  if (!obj.takeable) return [ctx.error(`${josa(obj.names[0], "은/는")} 가져갈 수 없습니다.`)];

  ctx.state.inventory.push(obj.id);
  const messages = [{ type: "item", body: `${josa(obj.names[0], "을/를")} 가방에 넣었다.` }];
  if (obj.onTake) {
    messages.push(...apply(obj.onTake.effects, ctx.state));
    if (obj.onTake.message) messages.push({ type: "text", body: obj.onTake.message });
  }
  return messages;
}
