import { ALIASES } from "../parser.js";
import { displayWidth, padEndWidth } from "../width.js";

/** verb 별 형식과 설명. 별칭은 parser.ALIASES 에서 가져오므로 새 별칭을 추가하면 도움말에 자동 반영된다. */
const USAGE = {
  look: ["", "현재 방을 둘러본다"],
  examine: ["<대상>", "대상을 자세히 살펴본다"],
  take: ["<대상>", "대상을 가방에 넣는다"],
  use: ["<아이템> [대상]", "아이템을 대상에 사용한다"],
  enter: ["<코드> [대상]", "자물쇠에 코드를 입력한다"],
  go: ["<출구>", "다른 방으로 이동한다"],
  interact: ["<대상>", "장치를 직접 조작한다 (밸브, 레버, 상자, 버튼)"],
  combine: ["<아이템> <아이템>", "가방의 두 물건을 합쳐 새 물건을 만든다"],
  inventory: ["", "가지고 있는 물건을 본다"],
  hint: ["", "힌트를 본다 (시간 패널티)"],
  help: ["", "이 도움말"],
  save: ["[슬롯]", "진행 상황을 저장한다"],
  load: ["[슬롯]", "저장한 진행 상황을 불러온다"],
  quit: ["", "게임을 종료한다 (자동 저장됨)"],
};

const isKorean = (s) => /[가-힣]/.test(s);

function buildLines() {
  const rows = Object.entries(USAGE).map(([verb, [args, desc]]) => {
    const aliases = ALIASES[verb] ?? [verb];
    const ko = aliases.filter(isKorean);
    const en = aliases.filter((a) => !isKorean(a));
    const head = `${ko.join("/")}${args ? " " + args : ""}`;
    return { head, desc, en: en.join(", ") };
  });
  const width = Math.max(...rows.map((r) => displayWidth(r.head))) + 3;
  return [
    "명령어:",
    ...rows.map((r) => `  ${padEndWidth(r.head, width)}${r.desc}  (${r.en})`),
    "예: 조사 책상 / 사용 열쇠 문 / 입력 731 금고 / 누르기 버튼 / 조합 방망이 못",
  ];
}

const LINES = buildLines();

export default function help() {
  return [{ type: "system", body: LINES.join("\n") }];
}
