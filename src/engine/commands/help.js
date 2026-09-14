const LINES = [
  "명령어:",
  "  보기            현재 방을 둘러본다",
  "  조사 <대상>     대상을 자세히 살펴본다",
  "  줍기 <대상>     대상을 가방에 넣는다",
  "  사용 <아이템> <대상>   아이템을 대상에 사용한다",
  "  입력 <코드> [대상]     자물쇠에 코드를 입력한다",
  "  이동 <출구>     다른 방으로 이동한다",
  "  가방            가지고 있는 물건을 본다",
  "  힌트            힌트를 본다 (시간 패널티)",
  "  저장 [슬롯] / 불러오기 [슬롯]",
  "  종료",
  "영어 명령도 됩니다: look, examine, take, use, enter, go, inventory, hint",
];

export default function help() {
  return [{ type: "system", body: LINES.join("\n") }];
}
