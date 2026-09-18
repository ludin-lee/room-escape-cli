import { pickHook, runHook } from "../hooks.js";
import { josa } from "../josa.js";

/**
 * 돌리기 / 당기기 / 누르기 / 열기 <대상>
 * 가방 아이템 없이 오브젝트 자체를 조작한다. 오브젝트의 `onInteract` 훅(객체 또는 배열)을 실행한다.
 * 밸브 순서, 레버, 상자 열기 같은 함정·장치용.
 */
export default function interact(ctx) {
  if (!ctx.target) return [ctx.error("무엇을 조작할까요? 예: 돌리기 밸브")];
  const obj = ctx.findObject(ctx.target);
  if (!obj) return [ctx.notFound(ctx.target)];

  const hook = pickHook(obj.onInteract, ctx.state);
  if (!hook) {
    return [ctx.error(obj.interactFail ?? `${josa(obj.names[0], "은/는")} 조작해도 아무 일도 일어나지 않는다.`)];
  }
  return runHook(hook, ctx.state);
}
