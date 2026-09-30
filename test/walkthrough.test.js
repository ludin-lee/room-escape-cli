import { test } from "node:test";
import assert from "node:assert/strict";
import { Game } from "../src/engine/game.js";
import { loadScenario } from "../src/content/loader.js";
import { fakeClock } from "./helpers.js";

const WALKTHROUGHS = {
  "old-study": [
    "조사 책상", "줍기 일기장", "조사 일기장",
    "조사 그림", "입력 731 금고", "줍기 놋쇠열쇠", "사용 놋쇠열쇠 문",
    "이동 복도",
    "조사 시계", "입력 315 오르골", "줍기 쪽지", "조사 쪽지", "줍기 등불",
    "이동 지하실", "사용 등불", "입력 513 궤짝", "줍기 철열쇠",
    "이동 복도", "사용 철열쇠 철문", "이동 정원",
  ],
  "midnight-ward": [
    "조사 침대", "줍기 팔찌", "조사 팔찌", "입력 0427 사물함", "줍기 손전등", "조사 차트",
    "이동 복도", "사용 손전등", "줍기 카드키", "사용 카드키 약제실문",
    "이동 약제실", "입력 327 약장", "줍기 계단열쇠",
    "이동 복도", "사용 계단열쇠 비상문", "이동 비상계단",
  ],
  "observatory": [
    "조사 망원경", "조사 성도", "입력 1203 문", "조사 받침대", "줍기 육각렌치", "조사 행성모형",
    "이동 복도", "조사 초상화", "조사 게시판",
    "이동 기록실", "조사 관측일지", "입력 545 상자", "줍기 퓨즈",
    "줍기 사다리", "사용 사다리 서가", "조사 항성목록", "줍기 소장실열쇠",
    "이동 복도", "이동 기계실", "사용 퓨즈 배전반",
    "이동 복도", "사용 소장실열쇠 소장실문", "이동 소장실",
    "조사 책상", "조사 근무카드", "조사 달력", "입력 3257 금고", "줍기 필름",
    "이동 복도", "입력 1112 암실문", "이동 암실", "사용 필름 인화기", "줍기 사진", "조사 사진",
    "이동 복도", "입력 1583 제어판", "이동 승강기",
  ],
  "jigsaw": [
    "조사 녹음기", "조사 거울", "줍기 철사", "사용 철사 욕조", "줍기 족쇄열쇠", "사용 족쇄열쇠 족쇄",
    "조사 벽시계", "조사 벽글씨", "조사 변기", "줍기 봉투", "조사 봉투", "입력 1050 문", "이동 복도",
    "조사 인형", "조사 게시판", "조사 갈고리",
    "이동 작업장", "조사 칠판", "입력 410 공구함", "줍기 토치", "줍기 쐐기", "이동 복도",
    "사용 쐐기 냉동창고문", "이동 냉동창고", "열기 23번상자", "사용 토치 얼음덩이", "줍기 서랍열쇠", "이동 복도",
    "입력 1912 사무실문", "이동 사무실", "조사 서류철", "조사 책상", "사용 서랍열쇠 책상",
    "조사 도면", "조사 매뉴얼", "조사 녹음기", "입력 1107 금고", "줍기 출구열쇠", "이동 복도",
    "이동 작업장", "이동 왼쪽문", "돌리기 배출밸브", "돌리기 급수밸브", "돌리기 증기밸브", "조사 명판", "입력 32 조절기",
    "이동 작업장", "이동 복도", "사용 출구열쇠 철문", "이동 밖",
  ],
  "zombie-street": [
    "조사 계산대", "조사 리모컨", "줍기 건전지", "줍기 라이터", "조사 메모",
    "조사 진열대", "줍기 못", "줍기 손전등", "줍기 야구방망이", "줍기 빈병", "줍기 헝겊",
    "조사 냉장고", "조사 라디오",
    "조합 손전등 건전지", "사용 손전등", "입력 0724 창고문", "이동 창고",
    "줍기 쇠지렛대", "줍기 호스", "줍기 무전기", "이동 편의점",
    "사용 쇠지렛대 뒷문", "이동 뒷골목",
    "조합 야구방망이 못", "사용 못박힌방망이 좀비",
    "조사 쓰레기통", "줍기 옷걸이", "조합 무전기 옷걸이",
    "사용 호스 자동차", "조합 휘발유병 헝겊",
    "이동 약국", "사용 쇠지렛대 캐비닛", "줍기 소독약", "줍기 붕대", "조합 소독약 붕대", "사용 응급키트 생존자", "줍기 옥상열쇠",
    "이동 뒷골목", "이동 주유소", "조사 가격표", "입력 687 구급함", "줍기 조명탄",
    "사용 화염병 좀비떼", "사용 옥상열쇠 옥상문", "이동 옥상",
    "사용 무전기", "사용 조명탄",
  ],
  "no-paper": [
    "조사 주머니", "줍기 동전", "줍기 휴대폰", "조사 낙서", "누르기 휴대폰", "줍기 젖은휴지",
    "사용 동전 칸막이문", "이동 세면대",
    "입력 0315 청소도구함", "줍기 고무장갑", "줍기 관리열쇠", "사용 관리열쇠 디스펜서", "줍기 종이타월",
    "사용 젖은휴지 핸드드라이어", "조합 마른휴지 종이타월",
    "이동 칸", "사용 완벽한휴지", "이동 세면대", "누르기 비누", "이동 복도",
  ],
  "after-school": [
    "조사 칠판", "조사 교탁", "줍기 쪽지", "조사 쪽지", "입력 314 사물함", "줍기 교실열쇠", "사용 교실열쇠 문",
    "이동 복도", "조사 게시판", "조사 명판", "입력 1987 키패드", "이동 운동장",
  ],
  "magic-theater": [
    "조사 포스터", "조사 거울", "입력 488 화장대", "줍기 소품실열쇠",
    "이동 무대뒤", "당기기 밧줄", "사용 소품실열쇠 소품실문", "이동 소품실",
    "조사 카드", "조사 규칙", "입력 9642 마술상자", "줍기 태엽열쇠",
    "이동 무대뒤", "이동 무대", "사용 태엽열쇠 자동인형", "줍기 티켓", "입력 5863 로비문",
    "이동 로비", "사용 티켓 매표소", "줍기 정문열쇠", "사용 정문열쇠 정문문", "이동 거리",
  ],
  "deep-station": [
    "조사 명찰", "조사 날짜표시", "조사 일지", "조사 모스표", "입력 0717 침실문",
    "이동 통로", "조사 수심계", "이동 실험실", "조사 주기율표", "입력 816 약품장", "줍기 뜰채", "사용 뜰채 수조", "줍기 청색카드",
    "이동 통로", "사용 청색카드 통제실문", "이동 통제실", "조사 비상함", "줍기 지렛대", "조사 무전기", "입력 2739 서랍", "줍기 시동키",
    "이동 통로", "사용 지렛대 기관실문", "이동 기관실", "조사 게이지", "조사 안내판", "입력 464 압력제어판",
    "이동 통로", "이동 통제실", "조사 모니터",
    "이동 통로", "입력 0312 격납고해치", "이동 격납고", "사용 시동키 잠수정해치", "이동 잠수정",
  ],
  "elevator-444": [
    "조사 달력", "조사 냉장고", "조사 계약서", "이동 지우방", "입력 1104 서랍", "줍기 일기장", "조사 일기장", "이동 거실",
    "이동 복도", "이동 계단", "조사 안내판", "입력 1903 우편함", "줍기 경비실열쇠", "사용 경비실열쇠 경비실문",
    "이동 경비실", "조사 명부", "줍기 부적", "조사 열쇠걸이", "줍기 전기실열쇠", "이동 로비",
    "사용 전기실열쇠 전기실문", "이동 전기실", "조사 도면", "누르기 차단기D", "이동 로비", "이동 엘리베이터",
    "누르기 4층", "누르기 2층", "누르기 6층", "누르기 2층", "누르기 10층", "누르기 7층", "누르기 1층",
    "조사 소화전", "줍기 사진", "입력 1998 우편함", "줍기 편지", "이동 계단", "조사 계단밑", "줍기 신발", "이동 아래",
    "입력 0404 4404호문", "이동 4404호", "열기 옷장", "줍기 인형",
    "사용 사진 제사상", "사용 인형 제사상", "사용 신발 제사상", "입력 김하은 위패", "사용 편지 아이",
    "이동 복도", "이동 엘리베이터", "누르기 1층",
  ],
  "loop-train": [
    "조사 승차권", "조사 노인", "이동 식당칸", "조사 게시판", "이동 화물칸", "입력 1210 두꺼비집",
    "이동 식당칸", "이동 객실", "당기기 비상제동",
    "조사 노인", "이동 식당칸", "입력 0917 주방문", "이동 주방", "조사 근무표", "조사 서랍", "줍기 밸브핸들",
    "이동 식당칸", "이동 화물칸", "입력 2058 기관실문", "이동 기관실", "조사 달력", "조사 기관사",
    "이동 화물칸", "이동 식당칸", "이동 객실", "당기기 비상제동",
    "조사 노인", "이동 식당칸", "이동 주방", "조사 서랍", "줍기 밸브핸들", "이동 식당칸", "이동 화물칸",
    "조작 두꺼비집", "사용 밸브핸들 유압밸브", "이동 기관실", "입력 0302 브레이크", "당기기 브레이크",
  ],
  "abduction": [
    "조사 밧줄", "조작 의자", "조사 바닥", "줍기 유리조각", "사용 유리조각 밧줄", "조사 창문",
    "입력 4012 서랍", "줍기 드라이버", "줍기 메모", "조사 메모", "조사 캐비닛", "조사 명찰", "조사 쓰레기통", "조사 주민등록증",
    "사용 드라이버 환풍구", "조작 환풍구",
    "조사 목록판", "조사 컨테이너2", "입력 5618 컨테이너2", "줍기 볼트커터",
    "이동 기계실", "조작 배전반", "이동 창고", "이동 휴게실",
    "조사 무전기", "입력 200473 노트북", "조사 노트북", "입력 910723 금고", "줍기 USB", "줍기 트럭키",
    "조사 휴대폰", "조작 김기자",
    "이동 창고", "이동 야적장", "사용 볼트커터 정문", "조작 트럭",
  ],
  "derelict-ship": [
    "조작 녹음기", "입력 362 격실문", "이동 복도", "이동 의무실", "조작 로그2", "조사 시트", "줍기 카드키",
    "이동 복도", "이동 숙소", "조작 녹음기", "이동 복도", "조작 전력패널", "입력 4728 격벽A", "조작 전력패널",
    "이동 브릿지", "조작 로그3", "입력 479 선장콘솔", "줍기 코어키", "이동 복도", "사용 카드키 격벽B", "이동 기관실",
    "사용 코어키 오버라이드", "당기기 오버라이드", "입력 1842 에어락콘솔", "이동 구명정",
  ],
  "cursed-study": [
    "조사 책상", "줍기 손전등", "사용 손전등 고지도", "사용 손전등 책장", "당기기 VERITAS", "사용 손전등 일기장", "조사 선반",
    "줍기 돌", "줍기 해골", "줍기 금화", "사용 돌 저울", "사용 해골 저울", "사용 금화 저울", "조작 쇠문",
    "입력 1473 석관", "줍기 구슬", "조사 구슬", "이동 위", "이동 서재", "입력 3741 유물상자", "줍기 부적",
    "사용 부적 마법진",
  ],
  "museum-heist": [
    "조사 배낭", "줍기 레이저포인터", "조작 격자", "조사 도면", "이동 복도", "조사 도록", "조사 초상화A",
    "조사 초상화B", "조사 초상화C", "이동 경비실", "조사 순찰일지", "입력 417 라커", "줍기 경비복", "이동 복도",
    "입력 742 VIP문", "이동 VIP전시관", "돌리기 거울A", "돌리기 거울C", "사용 레이저포인터 센서", "줍기 명화", "조합 경비복 명화",
    "이동 복도", "이동 로비", "이동 정문",
  ],
  "teahouse": [
    "조사 할머니", "조작 턴테이블", "조사 다이어리", "조사 아이", "줍기 사진반쪽B", "조작 찻잔", "입력 1351 서랍",
    "줍기 사진반쪽A", "조작 오르골", "조사 편지", "조사 신문", "조작 찻잔", "입력 올림픽 나무상자", "조합 사진반쪽A 사진반쪽B",
    "사용 사진 할머니",
  ],
};

test("모든 시나리오에 walkthrough 가 있다", async () => {
  const { listScenarios } = await import("../src/content/loader.js");
  const ids = (await listScenarios()).map((s) => s.id).sort();
  assert.deepEqual(ids, Object.keys(WALKTHROUGHS).sort());
});

for (const [id, commands] of Object.entries(WALKTHROUGHS)) {
  test(`walkthrough: ${id}`, async () => {
    const scenario = await loadScenario(id);
    const game = new Game(scenario, { now: fakeClock() });
    game.start();
    for (const cmd of commands) {
      const msgs = game.run(cmd);
      const errors = msgs.filter((m) => m.type === "error");
      assert.deepEqual(errors, [], `'${cmd}' 에서 에러: ${JSON.stringify(errors)}`);
      if (game.status !== "playing") break;
    }
    assert.equal(game.status, "won");
  });
}

test("잘못된 코드 / 잠긴 문 / 없는 대상", async () => {
  const scenario = await loadScenario("old-study");
  const game = new Game(scenario, { now: fakeClock() });
  assert.equal(game.run("이동 복도")[0].type, "error");
  assert.equal(game.run("조사 금고")[0].type, "error"); // 아직 hidden
  game.run("조사 그림");
  assert.equal(game.run("입력 000 금고")[0].type, "error");
  assert.equal(game.run("입력 000")[0].type, "error");
  assert.equal(game.run("사용 등불 문")[0].type, "error"); // 가방에 없음
  assert.equal(game.run("춤추기")[0].type, "error");
  assert.deepEqual(game.run(""), []);
});

test("힌트 순서와 패널티, 타이머", async () => {
  const scenario = await loadScenario("old-study");
  const now = fakeClock();
  const game = new Game(scenario, { now });
  assert.equal(game.remainingMs(), 1800_000);

  const h1 = game.run("힌트");
  assert.match(h1[0].body, /책상/);
  assert.equal(game.state.hintsUsed, 1);
  assert.equal(game.remainingMs(), 1800_000 - 120_000);

  assert.match(game.run("힌트")[0].body, /일기장/); // 같은 상태에서 다시 물으면 다음 힌트
  assert.match(game.run("힌트")[0].body, /그림/);
  game.run("조사 책상");
  assert.match(game.run("힌트")[0].body, /생일|금고/); // 이미 본 건 건너뛴다

  now.advance(1800_000);
  const msgs = game.run("보기");
  assert.equal(game.status, "lost");
  assert.equal(msgs.at(-1).type, "ending");
  assert.deepEqual(game.run("보기"), [{ type: "system", body: "게임이 끝났습니다." }]);
});

test("저장/불러오기 라운드트립 (시간 누적 유지)", async () => {
  const scenario = await loadScenario("old-study");
  const now = fakeClock();
  const game = new Game(scenario, { now });
  game.run("조사 책상"); game.run("줍기 일기장");
  now.advance(60_000);

  const snap = JSON.parse(JSON.stringify(game.toJSON()));
  assert.equal(snap.elapsedMs, 60_000);
  assert.deepEqual(snap.inventory, ["diary"]);

  const now2 = fakeClock(5_000_000);
  const g2 = Game.fromJSON(scenario, snap, { now: now2 });
  assert.equal(g2.remainingMs(), 1800_000 - 60_000);
  now2.advance(30_000);
  assert.equal(g2.remainingMs(), 1800_000 - 90_000);
  assert.ok(g2.visibleObjects().every((o) => o.id !== "diary")); // 가방에 있으니 방에서 안 보임
  assert.throws(() => Game.fromJSON({ id: "other" }, snap), /시나리오/);
});

test("key 자물쇠: 소모 및 잘못된 아이템", async () => {
  const scenario = await loadScenario("old-study");
  const game = new Game(scenario, { now: fakeClock() });
  for (const c of ["조사 책상", "줍기 일기장", "조사 그림", "입력 7-3-1", "줍기 놋쇠열쇠"]) game.run(c);
  assert.equal(game.run("사용 일기장 문")[0].type, "error");
  assert.equal(game.run("사용 놋쇠열쇠 문")[0].type, "text");
  assert.ok(!game.state.inventory.includes("brass_key"));
  assert.deepEqual(game.state.solvedLocks, ["safe_lock", "study_door_lock"]);
  assert.equal(game.run("이동 hallway")[0].type, "system");
});

test("observatory: 전원 없이는 승강기 패널이 안 보이고 필름 인화도 안 된다", async () => {
  const scenario = await loadScenario("observatory");
  const game = new Game(scenario, { now: fakeClock() });
  for (const c of ["입력 1203 문", "이동 복도"]) game.run(c);
  assert.equal(game.run("입력 1583 제어판")[0].type, "error"); // 패널은 아직 hidden
  assert.equal(game.run("이동 승강기")[0].type, "error");

  // 렌치 없이 퓨즈만으로는 배전반을 열 수 없다
  for (const c of ["이동 기록실", "입력 545 상자", "줍기 퓨즈", "이동 복도", "이동 기계실"]) game.run(c);
  const noWrench = game.run("사용 퓨즈 배전반");
  assert.equal(noWrench[0].type, "error");
  assert.ok(game.state.inventory.includes("fuse"));
  assert.ok(!game.state.flags.includes("power_on"));

  // 녹슨 열쇠는 어디에도 맞지 않는다
  for (const c of ["조사 공구함", "줍기 녹슨열쇠", "이동 복도"]) game.run(c);
  assert.equal(game.run("사용 녹슨열쇠 소장실문")[0].type, "error");
});

test("deep-station: 압력 복구 전 모니터는 코드를 숨기고, 수조에 맨손을 넣으면 게임 오버", async () => {
  const scenario = await loadScenario("deep-station");
  const game = new Game(scenario, { now: fakeClock() });
  for (const c of [
    "입력 0717 침실문", "이동 통로", "이동 실험실", "입력 816 약품장", "줍기 뜰채", "사용 뜰채 수조", "줍기 청색카드",
    "이동 통로", "사용 청색카드 통제실문", "이동 통제실",
  ]) game.run(c);
  const before = game.run("조사 모니터");
  assert.ok(!game.state.flags.includes("monitor_code_seen"));
  assert.ok(!before.some((m) => /수심/.test(m.body)));
  assert.ok(game.state.inventory.includes("blue_card")); // 카드는 소모되지 않는다

  // 압력 오답은 60초 패널티
  for (const c of ["조사 비상함", "줍기 지렛대", "이동 통로", "사용 지렛대 기관실문", "이동 기관실"]) game.run(c);
  const penaltyBefore = game.state.penaltyMs;
  game.run("입력 000 압력제어판");
  assert.equal(game.state.penaltyMs - penaltyBefore, 60_000);

  // 뜰채 없이 수조를 조작하면 감전
  const g2 = new Game(scenario, { now: fakeClock() });
  for (const c of ["입력 0717 침실문", "이동 통로", "이동 실험실"]) g2.run(c);
  assert.equal(g2.run("줍기 청색카드")[0].type, "error"); // 아직 hidden
  g2.run("조작 수조");
  assert.equal(g2.status, "lost");
  assert.equal(g2.state.lostBy, "trap");
});

test("elevator-444: 전원·부적·순서·함정·달래기 게이트", async () => {
  const scenario = await loadScenario("elevator-444");
  const RITUAL = ["누르기 4", "누르기 2", "누르기 6", "누르기 2", "누르기 10", "누르기 7"];
  const PREP = ["이동 복도", "이동 계단", "입력 1903 우편함", "줍기 경비실열쇠", "사용 경비실열쇠 경비실문", "이동 경비실",
    "조사 열쇠걸이", "줍기 전기실열쇠", "이동 로비", "사용 전기실열쇠 전기실문", "이동 전기실"];

  const game = new Game(scenario, { now: fakeClock() });
  for (const c of PREP) game.run(c);
  game.run("누르기 차단기A"); // 오답 차단기 → 1분
  assert.equal(game.state.penaltyMs, 60_000);
  game.run("이동 로비"); game.run("이동 엘리베이터");
  game.run("누르기 4"); // 전원 없음
  assert.ok(!game.state.flags.includes("seq1"));
  for (const c of ["이동 로비", "이동 전기실", "누르기 차단기D", "이동 로비", "이동 엘리베이터", "누르기 4", "누르기 2", "누르기 5"]) game.run(c);
  assert.ok(!game.state.flags.includes("seq1")); // 5층은 리셋
  for (const c of RITUAL) game.run(c);
  game.run("누르기 1"); // 부적 없음 → 못 감
  assert.equal(game.state.room, "elevator");
  assert.equal(game.state.penaltyMs, 180_000);
  for (const c of RITUAL) game.run(c);
  game.run("조사 여자");
  assert.equal(game.state.lostBy, "trap");

  const g2 = new Game(scenario, { now: fakeClock() });
  for (const c of [...PREP, "누르기 차단기D", "이동 로비", "이동 경비실", "줍기 부적", "이동 로비", "이동 엘리베이터", ...RITUAL, "누르기 1"]) g2.run(c);
  assert.equal(g2.state.room, "corridor444");
  g2.run("이동 계단"); g2.run("이동 위");
  assert.equal(g2.state.room, "stairwell444"); // 무한 계단
  for (const c of ["이동 아래", "입력 0404 4404호문", "이동 4404호"]) g2.run(c);
  assert.equal(g2.run("입력 하은 위패")[0].type, "error"); // 상 먼저
  g2.run("열기 옷장");
  assert.ok(g2.visibleObjects().some((o) => o.id === "doll"));
  for (const c of ["줍기 인형", "사용 인형 제사상", "이동 복도", "조사 소화전", "줍기 사진", "이동 계단", "조사 계단밑", "줍기 신발", "이동 아래", "이동 4404호", "사용 사진 제사상", "사용 신발 제사상", "입력 하은 위패"]) g2.run(c);
  assert.ok(g2.visibleObjects().some((o) => o.id === "child"));
  g2.run("이동 복도"); g2.run("이동 엘리베이터");
  g2.run("누르기 1"); // 편지 안 줌
  assert.equal(g2.state.room, "elevator444");
});

test("힌트 코드: 코드별 힌트를 순서대로, 없는 코드는 에러", async () => {
  const scenario = await loadScenario("elevator-444");
  const game = new Game(scenario, { now: fakeClock() });
  assert.match(game.run("힌트 e1")[0].body, /달력/);
  assert.match(game.run("힌트 E1")[0].body, /생일/);
  assert.match(game.run("힌트 E4")[0].body, /전기실/);
  assert.equal(game.run("힌트 X9")[0].type, "error");
  assert.ok(game.run("조사 달력").some((m) => /힌트 코드/.test(m.body)) === false); // 달력엔 코드 없음
  assert.ok(game.run("이동 지우방").some((m) => /힌트 코드 E1/.test(m.body)));
  assert.ok(game.run("조사 서랍").some((m) => /힌트 코드 E1/.test(m.body)));
});

test("loop-train: 루프는 아이템·장치를 초기화하고 지식은 남기며, 5번째 죽음은 게임 오버", async () => {
  const scenario = await loadScenario("loop-train");
  const game = new Game(scenario, { now: fakeClock() });
  game.run("당기기 비상제동");
  for (const c of ["조사 노인", "이동 식당칸", "입력 0917 주방문", "이동 주방", "조사 서랍", "줍기 밸브핸들", "이동 식당칸", "이동 화물칸"]) game.run(c);
  assert.ok(game.state.inventory.includes("valve_handle"));
  assert.match(game.run("사용 밸브핸들 두꺼비집")[0].body, /잠겨|번호/); // 조작 훅으로 넘어간다
  game.run("사용 밸브핸들 유압밸브"); // 전원 차단 전 → 증기 → 루프 (돌리기와 동일)
  assert.equal(game.status, "playing");
  assert.equal(game.state.room, "car1");
  assert.ok(game.state.flags.includes("loop2"));
  assert.ok(!game.state.inventory.includes("valve_handle"));
  assert.ok(game.state.solvedLocks.includes("kitchen_lock")); // 연 문은 기억
  game.run("이동 식당칸"); game.run("이동 주방");
  assert.ok(!game.visibleObjects().some((o) => o.id === "valve_handle")); // 서랍은 다시 닫힘
  for (const c of ["이동 식당칸", "이동 객실", "당기기 비상제동", "당기기 비상제동"]) game.run(c);
  assert.ok(game.state.flags.includes("loop4"));
  assert.equal(game.status, "playing");
  game.run("당기기 비상제동");
  assert.equal(game.status, "lost");
  assert.equal(game.state.lostBy, "trap");
});


test("abduction: 묶인 동안은 좁은 범위, 112 와 검문은 게임 오버", async () => {
  const scenario = await loadScenario("abduction");
  const game = new Game(scenario, { now: fakeClock() });
  assert.equal(game.run("조사 책상")[0].type, "error"); // 묶인 채로는 안 보임
  assert.equal(game.run("줍기 유리조각")[0].type, "error"); // 넘어지기 전
  game.run("조사 바닥");
  assert.ok(!game.visibleObjects().some((o) => o.id === "glass"));
  for (const c of ["조작 의자", "조사 바닥", "줍기 유리조각", "사용 유리조각 밧줄"]) game.run(c);
  assert.ok(game.state.flags.includes("hands_free"));
  assert.ok(game.visibleObjects().some((o) => o.id === "desk"));

  const toLounge = ["입력 4012 서랍", "줍기 드라이버", "사용 드라이버 환풍구", "조작 환풍구"];
  for (const c of toLounge) game.run(c);
  assert.equal(game.state.room, "hall");
  game.run("이동 휴게실"); // 사이렌 전
  assert.equal(game.state.lostBy, "trap");

  const g2 = new Game(scenario, { now: fakeClock() });
  for (const c of ["조작 의자", "조사 바닥", "줍기 유리조각", "사용 유리조각 밧줄", ...toLounge, "이동 기계실", "조작 배전반", "이동 창고", "이동 휴게실", "조사 휴대폰"]) g2.run(c);
  assert.equal(g2.status, "playing");
  g2.run("조작 112");
  assert.equal(g2.state.lostBy, "trap");
});

test("네 에피소드의 함정: AI 코어 입력, 거울B, 비상구, 위장 없이 정문", async () => {
  let s = await loadScenario("derelict-ship");
  let g = new Game(s, { now: fakeClock() });
  for (const c of ["조작 녹음기", "입력 362 격실문", "이동 복도", "조작 전력패널", "이동 의무실"]) g.run(c);
  assert.equal(g.state.penaltyMs, 45_000); // 문 제어 상태로 이동 → 산소 패널티
  for (const c of ["이동 복도", "입력 4728 격벽A", "이동 브릿지"]) g.run(c);
  g.run("입력 0000 코어단말");
  assert.equal(g.state.lostBy, "trap");

  s = await loadScenario("museum-heist");
  g = new Game(s, { now: fakeClock() });
  for (const c of ["조작 격자", "이동 복도", "입력 742 VIP문", "이동 VIP전시관"]) g.run(c);
  assert.equal(g.run("사용 레이저포인터 센서")[0].type, "error"); // 가방에 없음
  g.run("돌리기 거울B");
  assert.equal(g.state.lostBy, "trap");
  g = new Game(s, { now: fakeClock() });
  for (const c of ["조작 격자", "이동 복도", "이동 로비", "이동 정문"]) g.run(c);
  assert.equal(g.state.lostBy, "trap"); // 위장 없이 정문
  g = new Game(s, { now: fakeClock() });
  for (const c of ["조작 격자", "이동 복도", "이동 로비", "이동 비상구"]) g.run(c);
  assert.equal(g.state.lostBy, "trap");

  s = await loadScenario("cursed-study");
  g = new Game(s, { now: fakeClock() });
  for (const c of ["조사 책상", "줍기 손전등", "사용 손전등 책장", "당기기 VERITAS", "조사 선반", "줍기 해골"]) g.run(c);
  assert.equal(g.run("사용 해골 저울")[0].type, "error"); // 순서 위반은 거부
  assert.ok(g.state.inventory.includes("skull"));
});
