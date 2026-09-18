# CLI 방탈출 (Room Escape) — 설계 문서

## 1. 목표와 범위

- 터미널에서 텍스트 명령으로 진행하는 1인용 방탈출 게임.
- 시나리오(방·오브젝트·퍼즐)는 **데이터(JSON)** 로 정의하고, 엔진은 시나리오를 모름. → 새 방은 코드 수정 없이 JSON만 추가.
- 제한 시간, 힌트, 저장/불러오기 지원.
- 한글 명령 기본 + 영어 별칭 지원 (`조사 책상` = `examine desk`).

## 2. 기술 스택

| 항목 | 선택 | 이유 |
|---|---|---|
| 런타임 | Node.js 24 (ESM, `"type": "module"`) | 이미 설치됨 |
| 언어 | JavaScript + JSDoc 타입 주석 | 빌드 단계 없이 바로 실행. 커지면 TS 전환 가능 |
| 입력 | `node:readline/promises` | 내장 |
| 색상 | `util.styleText` | 내장 (chalk 불필요) |
| 테스트 | `node:test` + `node:assert` | 내장 |
| 외부 의존성 | **0개** | 설치 없이 `node bin/escape.js` 로 실행 |

## 3. 디렉토리 구조

```
room-escape/
├── package.json              # "bin": { "escape": "bin/escape.js" }
├── bin/
│   └── escape.js             # 진입점. 시나리오 선택 → Game 생성 → 루프 시작
├── src/
│   ├── engine/
│   │   ├── game.js           # Game 클래스: 한 턴 처리(run(input) → 출력 메시지들), toJSON / fromJSON
│   │   ├── state.js          # 초기 상태 생성, 직렬화/역직렬화
│   │   ├── parser.js         # 문자열 → { verb, target, secondary }
│   │   ├── conditions.js     # 조건 평가 (hasItem, flag, solved ...)
│   │   ├── effects.js        # 효과 적용 (addItem, setFlag, reveal ...)
│   │   ├── timer.js          # 경과/남은 시간 계산 (누적 시간 + 힌트 패널티 반영)
│   │   ├── josa.js           # 한글 조사 선택 (을/를, 은/는, 으로/로)
│   │   ├── hooks.js          # 훅 선택(pickHook: 배열이면 when 만족하는 첫 항목) + 조건부 설명(describe)
│   │   └── commands/
│   │       ├── index.js      # verb → 핸들러 매핑 + 별칭 테이블
│   │       ├── look.js       # 보기
│   │       ├── examine.js    # 조사 <대상>
│   │       ├── take.js       # 줍기 <대상>
│   │       ├── use.js        # 사용 <아이템> <대상>   (key 타입 자물쇠 풀기)
│   │       ├── enter.js      # 입력 <코드> [대상]   (code 타입 자물쇠 풀기)
│   │       ├── go.js         # 이동 <출구>
│   │       ├── inventory.js  # 가방
│   │       ├── hint.js       # 힌트
│   │       └── help.js       # 도움말
│   ├── ui/
│   │   ├── prompt.js         # readline 루프. 저장/불러오기/종료는 여기서 처리, 나머지는 game.run() 호출
│   │   ├── renderer.js       # 메시지 타입별 색상/포맷 + 서사 메시지 타자 효과 (TTY 에서만, --fast 로 끔)
│   │   ├── status.js         # 상단 고정 상태 박스 (위치·남은 시간·보이는 것·가방). 스크롤 영역 분리, 1초 갱신
│   │   └── screens.js        # 타이틀 화면, 탈출 성공/실패 화면 (ASCII 아트)
│   ├── content/
│   │   ├── loader.js         # 시나리오 JSON 로드 + validate 호출
│   │   ├── validate.js       # 참조 무결성 검사 (존재하지 않는 id, 도달 불가 출구 등)
│   │   └── scenarios/
│   │       ├── old-study/    # "낡은 서재" (30분, 방 4개, 퍼즐 7개)
│   │       │   └── scenario.json
│   │       ├── midnight-ward/ # "자정의 병동" (20분, 방 4개, 퍼즐 5개)
│   │       │   └── scenario.json
│   │       ├── observatory/  # "폐쇄된 천문대" (45분, 방 7개, 퍼즐 9개)
│   │       │   └── scenario.json
│   │       ├── jigsaw/       # "직쏘의 게임" (60분, 방 8개, 퍼즐 14개, 즉사 함정 5종)
│   │       │   └── scenario.json
│   │       ├── zombie-street/ # "죽은 자들의 거리" (45분, 방 7개, 조합 레시피 5개, 함정 3종)
│   │       │   └── scenario.json
│   │       └── no-paper/     # "휴지 없는 화장실" (20분, 방 3개, 코믹. 출구 방 onEnter 로 조건부 엔딩)
│   │           └── scenario.json
│   └── save/
│       └── store.js          # ~/.room-escape/saves/<slot>.json 읽기/쓰기 (UI 전용)
└── test/
    ├── helpers.js            # fakeClock 등 테스트 유틸
    ├── parser.test.js
    ├── effects.test.js
    ├── validate.test.js
    └── walkthrough.test.js   # 정답 명령 시퀀스를 넣으면 반드시 탈출되는지 검증
```

## 4. 핵심 원칙: 엔진과 UI 분리

`Game.run(input)` 은 **문자열을 받아 메시지 배열을 반환**하는 순수 함수에 가깝게 만든다. 콘솔 출력·readline·파일시스템은 `ui/` 만 담당한다. 엔진은 `fs` 를 import 하지 않는다.

```js
// 개념
const game = new Game(scenario, { now: () => Date.now() });
const messages = game.run("조사 책상");
// → [{ type: "text", body: "책상 위에 낡은 일기장이 있다." }, { type: "reveal", id: "diary" }]

// 저장/불러오기는 엔진이 직렬화만 제공하고, 파일 I/O 는 UI 가 한다.
const snapshot = game.toJSON();                 // → 6장의 State 객체
const restored = Game.fromJSON(scenario, snapshot, { now });
```

`저장` / `불러오기` / `종료` 는 게임 명령이 아니라 **UI 명령**이다. `ui/prompt.js` 가 입력을 `game.run()` 에 넘기기 전에 가로채서 `save/store.js` 로 처리한다. 그래서 `engine/commands/` 에는 save·quit 핸들러가 없다.

이렇게 하면 테스트에서 readline 없이 명령 시퀀스를 그대로 돌릴 수 있고, 나중에 웹/디스코드 봇으로 UI만 바꿔 끼울 수 있다.

## 5. 데이터 모델 (시나리오 JSON)

```jsonc
{
  "id": "old-study",
  "title": "낡은 서재",
  "timeLimitSec": 1800,
  "hintPenaltySec": 120,
  "retryPenaltySec": 180,      // (선택) 함정 사망 후 재도전 시 차감. 기본 180
  "startRoom": "study",
  "intro": "눈을 떠보니 먼지 쌓인 서재다. 문은 잠겨 있다...",

  "rooms": {
    "study": {
      "name": "서재",
      "description": "벽면 가득 책장이 있고, 가운데 낡은 책상이 있다.",
      "objects": ["desk", "bookshelf", "door"],
      "exits": [
        { "names": ["복도", "hallway"], "to": "hallway", "lockedBy": "door_lock" }
      ]
    },
    "hallway": {
      "name": "복도",
      "description": "긴 복도 끝에 바깥으로 통하는 문이 보인다.",
      "objects": [],
      "exits": [],
      "isExit": true
    }
  },

  "objects": {
    "desk": {
      "names": ["책상", "desk"],
      "description": "서랍이 하나 있다. 잠겨 있진 않다.",
      "hidden": false,
      "onExamine": { "effects": [{ "reveal": "diary" }] }
    },
    "diary": {
      "names": ["일기장", "diary"],
      "hidden": true,
      "takeable": true,
      "description": "마지막 장에 '7-3-1' 이라고 적혀 있다.",
      "onExamine": { "effects": [{ "setFlag": "diary_seen" }] }
    },
    "door": {
      "names": ["문", "door"],
      "description": "3자리 다이얼 자물쇠가 걸려 있다.",
      "lock": "door_lock"
    }
  },

  "locks": {
    "door_lock": {
      "type": "code",            // code | key
      "answer": "731",
      "onSolve": { "message": "철컥. 자물쇠가 풀렸다!" }
    }
  },

  "hints": [
    { "when": { "notFlag": "diary_seen" },   "text": "책상을 자세히 조사해 보세요." },
    { "when": { "notSolved": "door_lock" },  "text": "일기장 마지막 장을 보세요." }
  ],

  "endings": {
    "success": "당신은 서재를 탈출했다.",
    "timeout": "시간이 다 되었다. 문은 끝내 열리지 않았다."
  }
}
```

### 자물쇠(Lock) 종류

| type | 푸는 방법 | 필수 필드 |
|---|---|---|
| `code` | `입력 <코드> [대상]` | `answer` (문자열, 공백·하이픈 제거 후 비교) |
| `key` | `사용 <아이템> <대상>` | `keyItem` (오브젝트 id). 사용 시 `consume: true` 면 아이템 제거 |

두 타입 공통 선택 필드:

| 필드 | 뜻 |
|---|---|
| `requires` + `requiresMessage` | 이 조건이 참일 때만 자물쇠에 손댈 수 있다 (족쇄를 풀기 전엔 문에 손이 안 닿는다). 막히면 오답으로 세지 않는다 |
| `failMessage` | 오답/맞지 않는 열쇠일 때 에러 메시지 |
| `onFail: { message?, effects? }` | (code) 오답마다 실행. `addPenalty` 로 시간을 깎는 함정에 쓴다 |
| `maxAttempts` + `onMaxAttempts: { message?, effects? }` | (code) 오답 누적이 `maxAttempts` 에 닿으면 실행. `gameOver` 와 조합하면 "세 번 틀리면 죽는" 자물쇠. 남은 횟수는 매 오답 뒤 시스템 메시지로 보여 준다. 오답 횟수는 `state.attempts[lockId]` 에 저장 |

- 자물쇠는 **오브젝트의 `lock` 필드**로만 연결된다. `enter` / `use` 의 대상은 오브젝트이고, 그 오브젝트의 `lock` 을 푼다.
- 풀린 자물쇠는 `state.solvedLocks` 에 기록된다. 이것이 "열렸다"의 **유일한 표현**이다. 별도 flag 나 `unlockExit` 효과는 두지 않는다.
- 출구의 `lockedBy` 는 락 id 를 가리키며, 그 id 가 `solvedLocks` 에 있으면 통과할 수 있다.
- `입력 <코드>` 에서 대상을 생략하면: 현재 방에 보이는 `lock` 달린 오브젝트가 하나면 그것, 둘 이상이면 "어디에 입력할까요?" 로 되묻고, 없으면 에러.

### 조건(Condition) 종류
`hasItem`, `flag`, `notFlag`, `solved`, `notSolved`, `inRoom`, `all: [...]`, `any: [...]`

### 효과(Effect) 종류
`addItem`, `removeItem`, `setFlag`, `clearFlag`, `reveal`, `hide`, `moveTo`, `message`,
`addPenalty: <초>` (남은 시간 차감. 시스템 메시지 자동 출력), `gameOver: "<메시지>"` (즉시 패배. `status = lost`, `lostBy = "trap"`, 메시지는 ending 타입으로 출력)

조건/효과가 데이터로만 표현되므로 **퍼즐 로직에 코드가 들어가지 않는다.**

### 엔딩
- **성공**: 플레이어가 `isExit: true` 인 방에 들어가는 순간. 그 턴의 메시지 끝에 `endings.success` 를 붙이고 `status` 를 `won` 으로 바꾼다.
- **실패 (시간 초과)**: 남은 시간이 0 이하가 된 턴. `endings.timeout` 을 출력하고 `status` 를 `lost`, `lostBy` 를 `timeout` 으로.
- **실패 (함정)**: `gameOver` 효과가 실행된 턴. 효과에 적힌 메시지를 출력하고 `status` 를 `lost`, `lostBy` 를 `trap` 으로. 그 턴에는 성공 판정을 하지 않는다. UI 는 `lostBy` 에 따라 "시간 초과" / "게임 오버" 화면을 고른다.
- **재도전**: `Game.run()` 은 매 턴 시작 시 상태를 체크포인트로 저장한다. 함정 사망 직후(`canRetry()`) `retry()` 를 부르면 체크포인트로 되돌리고, 죽은 뒤 흐른 시간 + `retryPenaltySec` (기본 180) 을 차감하며 `attempts` 를 비우고 `retries` 를 올린다. UI 는 게임 오버 화면 뒤에 `(Y/n)` 로 묻는다. 시간 초과는 재도전 불가.

### 힌트
- `hints` 배열을 위에서부터 훑어 **`when` 을 만족하는 첫 번째** 힌트를 보여준다.
- 만족하는 힌트가 없으면 "더 이상 힌트가 없습니다."
- 힌트를 볼 때마다 `hintPenaltySec` 만큼 남은 시간이 줄어든다 (9장).

### 아이템 사용 훅 (`onUse`)
자물쇠가 아닌 대상에 아이템을 쓰거나 대상 없이 쓸 때 실행된다. `when` 이 거짓이면 `failMessage` 만 출력한다.

```jsonc
"lantern": {
  "onUse": {                       // 대상 없이 `사용 등불`, 또는 target 을 지정
    "target": "darkness",          // (선택) 이 오브젝트에 사용할 때만
    "when": { "inRoom": "cellar" },
    "failMessage": "여기서는 필요 없다.",
    "message": "주위가 밝아진다.",
    "effects": [{ "reveal": "chest" }]
  }
}
```
대상별로 다른 반응이 필요하면 `"onUse": { "<대상 id>": { ... }, "<대상 id>": { ... } }` 형태로 쓴다.

### 훅 배열과 조작 훅 (`onExamine` / `onTake` / `onInteract` / 방 `onEnter`)
이 네 훅은 객체 하나 또는 **배열**을 받는다. 배열이면 위에서부터 `when` 을 만족하는 첫 항목만 실행한다 (`when` 없는 항목은 else 역할). 이걸로 "순서를 지키면 진행, 어기면 함정" 같은 분기를 코드 없이 만든다.

```jsonc
"valve_water": {
  "onInteract": [
    { "when": { "flag": "v_water" }, "message": "이미 열려 있다." },
    { "when": { "flag": "v_drain" }, "message": "물이 차오른다.", "effects": [{ "setFlag": "v_water" }] },
    { "message": "배관이 부풀어 오른다.", "effects": [{ "gameOver": "증기가 얼굴을 덮친다." }] }
  ]
}
```
- `onInteract` 는 `돌리기 / 당기기 / 누르기 / 열기 / 조작 <대상>` (영어 `turn / pull / push / open`) 으로 실행된다. 가방 아이템 없이 장치를 직접 조작할 때 쓴다. 훅이 없으면 `interactFail` 또는 기본 에러.
- 방의 `onEnter` 는 `이동` 으로 들어갈 때마다 실행된다. 한 번만 하려면 `when: { notFlag }` + `setFlag` 로. 함정 방(들어가면 `gameOver`)이나 매번 시간을 깎는 방(냉동창고)에 쓴다.
- 실행 순서: `onInteract` / `onEnter` 는 `message` → `effects` (게임 오버 메시지가 서사 뒤에 오도록). `onExamine` / `onTake` 는 기존대로 `effects` → `message`.

### 아이템 조합 (`recipes`)
`조합 <아이템> <아이템>` 은 가방의 두 아이템으로 시나리오 최상위 `recipes` 에서 레시피를 찾는다. 순서는 상관없다.

```jsonc
"recipes": [
  { "inputs": ["bat", "nails"], "output": "spiked_bat", "message": "못을 박았다." },
  { "inputs": ["flashlight", "battery"], "consume": ["battery"], "effects": [{ "setFlag": "flashlight_powered" }] }
]
```
- `output` (선택): 만들어질 오브젝트 id. 가방에 추가된다. 방에 놓이지 않는 오브젝트여도 된다.
- `consume`: 기본 `true` (재료 둘 다 제거). 배열이면 그 재료만 제거 (손전등에 건전지 넣기처럼 한쪽은 남길 때).
- `when` / `failMessage` / `message` / `effects` 는 다른 훅과 같다. `output` 없이 `effects` 만으로 "상태가 바뀌는 조합"을 표현할 수 있다.
- 결과물의 `names` 는 가방에 들어가므로 takeable 과 같은 규칙으로 모든 방의 이름과 겹치면 안 된다 (validate 가 검사). 재료와 결과물이 별칭을 공유하면 안 된다 ("방망이" 를 야구방망이와 못박힌방망이 둘 다에 주면 에러).
- 파서는 `조합 소독약과 붕대` 처럼 조사(와/과/랑)가 붙어도 처리한다.

### `사용` 의 판정 순서
1. 대상에 key 자물쇠가 있고 아이템이 그 `keyItem` 이면 → 자물쇠 해결
2. 아이템의 `onUse` 에 그 대상 훅이 있으면 → 훅 실행 (자물쇠에 안 맞는 아이템이라도 훅이 우선. "맨 방망이로 좀비 치기 → 물림" 같은 함정용)
3. 그래도 없으면 → key 자물쇠면 "맞지 않는다", 아니면 "아무 일도 일어나지 않는다"

### 조건부 설명
방과 오브젝트의 `description` 은 문자열 대신 배열도 된다. 위에서부터 `when` 을 만족하는 첫 항목의 `text` 를 쓴다.
```jsonc
"description": [
  { "when": { "solved": "shackle_lock" }, "text": "풀린 족쇄가 바닥에 있다." },
  { "text": "발목의 무쇠 족쇄." }
]
```

### 이름 규칙
- `names` 의 각 항목은 **공백 없는 한 토큰**이어야 한다 (파서가 공백으로 자르므로). "놋쇠 열쇠" 대신 "놋쇠열쇠".

### 표시 규칙
- 방에 보이는 오브젝트 = `rooms[r].objects` 중 (`hidden: false` 또는 `revealed` 에 포함) **이고** 인벤토리에 없는 것.
- `hide` 효과는 `revealed` 에서 제거한다. 원래 `hidden: false` 인 오브젝트를 숨기려면 `hidden` 목록에 추가한다.

## 6. 게임 상태 (State)

```js
{
  scenarioId: "old-study",
  status: "playing",           // playing | won | lost
  room: "study",
  inventory: ["diary"],
  flags: ["diary_seen"],
  revealed: ["diary"],         // hidden → 보이게 된 오브젝트
  hidden: [],                  // hide 효과로 숨겨진 오브젝트
  solvedLocks: [],
  attempts: { "bath_lock": 1 },  // 자물쇠별 오답 횟수 (maxAttempts 용)
  retries: 0,                  // 함정 사망 후 재도전 횟수
  lostBy: undefined,           // "timeout" | "trap" (status 가 lost 일 때)
  hintsUsed: 1,
  elapsedMs: 0,                // 저장 시점까지 누적 플레이 시간
  penaltyMs: 120000,           // 힌트 패널티 누적
  startedAt: 1757800000000     // 이번 세션 시작 시각 (불러오면 그 시점의 now 로 리셋)
}
```

전부 JSON 직렬화 가능한 값만 둔다 → 저장/불러오기가 `JSON.stringify` 한 줄.

`status` 가 `won` / `lost` 이면 `run()` 은 어떤 입력에도 "게임이 끝났습니다." 메시지만 반환한다.

## 7. 명령 파서

- 공백으로 토큰화 → **첫 토큰 또는 마지막 토큰**을 별칭 테이블에서 찾아 verb 로 정규화 (`사용 열쇠 문`, `열쇠를 문에 사용` 둘 다 허용). 둘 다 verb 가 아니면 에러.
- 나머지 토큰을 `target` / `secondary` 로 분리. `on`, `to`, `에`, `으로` 같은 연결어 토큰은 버린다.
- 대상 매칭: 현재 방의 보이는 오브젝트 + 인벤토리 + 현재 방의 출구의 `names` 에서 검색.
  - 먼저 원문 그대로 매칭한다.
  - 실패하면 끝의 조사(`을/를/이/가/에/에서/으로/로`)를 떼고 한 번 더 매칭한다. → "문을" 은 "문" 으로, "가게" 같은 이름은 잘못 잘리지 않는다.
- 이름 유일성은 **같은 방 안(방의 오브젝트 + 출구) + 인벤토리** 범위에서만 요구한다. 서로 다른 방에 "문" 이 각각 있어도 된다.

| verb | 별칭 | 형식 | 처리 위치 |
|---|---|---|---|
| look | 보기, 둘러보기, l | `보기` | 엔진 |
| examine | 조사, 살펴보기, x | `조사 <대상>` | 엔진 |
| take | 줍기, 획득, get | `줍기 <대상>` | 엔진 |
| use | 사용 | `사용 <아이템> <대상>` | 엔진 |
| enter | 입력, 코드 | `입력 <코드> [대상]` | 엔진 |
| go | 이동, 가기 | `이동 <출구>` | 엔진 |
| interact | 돌리기, 당기기, 누르기, 열기, 조작, turn, pull, push, open | `돌리기 <대상>` | 엔진 |
| combine | 조합, 합치기, 결합, 만들기, craft | `조합 <아이템> <아이템>` | 엔진 |
| inventory | 가방, 인벤, i | `가방` | 엔진 |
| hint | 힌트, h | `힌트` (남은 시간 -2분) | 엔진 |
| help | 도움말, ? | `도움말` | 엔진 |
| save / load | 저장 / 불러오기 | `저장 [슬롯]` | **UI** |
| quit | 종료, q | `종료` | **UI** |

## 8. 턴 처리 흐름

```
입력 문자열
  → UI: 저장/불러오기/종료면 여기서 처리하고 끝
  → game.run(input)
      → status 가 playing 이 아니면 "게임이 끝났습니다." 반환
      → timer 체크               남은 시간 ≤ 0 이면 endings.timeout, status = lost, 반환
      → parser.parse()          { verb, target, secondary }
      → commands[verb](ctx)      ctx = { state, scenario, target, secondary, now }
      → 핸들러가 조건 검사 → effects.apply() → 메시지 배열 반환
      → gameOver 효과로 status 가 lost 면  그대로 반환 (승리 판정 안 함)
      → 현재 방이 isExit 면      endings.success 추가, status = won
  → ui.renderer 출력
```

## 9. 타이머

- 남은 시간 = `timeLimitSec * 1000 - (elapsedMs + (now - startedAt) + penaltyMs)`.
- 내부 계산은 전부 **ms**, 시나리오 JSON 만 사람이 읽기 쉽게 초 단위.
- 힌트 사용 시 `penaltyMs += hintPenaltySec * 1000`.
- 프롬프트에 `[남은 시간 24:31] >` 형식으로 표시. 엔진은 매 턴 계산만 한다.
- **상단 상태 박스** (`ui/status.js`): TTY 면 화면 위 5줄을 스크롤 영역에서 떼어(DECSTBM `ESC[6;{rows}r`) 위치·남은 시간·보이는 것·가방을 고정 표시한다. 1초마다 커서를 저장(`ESC 7`)/복원(`ESC 8`)하며 박스만 다시 그리므로 readline 입력 중에도 화면이 깨지지 않는다. 한글은 2칸으로 계산해 테두리를 맞춘다. 게임이 끝나면 스크롤 영역을 해제(`ESC[r`). `--no-status` / `ESCAPE_NO_STATUS=1` 로 끈다. 비 TTY·10행 미만이면 자동 비활성.
- 저장 시 `elapsedMs += now - startedAt` 로 누적하고 → 불러오면 `startedAt = now` 로 리셋해서 이어짐.

## 10. 콘텐츠 검증 (validate.js)

시나리오 로드 시 아래를 검사해서 실행 전에 실패시킨다.

- 모든 `objects`, `locks`, `rooms`, `exits[].to`, `lockedBy`, `keyItem`, `reveal`/`hide`/`addItem` 참조 id 가 실제로 존재하는가 (훅 배열, `onInteract`, 방 `onEnter`, 락의 `onFail`/`onMaxAttempts` 포함)
- 효과 이름이 지원 목록에 있는가. `addPenalty` 는 양수, `gameOver` 는 문자열인가. `maxAttempts` 는 1 이상 정수이고 `onMaxAttempts` 가 있으면 `maxAttempts` 도 있는가
- `description` 이 배열이면 각 항목에 `text` 가 있는가
- `recipes`: `inputs` 가 서로 다른 오브젝트 2개인가, `output` 이 존재하는가, `output` 도 `effects` 도 없지 않은가, `consume` 배열 항목이 `inputs` 에 있는가, 결과물 이름이 다른 방 오브젝트와 겹치지 않는가
- `startRoom` 존재, `isExit: true` 인 방이 최소 하나, `endings.success` / `endings.timeout` 정의됨
- `lock` 의 type 이 `code` 면 `answer`, `key` 면 `keyItem` 이 있는가
- 모든 방이 startRoom 에서 도달 가능한가 (잠금 무시하고 그래프 탐색)
- 같은 방의 오브젝트·출구 사이에 `names` 가 중복되지 않는가 (`takeable` 오브젝트는 모든 방과 비교)

`walkthrough.test.js` 는 시나리오별로 정답 명령 목록을 두고 실제 Game 을 돌려 `status === "won"` 에 도달하는지 확인한다. → 콘텐츠를 고쳐서 못 푸는 방이 되면 테스트가 잡아준다.

## 11. 구현 순서 (마일스톤)

1. **뼈대** — `Game.run`, parser, look/examine/take/inventory, 방 1개. readline 루프로 돌아가게.
2. **퍼즐** — locks(code/key), conditions/effects, use/enter/go, 방 2개 연결, isExit 엔딩.
3. **게임성** — 타이머, 힌트 패널티, 성공/실패 화면, `toJSON`/`fromJSON` + UI 저장/불러오기.
4. **콘텐츠** — "낡은 서재" 시나리오 완성 (방 3개, 퍼즐 5~6개), validate + walkthrough 테스트.
5. **마감** — 색상/타자 효과, 타이틀 ASCII 아트, `npm link` 로 `escape` 명령 등록.

1~5 는 완료 (2026-09-14). 아래는 2차 마일스톤.

### 6. 콘텐츠 제작 경험 — "시나리오 작가가 코드를 안 본다"

지금 시나리오를 추가하려면 `test/walkthrough.test.js` 를 고쳐야 하고, 방 설명이 상태에 따라 안 바뀐다 (지하실은 등불을 켠 뒤에도 "캄캄하다"). 이걸 데이터만으로 해결한다.

- `scenario.json` 에 `solution: ["조사 책상", ...]` 필드 추가. walkthrough 테스트는 이 필드를 읽어서 돈다. → 테스트 파일 수정 불필요. `solution` 없는 시나리오는 validate 에서 경고.
- **조건부 설명**: `description` 에 문자열 대신 배열 허용. 위에서부터 `when` 을 만족하는 첫 항목 사용.
  ```jsonc
  "description": [
    { "when": { "flag": "cellar_lit" }, "text": "등불 빛에 구석의 궤짝이 보인다." },
    { "text": "축축하고 캄캄하다." }
  ]
  ```
  방과 오브젝트 둘 다 지원. 금고는 열린 뒤 "열려 있다"로, 지하실은 밝아진 뒤 밝은 설명으로.
- 외부 시나리오 실행: `escape --file ./my-room/` (디렉토리 또는 json 경로). 내장 목록 밖의 시나리오를 바로 테스트.
- `escape validate <경로>`: 검증 결과 + solution 실행 결과를 출력하고 실패 시 exit 1. 작가용 린트.
- 완료 기준: 새 시나리오를 `src/` 밖 디렉토리에 만들고, 코드·테스트 파일을 하나도 안 건드리고 `escape validate` 로 검증 → `escape --file` 로 플레이.

### 7. 퍼즐 표현력

- **여러 단어 이름**: `names: ["놋쇠 열쇠"]` 허용. 파서가 verb 를 뗀 나머지 토큰을 붙여 가며 가장 긴 매칭을 찾는다 (`사용 놋쇠 열쇠 문` → target "놋쇠 열쇠", secondary "문").
- **`sequence` 자물쇠**: 정해진 순서로 오브젝트를 조작하면 풀린다.
  ```jsonc
  "piano_lock": { "type": "sequence", "steps": ["do", "mi", "sol"], "resetMessage": "음이 어긋났다." }
  ```
  `조사`/`사용` 등 오브젝트 상호작용이 `state.sequences[lockId]` 에 쌓이고, 틀리면 초기화. 자물쇠는 오브젝트 하나에 붙이되 `steps` 는 어느 오브젝트든 가능.
- **방 훅** `onEnter` ✅ (2026-09-18): 매번 실행. 한 번만은 `when: notFlag` + `setFlag` 로 (별도 `once` 없음). `jigsaw` 냉동창고·소각 슈트에서 사용.
- **효과 추가** ✅ (2026-09-18): `addPenalty`, `gameOver`. 조건부 설명 ✅ (방·오브젝트 `description` 배열). 훅 배열(`when` 분기) ✅ 과 `onInteract` + `돌리기` 동사 ✅ 로 밸브 순서 함정을 데이터만으로 만들었으므로 `sequence` 자물쇠는 **보류** (필요해지면 추가). 상태 머신은 도입하지 않는다.
- 자물쇠 확장 ✅: `requires`, `onFail`, `maxAttempts` / `onMaxAttempts`.
- 완료 기준: `jigsaw` 시나리오에서 훅 배열, onInteract, onEnter 함정, maxAttempts 게임 오버, 조건부 설명을 각각 최소 1회 사용. (여러 단어 이름은 미구현)

### 8. 게임 느낌

- 남은 시간 경고: 5분, 1분 남았을 때 한 번씩 시스템 메시지. 마지막 1분은 프롬프트 색을 빨강으로.
- **자동 저장** ✅ (2026-09-17): 매 턴 `auto` 슬롯에 저장. 시작 시 미완료 자동 저장이 있으면 "이어할까요? (Y/n)". 게임이 끝나면 `auto` 삭제, `--new` 로 건너뛰기, 저장은 임시 파일에 쓴 뒤 rename. `ESCAPE_SAVE_DIR` 로 경로 변경.
- **기록**: 시나리오별 최단 클리어 시간·힌트 수를 `~/.room-escape/records.json` 에 저장. 타이틀 메뉴에 `★ 12:34` 로 표시. 결과 화면에 "신기록!" 표시.
- 결과 화면에 요약: 걸린 시간, 힌트, 턴 수 (`state.turns` 추가).
- 완료 기준: 게임 도중 Ctrl+C 로 끊고 다시 실행하면 이어하기가 뜬다.

### 9. 배포와 두 번째 UI

- `npm publish` → `npx room-escape` 로 설치 없이 실행. `files` 필드로 test/ 제외.
- **웹 UI 시제품**: `web/index.html` 하나. 엔진 ESM 을 브라우저에서 그대로 import 하고, 저장은 localStorage. 4장의 "UI 만 바꿔 끼운다"가 진짜인지 확인하는 목적. 엔진에 `fs`/`process` 의존이 없어야 통과.
- 완료 기준: 웹에서 `old-study` 를 끝까지 클리어. 엔진 코드 수정 0줄.

### 순서 제안
6 → 8 → 7 → 9. 6 은 콘텐츠 만들 때마다 드는 비용을 줄이니 먼저. 8 은 작고 체감이 크다. 7 은 세 번째 시나리오와 같이. 9 는 마지막.

## 12. 확장 여지 (지금은 안 함)

- TypeScript 전환, 멀티플레이는 범위 밖
- 시나리오 커뮤니티 공유(URL 로 불러오기), 랜덤 요소, 다국어 전환 모드
