import { josa } from "../josa.js";

export default function go(ctx) {
  const room = ctx.currentRoom();
  if (!ctx.target) {
    const names = room.exits.map((e) => e.names[0]);
    if (names.length === 0) return [ctx.error("여기에는 나갈 곳이 없다.")];
    return [ctx.error(`어디로 갈까요? (${names.join(", ")})`)];
  }
  const exit = ctx.findExit(ctx.target);
  if (!exit) return [ctx.error(`'${ctx.target}' 쪽으로는 갈 수 없다.`)];

  if (exit.lockedBy && !ctx.state.solvedLocks.includes(exit.lockedBy)) {
    return [ctx.error(exit.lockedMessage ?? "잠겨 있다.")];
  }
  ctx.state.room = exit.to;
  return [{ type: "system", body: `${josa(ctx.currentRoom().name, "으로/로")} 이동했다.` }, ...ctx.describeRoom()];
}
