function add(arr, v) { if (!arr.includes(v)) arr.push(v); }
function remove(arr, v) { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); }

/**
 * 효과 목록을 상태에 적용하고, 생성된 메시지 배열을 반환한다.
 * 지원: addItem, removeItem, setFlag, clearFlag, reveal, hide, moveTo, message,
 *       addPenalty (초. 남은 시간을 줄이는 함정), gameOver (메시지. 즉시 패배)
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
        case "addPenalty":
          state.penaltyMs += v * 1000;
          messages.push({ type: "system", body: `(남은 시간이 ${formatPenalty(v)} 줄었습니다)` });
          break;
        case "gameOver":
          state.status = "lost";
          state.lostBy = "trap";
          messages.push({ type: "ending", body: v });
          break;
        default: throw new Error(`알 수 없는 효과: ${key}`);
      }
    }
  }
  return messages;
}

function formatPenalty(sec) {
  if (sec % 60 === 0) return `${sec / 60}분`;
  if (sec < 60) return `${sec}초`;
  return `${Math.floor(sec / 60)}분 ${sec % 60}초`;
}
