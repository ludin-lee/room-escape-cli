# Room Escape (CLI 방탈출)

터미널에서 텍스트 명령으로 진행하는 1인용 방탈출 게임. 외부 의존성 없음 (Node.js 22+).

```sh
node bin/escape.js            # 바로 실행
npm link && escape            # 전역 명령으로 등록해서 실행
escape --list                 # 시나리오 목록
escape -s old-study           # 시나리오 지정 (생략하면 메뉴에서 선택)
escape --load s1              # 저장 슬롯에서 이어하기
escape --fast                 # 타자 효과 끄기 (ESCAPE_FAST=1 도 동일)
npm test                      # 테스트
```

## 수록 시나리오

| id | 제목 | 제한 시간 | 방 / 퍼즐 |
|---|---|---|---|
| `old-study` | 낡은 서재 | 30분 | 4 / 7 |
| `midnight-ward` | 자정의 병동 | 20분 | 4 / 5 |

## 명령어

| 명령 | 예시 |
|---|---|
| 보기 / look | `보기` |
| 조사 / examine | `조사 책상`, `x desk` |
| 줍기 / take | `줍기 일기장` |
| 사용 / use | `사용 열쇠 문`, `열쇠를 문에 사용`, `use key on door` |
| 입력 / enter | `입력 731 금고`, `입력 7-3-1` |
| 이동 / go | `이동 복도` |
| 가방 / inventory | `가방`, `i` |
| 힌트 / hint | `힌트` (남은 시간 2분 차감) |
| 저장 / 불러오기 | `저장 s1`, `불러오기 s1` (기본 슬롯 `auto`) |
| 종료 / quit | `종료` |

저장 파일은 `~/.room-escape/saves/<슬롯>.json` 에 저장됩니다.

## 새 시나리오 추가

`src/content/scenarios/<id>/scenario.json` 을 만들면 자동으로 목록에 뜹니다. 형식과 규칙은 [DESIGN.md](DESIGN.md) 5장을 보세요. 로드 시 참조 무결성 검사를 통과해야 하며, `test/walkthrough.test.js` 에 정답 명령 시퀀스를 추가하면 풀 수 있는 방인지 테스트가 보장합니다.
