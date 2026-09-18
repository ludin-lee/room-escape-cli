/**
 * @typedef {Object} State
 * @property {string} scenarioId
 * @property {"playing"|"won"|"lost"} status
 * @property {string} room
 * @property {string[]} inventory
 * @property {string[]} flags
 * @property {string[]} revealed
 * @property {string[]} hidden
 * @property {string[]} solvedLocks
 * @property {Object<string, number>} attempts   자물쇠별 오답 횟수
 * @property {"timeout"|"trap"} [lostBy]         패배 원인 (status 가 lost 일 때)
 * @property {number} retries      함정 사망 후 재도전 횟수
 * @property {number} hintsUsed
 * @property {number} elapsedMs
 * @property {number} penaltyMs
 * @property {number} startedAt
 */

/**
 * @param {object} scenario
 * @param {number} now
 * @returns {State}
 */
export function createState(scenario, now) {
  return {
    scenarioId: scenario.id,
    status: "playing",
    room: scenario.startRoom,
    inventory: [],
    flags: [],
    revealed: [],
    hidden: [],
    solvedLocks: [],
    attempts: {},
    retries: 0,
    hintsUsed: 0,
    elapsedMs: 0,
    penaltyMs: 0,
    startedAt: now,
  };
}

/** 저장용 스냅샷. 이번 세션 경과를 elapsedMs 에 누적한다. */
export function serialize(state, now) {
  return {
    ...state,
    elapsedMs: state.elapsedMs + (now - state.startedAt),
    startedAt: now,
  };
}

/** 불러오기. startedAt 을 현재 시각으로 리셋한다. */
export function deserialize(snapshot, now) {
  const base = {
    inventory: [], flags: [], revealed: [], hidden: [], solvedLocks: [], attempts: {}, retries: 0,
    hintsUsed: 0, elapsedMs: 0, penaltyMs: 0, status: "playing",
  };
  return { ...base, ...structuredClone(snapshot), startedAt: now };
}
