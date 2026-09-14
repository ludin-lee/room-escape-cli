/**
 * 조건 평가. 조건이 없으면(undefined) 항상 true.
 * 지원: hasItem, flag, notFlag, solved, notSolved, inRoom, all, any
 */
export function evaluate(cond, state) {
  if (cond == null) return true;
  if (Array.isArray(cond)) return cond.every((c) => evaluate(c, state));

  const keys = Object.keys(cond);
  if (keys.length === 0) return true;
  // 여러 키가 한 객체에 있으면 AND
  return keys.every((key) => {
    const v = cond[key];
    switch (key) {
      case "hasItem": return state.inventory.includes(v);
      case "flag": return state.flags.includes(v);
      case "notFlag": return !state.flags.includes(v);
      case "solved": return state.solvedLocks.includes(v);
      case "notSolved": return !state.solvedLocks.includes(v);
      case "inRoom": return state.room === v;
      case "all": return v.every((c) => evaluate(c, state));
      case "any": return v.some((c) => evaluate(c, state));
      default: throw new Error(`알 수 없는 조건: ${key}`);
    }
  });
}
