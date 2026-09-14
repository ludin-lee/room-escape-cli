function add(arr, v) { if (!arr.includes(v)) arr.push(v); }
function remove(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); }

/**
 * 효과 목록을 상태에 적용하고, 생성된 메시지 배열을 반환한다.
 * 지원: addItem, removeItem, setFlag, clearFlag, reveal, hide, moveTo, message
 */
export function apply(effects, state) {
  const messages = [];
  for (const effect of effects ?? []) {
    for (const [key, v] of Object.entries(effect)) {
      switch (key) {
        case "addItem": add(state.inventory, v); break;
        case "removeItem": remove(state.inventory, v); break;
        case "setFlag": add(state.flags, v); break;
        case "clearFlag": remove(state.flags, v); break;
        case "reveal": add(state.revealed, v); remove(state.hidden, v); break;
        case "hide": remove(state.revealed, v); add(state.hidden, v); break;
        case "moveTo": state.room = v; break;
        case "message": messages.push({ type: "text", body: v }); break;
        default: throw new Error(`알 수 없는 효과: ${key}`);
      }
    }
  }
  return messages;
}
