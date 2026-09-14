import { evaluate } from "../conditions.js";

export default function hint(ctx) {
  const hit = (ctx.scenario.hints ?? []).find((h) => evaluate(h.when, ctx.state));
  if (!hit) return [{ type: "system", body: "더 이상 힌트가 없습니다." }];

  const penaltySec = ctx.scenario.hintPenaltySec ?? 0;
  ctx.state.hintsUsed += 1;
  ctx.state.penaltyMs += penaltySec * 1000;

  const messages = [{ type: "hint", body: `힌트: ${hit.text}` }];
  if (penaltySec > 0) {
    messages.push({ type: "system", body: `(남은 시간이 ${Math.round(penaltySec / 60)}분 줄었습니다)` });
  }
  return messages;
}
