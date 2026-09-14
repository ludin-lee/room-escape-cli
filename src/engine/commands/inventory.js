export default function inventory(ctx) {
  const items = ctx.state.inventory.map((id) => ctx.scenario.objects[id].names[0]);
  if (items.length === 0) return [{ type: "item", body: "가방은 비어 있다." }];
  return [{ type: "item", body: `가방: ${items.join(", ")}` }];
}
