import { apply } from "../effects.js";
import { evaluate } from "../conditions.js";
import { josa } from "../josa.js";

/**
 * 조합 <아이템> <아이템>
 * 가방의 두 아이템으로 scenario.recipes 에서 레시피를 찾는다 (순서 무관).
 * 레시피: { inputs: [a, b], output?: c, consume?: true | [ids], when?, failMessage?, message?, effects? }
 *  - consume 기본값 true (둘 다 제거). 배열이면 그 아이템만 제거.
 *  - output 이 있으면 가방에 추가. 없으면 effects 만으로 결과를 표현 (예: setFlag).
 */
export default function combine(ctx) {
  if (!ctx.target || !ctx.secondary) return [ctx.error("무엇과 무엇을 조합할까요? 예: 조합 방망이 못")];
  const a = ctx.findObject(ctx.target, { includeRoom: false });
  if (!a) return [ctx.error(`가방에 '${ctx.target}' 이(가) 없습니다.`)];
  const b = ctx.findObject(ctx.secondary, { includeRoom: false });
  if (!b) return [ctx.error(`가방에 '${ctx.secondary}' 이(가) 없습니다.`)];
  if (a.id === b.id) return [ctx.error("같은 물건끼리는 조합할 수 없다.")];

  const recipe = (ctx.scenario.recipes ?? []).find((r) => {
    const [x, y] = r.inputs;
    return (x === a.id && y === b.id) || (x === b.id && y === a.id);
  });
  if (!recipe) {
    return [ctx.error(`${josa(a.names[0], "과/와")} ${josa(b.names[0], "은/는")} 합쳐지지 않는다.`)];
  }
  if (!evaluate(recipe.when, ctx.state)) {
    return [ctx.error(recipe.failMessage ?? "지금은 조합할 수 없다.")];
  }

  const consume = recipe.consume ?? true;
  const toRemove = consume === true ? recipe.inputs : Array.isArray(consume) ? consume : [];
  for (const id of toRemove) {
    const i = ctx.state.inventory.indexOf(id);
    if (i >= 0) ctx.state.inventory.splice(i, 1);
  }

  const messages = [];
  if (recipe.message) messages.push({ type: "text", body: recipe.message });
  if (recipe.output) {
    if (!ctx.state.inventory.includes(recipe.output)) ctx.state.inventory.push(recipe.output);
    const out = ctx.scenario.objects[recipe.output];
    messages.push({ type: "item", body: `${josa(out.names[0], "을/를")} 만들었다.` });
  }
  messages.push(...apply(recipe.effects, ctx.state));
  return messages;
}
