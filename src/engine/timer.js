/** 남은 시간(ms). 0 이하면 시간 초과. */
export function remainingMs(scenario, state, now) {
  const limit = scenario.timeLimitSec * 1000;
  const used = state.elapsedMs + (now - state.startedAt) + state.penaltyMs;
  return limit - used;
}

/** ms → "MM:SS" */
export function formatMs(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
