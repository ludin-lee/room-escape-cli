import { createState, serialize, deserialize } from "./state.js";
import { parse, matchName } from "./parser.js";
import { remainingMs, formatMs } from "./timer.js";
import { apply } from "./effects.js";
import { COMMANDS } from "./commands/index.js";

const UI_VERBS = new Set(["save", "load", "quit"]);

/**
 * 순수 게임 엔진. 입력 문자열 → 메시지 배열.
 * 메시지: { type: "text"|"room"|"item"|"error"|"system"|"hint"|"ending", body }
 */
export class Game {
  /**
   * @param {object} scenario
   * @param {{ now?: () => number, state?: object }} [opts]
   */
  constructor(scenario, { now = () => Date.now(), state } = {}) {
    this.scenario = scenario;
    this.now = now;
    this.state = state ?? createState(scenario, now());
  }

  static fromJSON(scenario, snapshot, { now = () => Date.now() } = {}) {
    if (snapshot.scenarioId !== scenario.id) {
      throw new Error(`저장 파일의 시나리오(${snapshot.scenarioId})가 현재 시나리오(${scenario.id})와 다릅니다.`);
    }
    return new Game(scenario, { now, state: deserialize(snapshot, now()) });
  }

  toJSON() {
    return serialize(this.state, this.now());
  }

  get status() { return this.state.status; }
  remainingMs() { return remainingMs(this.scenario, this.state, this.now()); }
  remainingText() { return formatMs(this.remainingMs()); }

  /** 게임 시작 메시지 (인트로 + 첫 방) */
  start() {
    const messages = [];
    if (this.scenario.intro) messages.push({ type: "text", body: this.scenario.intro });
    messages.push(...this.describeRoom());
    return messages;
  }

  /** @param {string} input @returns {object[]} */
  run(input) {
    const { state } = this;
    if (state.status !== "playing") {
      return [{ type: "system", body: "게임이 끝났습니다." }];
    }
    if (this.remainingMs() <= 0) {
      return this.#lose();
    }

    const parsed = parse(input);
    if (!parsed.verb) {
      if (parsed.args.length === 0) return [];
      return [this.error(`'${parsed.args[0]}' 은(는) 모르는 명령입니다. '도움말' 을 입력해 보세요.`)];
    }
    if (UI_VERBS.has(parsed.verb)) {
      return [this.error(`'${input.trim()}' 은(는) 이 화면에서 처리할 수 없는 명령입니다.`)];
    }

    const ctx = this.#context(parsed);
    const messages = COMMANDS[parsed.verb](ctx);

    if (this.currentRoom().isExit) {
      state.status = "won";
      messages.push({ type: "ending", body: this.scenario.endings.success });
    } else if (this.remainingMs() <= 0) {
      messages.push(...this.#lose());
    }
    return messages;
  }

  #lose() {
    this.state.status = "lost";
    return [{ type: "ending", body: this.scenario.endings.timeout }];
  }

  // ---- 조회 헬퍼 (commands 가 ctx 로 사용) ----

  currentRoom() { return this.scenario.rooms[this.state.room]; }

  /** 현재 방에서 보이는 오브젝트 (인벤토리 제외) */
  visibleObjects() {
    const { state, scenario } = this;
    return this.currentRoom().objects
      .filter((id) => !state.inventory.includes(id))
      .filter((id) => {
        if (state.hidden.includes(id)) return false;
        const obj = scenario.objects[id];
        return !obj.hidden || state.revealed.includes(id);
      })
      .map((id) => ({ id, ...scenario.objects[id] }));
  }

  inventoryObjects() {
    return this.state.inventory.map((id) => ({ id, ...this.scenario.objects[id] }));
  }

  findObject(token, { includeRoom = true, includeInventory = true } = {}) {
    const candidates = [
      ...(includeRoom ? this.visibleObjects() : []),
      ...(includeInventory ? this.inventoryObjects() : []),
    ];
    return matchName(token, candidates);
  }

  findExit(token) {
    return matchName(token, this.currentRoom().exits);
  }

  describeRoom() {
    const room = this.currentRoom();
    const messages = [{ type: "room", body: room.name }, { type: "text", body: room.description }];
    const objs = this.visibleObjects().map((o) => o.names[0]);
    if (objs.length) messages.push({ type: "text", body: `보이는 것: ${objs.join(", ")}` });
    const exits = room.exits.map((e) => e.names[0]);
    if (exits.length) messages.push({ type: "text", body: `출구: ${exits.join(", ")}` });
    return messages;
  }

  error(body) { return { type: "error", body }; }

  /** 자물쇠 해결 처리 (enter / use 공용) */
  solveLock(lockId, { consumeItem = null } = {}) {
    const lock = this.scenario.locks[lockId];
    this.state.solvedLocks.push(lockId);
    if (consumeItem) {
      const i = this.state.inventory.indexOf(consumeItem);
      if (i >= 0) this.state.inventory.splice(i, 1);
    }
    const messages = [];
    if (lock.onSolve?.message) messages.push({ type: "text", body: lock.onSolve.message });
    messages.push(...apply(lock.onSolve?.effects, this.state));
    return messages;
  }

  #context(parsed) {
    return {
      state: this.state,
      scenario: this.scenario,
      now: this.now(),
      target: parsed.target,
      secondary: parsed.secondary,
      args: parsed.args,
      currentRoom: () => this.currentRoom(),
      visibleObjects: () => this.visibleObjects(),
      findObject: (t, o) => this.findObject(t, o),
      findExit: (t) => this.findExit(t),
      describeRoom: () => this.describeRoom(),
      error: (b) => this.error(b),
      solveLock: (id, o) => this.solveLock(id, o),
    };
  }
}
