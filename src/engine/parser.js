export const ALIASES = {
  look: ["look", "보기", "둘러보기", "l"],
  examine: ["examine", "조사", "살펴보기", "x"],
  take: ["take", "줍기", "획득", "get"],
  use: ["use", "사용"],
  enter: ["enter", "입력", "코드"],
  go: ["go", "이동", "가기"],
  interact: ["interact", "돌리기", "당기기", "누르기", "열기", "조작", "turn", "pull", "push", "open"],
  combine: ["combine", "조합", "합치기", "결합", "만들기", "craft"],
  inventory: ["inventory", "가방", "인벤", "i"],
  hint: ["hint", "힌트", "h"],
  help: ["help", "도움말", "?"],
  // UI 명령 (엔진은 처리하지 않지만 파서는 인식한다)
  save: ["save", "저장"],
  load: ["load", "불러오기"],
  quit: ["quit", "종료", "q", "exit"],
};

const VERB_OF = new Map();
for (const [verb, list] of Object.entries(ALIASES)) {
  for (const a of list) VERB_OF.set(a.toLowerCase(), verb);
}

const CONNECTORS = new Set(["on", "to", "with", "at", "in", "에", "으로", "로", "에다", "에다가"]);
const PARTICLES = ["에서", "으로", "이랑", "을", "를", "이", "가", "에", "로", "와", "과", "랑"];

/**
 * @returns {{ verb: string|null, target: string|null, secondary: string|null, args: string[] }}
 */
export function parse(input) {
  const tokens = input.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return { verb: null, target: null, secondary: null, args: [] };

  let verb = null;
  let rest = tokens;
  const first = VERB_OF.get(tokens[0].toLowerCase());
  const last = VERB_OF.get(tokens[tokens.length - 1].toLowerCase());
  if (first) {
    verb = first; rest = tokens.slice(1);
  } else if (last) {
    verb = last; rest = tokens.slice(0, -1);
  }

  const args = rest.filter((t) => !CONNECTORS.has(t.toLowerCase()));
  return { verb, target: args[0] ?? null, secondary: args[1] ?? null, args };
}

/**
 * 후보 목록에서 토큰과 이름이 맞는 항목을 찾는다.
 * 원문 매칭 → 실패 시 조사 제거 후 재시도.
 * @param {string} token
 * @param {{ id: string, names: string[] }[]} candidates
 */
export function matchName(token, candidates) {
  if (!token) return null;
  const tryMatch = (t) => candidates.find((c) => c.names.some((n) => n.toLowerCase() === t)) ?? null;
  const lower = token.toLowerCase();
  const exact = tryMatch(lower);
  if (exact) return exact;
  for (const p of PARTICLES) {
    if (lower.length > p.length && lower.endsWith(p)) {
      const hit = tryMatch(lower.slice(0, -p.length));
      if (hit) return hit;
    }
  }
  return null;
}
