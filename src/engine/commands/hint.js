import { evaluate } from "../conditions.js";

export default function hint(ctx) {
  // 조건을 만족하는 힌트 중 아직 안 보여 준 것을 순서대로. 다 봤으면 처음부터 다시.
  // `힌트 E3` 처럼 코드를 주면 그 코드가 달린 힌트만 (사물·방에 적힌 힌트 코드).
  const code = ctx.target?.toUpperCase() ?? null;
  const all = (ctx.scenario.hints ?? []).map((h, i) => [h, i]);
  if (code && !all.some(([h]) => h.code?.toUpperCase() === code)) return [ctx.error(`'${ctx.target}' 이라는 힌트 코드는 없습니다.`)];
  const open = all.filter(([h]) => (code ? h.code?.toUpperCase() === code : true) && evaluate(h.when, ctx.state));
  if (open.length === 0) return [{ type: "system", body: code ? "그 힌트는 지금 상황에서 볼 것이 없습니다." : "더 이상 힌트가 없습니다." }];
  const seen = (ctx.state.hintsSeen ??= []);
  let pick = open.find(([, i]) => !seen.includes(i));
  if (!pick) { seen.length = 0; pick = open[0]; }
  const [hit, idx] = pick;
  seen.push(idx);

  const penaltySec = ctx.scenario.hintPenaltySec ?? 0;
  ctx.state.hintsUsed += 1;
  ctx.state.penaltyMs += penaltySec * 1000;

  const messages = [{ type: "hint", body: `힌트: ${hit.text}` }];
  if (penaltySec > 0) {
    messages.push({ type: "system", body: `(남은 시간이 ${Math.round(penaltySec / 60)}분 줄었습니다)` });
  }
  return messages;
}
