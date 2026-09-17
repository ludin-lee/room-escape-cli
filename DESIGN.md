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
│   │   └── screens.js        # 타이틀 화면, 탈출 성공/실패 화면 (ASCII 아트)
│   ├── content/
│   │   ├── loader.js         # 시나리오 JSON 로드 + validate 호출
│   │   ├── validate.js       # 참조 무결성 검사 (존재하지 않는 id, 도달 불가 출구 등)
│   │   └── scenarios/
│   │       ├── old-study/    # "낡은 서재" (30분, 방 4개, 퍼즐 7개)
│   │       │   └── scenario.json
│   │       ├── midnight-ward/ # "자정의 병동" (20분, 방 4개, 퍼즐 5개)
│   │       │   └── scenario.json
│   │       └── observatory/  # "폐쇄된 천문대" (45분, 방 7개, 퍼즐 9개)
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

- 자물쇠는 **오브젝트의 `lock` 필드**로만 연결된다. `enter` / `use` 의 대상은 오브젝트이고, 그 오브젝트의 `lock` 을 푼다.
- 풀린 자물쇠는 `state.solvedLocks` 에 기록된다. 이것이 "열렸다"의 **유일한 표현**이다. 별도 flag 나 `unlockExit` 효과는 두지 않는다.
- 출구의 `lockedBy` 는 락 id 를 가리키며, 그 id 가 `solvedLocks` 에 있으면 통과할 수 있다.
- `입력 <코드>` 에서 대상을 생략하면: 현재 방에 보이는 `lock` 달린 오브젝트가 하나면 그것, 둘 이상이면 "어디에 입력할까요?" 로 되묻고, 없으면 에러.

### 조건(Condition) 종류
`hasItem`, `flag`, `notFlag`, `solved`, `notSolved`, `inRoom`, `all: [...]`, `any: [...]`

### 효과(Effect) 종류
`addItem`, `removeItem`, `setFlag`, `clearFlag`, `reveal`, `hide`, `moveTo`, `message`

조건/효과가 데이터로만 표현되므로 **퍼즐 로직에 코드가 들어가지 않는다.**

### 엔딩
- **성공**: 플레이어가 `isExit: true` 인 방에 들어가는 순간. 그 턴의 메시지 끝에 `endings.success` 를 붙이고 `status` 를 `won` 으로 바꾼다.
- **실패**: 남은 시간이 0 이하가 된 턴. `endings.timeout` 을 출력하고 `status` 를 `lost` 로 바꾼다.

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
      → 현재 방이 isExit 면      endings.success 추가, status = won
  → ui.renderer 출력
```

## 9. 타이머

- 남은 시간 = `timeLimitSec * 1000 - (elapsedMs + (now - startedAt) + penaltyMs)`.
- 내부 계산은 전부 **ms**, 시나리오 JSON 만 사람이 읽기 쉽게 초 단위.
- 힌트 사용 시 `penaltyMs += hintPenaltySec * 1000`.
- 프롬프트에 `[남은 시간 24:31] >` 형식으로 표시. 매 턴 계산만 하고 setInterval 은 쓰지 않음(입력 대기 중 화면 깨짐 방지).
- 저장 시 `elapsedMs += now - startedAt` 로 누적하고 → 불러오면 `startedAt = now` 로 리셋해서 이어짐.

## 10. 콘텐츠 검증 (validate.js)

시나리오 로드 시 아래를 검사해서 실행 전에 실패시킨다.

- 모든 `objects`, `locks`, `rooms`, `exits[].to`, `lockedBy`, `keyItem`, `reveal`/`hide`/`addItem` 참조 id 가 실제로 존재하는가
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
- **방 훅** `onEnter`: 처음 들어갈 때 한 번(`once: true`) 또는 매번 실행되는 효과. 첫 입장 연출, 함정.
- **효과 추가**: `addPenalty: 60` (초, 함정), `replaceObject` 대신 조건부 설명으로 대체 가능하므로 상태 머신은 **도입하지 않는다** (6번 조건부 설명 + flag 로 충분).
- 완료 기준: 세 번째 시나리오에서 sequence 자물쇠, 여러 단어 이름, onEnter 함정을 각각 최소 1회 사용.

### 8. 게임 느낌

- 남은 시간 경고: 5분, 1분 남았을 때 한 번씩 시스템 메시지. 마지막 1분은 프롬프트 색을 빨강으로.
- **자동 저장**: 매 턴 `auto` 슬롯에 저장. 시작 시 미완료 자동 저장이 있으면 "이어할까요? (Y/n)".
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
