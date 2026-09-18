/**
 * 시나리오 참조 무결성 검사. 문제가 있으면 Error 목록을 담은 예외를 던진다.
 * @returns {string[]} 에러 메시지 (비어 있으면 통과)
 */
import { hookList } from "../engine/hooks.js";

export function validateScenario(s) {
  const errors = [];
  const err = (m) => errors.push(m);

  const rooms = s.rooms ?? {};
  const objects = s.objects ?? {};
  const locks = s.locks ?? {};

  if (!s.id) err("id 가 없습니다.");
  if (typeof s.timeLimitSec !== "number") err("timeLimitSec 가 숫자가 아닙니다.");
  if (!s.startRoom) err("startRoom 이 없습니다.");
  else if (!rooms[s.startRoom]) err(`startRoom '${s.startRoom}' 방이 없습니다.`);
  if (!s.endings?.success) err("endings.success 가 없습니다.");
  if (!s.endings?.timeout) err("endings.timeout 이 없습니다.");
  if (!Object.values(rooms).some((r) => r.isExit)) err("isExit: true 인 방이 하나도 없습니다.");

  // objects
  for (const [id, o] of Object.entries(objects)) {
    if (!Array.isArray(o.names) || o.names.length === 0) err(`object '${id}' 에 names 가 없습니다.`);
    if (o.lock && !locks[o.lock]) err(`object '${id}' 의 lock '${o.lock}' 이 없습니다.`);
    checkDescription(o.description, `object '${id}'`, err);
    for (const hook of objectHooks(o)) {
      checkEffects(hook?.effects, `object '${id}'`, objects, rooms, err);
    }
  }

  // locks
  for (const [id, l] of Object.entries(locks)) {
    if (l.type === "code") {
      if (l.answer == null) err(`lock '${id}' (code) 에 answer 가 없습니다.`);
    } else if (l.type === "key") {
      if (!l.keyItem) err(`lock '${id}' (key) 에 keyItem 이 없습니다.`);
      else if (!objects[l.keyItem]) err(`lock '${id}' 의 keyItem '${l.keyItem}' 오브젝트가 없습니다.`);
    } else {
      err(`lock '${id}' 의 type '${l.type}' 은 지원하지 않습니다 (code | key).`);
    }
    checkEffects(l.onSolve?.effects, `lock '${id}'`, objects, rooms, err);
    checkEffects(l.onFail?.effects, `lock '${id}' onFail`, objects, rooms, err);
    checkEffects(l.onMaxAttempts?.effects, `lock '${id}' onMaxAttempts`, objects, rooms, err);
    if (l.maxAttempts != null && (!Number.isInteger(l.maxAttempts) || l.maxAttempts < 1)) err(`lock '${id}' 의 maxAttempts 는 1 이상의 정수여야 합니다.`);
    if (l.onMaxAttempts && !l.maxAttempts) err(`lock '${id}' 에 onMaxAttempts 가 있지만 maxAttempts 가 없습니다.`);
    if (!Object.values(objects).some((o) => o.lock === id)) err(`lock '${id}' 를 사용하는 오브젝트가 없습니다.`);
  }

  // rooms
  const takeableNames = [];
  for (const [rid, r] of Object.entries(rooms)) {
    if (!r.name) err(`room '${rid}' 에 name 이 없습니다.`);
    checkDescription(r.description, `room '${rid}'`, err);
    for (const hook of hookList(r.onEnter)) checkEffects(hook?.effects, `room '${rid}' onEnter`, objects, rooms, err);
    const scoped = [];
    for (const oid of r.objects ?? []) {
      if (!objects[oid]) { err(`room '${rid}' 의 object '${oid}' 가 없습니다.`); continue; }
      scoped.push({ id: oid, names: objects[oid].names ?? [] });
      if (objects[oid].takeable) takeableNames.push({ id: oid, names: objects[oid].names ?? [] });
    }
    for (const [i, e] of (r.exits ?? []).entries()) {
      if (!Array.isArray(e.names) || e.names.length === 0) err(`room '${rid}' 의 exit #${i} 에 names 가 없습니다.`);
      if (!rooms[e.to]) err(`room '${rid}' 의 exit '${e.names?.[0]}' 의 to '${e.to}' 방이 없습니다.`);
      if (e.lockedBy && !locks[e.lockedBy]) err(`room '${rid}' 의 exit '${e.names?.[0]}' 의 lockedBy '${e.lockedBy}' 가 없습니다.`);
      scoped.push({ id: `exit:${i}`, names: e.names ?? [] });
    }
    checkDuplicateNames(scoped, `room '${rid}'`, err);
  }
  // takeable 오브젝트는 어느 방에서든 가방에 있을 수 있으므로 모든 방의 이름과 비교
  for (const [rid, r] of Object.entries(rooms)) {
    const scoped = [
      ...(r.objects ?? []).filter((id) => objects[id]).map((id) => ({ id, names: objects[id].names ?? [] })),
      ...(r.exits ?? []).map((e, i) => ({ id: `exit:${i}`, names: e.names ?? [] })),
    ];
    for (const t of takeableNames) {
      for (const other of scoped) {
        if (other.id === t.id) continue;
        const dup = t.names.filter((n) => other.names.includes(n));
        if (dup.length) err(`takeable object '${t.id}' 의 이름 ${JSON.stringify(dup)} 이 room '${rid}' 의 '${other.id}' 와 겹칩니다.`);
      }
    }
  }

  // 도달 가능성 (잠금 무시)
  if (s.startRoom && rooms[s.startRoom]) {
    const seen = new Set([s.startRoom]);
    const queue = [s.startRoom];
    while (queue.length) {
      const cur = queue.shift();
      for (const e of rooms[cur].exits ?? []) {
        if (rooms[e.to] && !seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
      }
      // moveTo 효과도 이동 경로로 인정
      for (const oid of rooms[cur].objects ?? []) {
        const o = objects[oid];
        if (!o) continue;
        for (const hook of objectHooks(o)) {
          for (const ef of hook?.effects ?? []) {
            if (ef.moveTo && rooms[ef.moveTo] && !seen.has(ef.moveTo)) { seen.add(ef.moveTo); queue.push(ef.moveTo); }
          }
        }
      }
    }
    for (const rid of Object.keys(rooms)) {
      if (!seen.has(rid)) err(`room '${rid}' 는 startRoom 에서 도달할 수 없습니다.`);
    }
  }

  // recipes
  const recipeOutputs = [];
  for (const [i, r] of (s.recipes ?? []).entries()) {
    const where = `recipe #${i}`;
    if (!Array.isArray(r.inputs) || r.inputs.length !== 2) err(`${where} 의 inputs 는 오브젝트 id 2개여야 합니다.`);
    else {
      for (const id of r.inputs) if (!objects[id]) err(`${where} 의 input '${id}' 오브젝트가 없습니다.`);
      if (r.inputs[0] === r.inputs[1]) err(`${where} 의 inputs 가 같은 오브젝트입니다.`);
    }
    if (r.output) {
      if (!objects[r.output]) err(`${where} 의 output '${r.output}' 오브젝트가 없습니다.`);
      else recipeOutputs.push({ id: r.output, names: objects[r.output].names ?? [] });
    }
    if (!r.output && !r.effects?.length) err(`${where} 에 output 도 effects 도 없습니다.`);
    if (Array.isArray(r.consume)) for (const id of r.consume) if (!r.inputs?.includes(id)) err(`${where} 의 consume '${id}' 는 inputs 에 없습니다.`);
    checkEffects(r.effects, where, objects, rooms, err);
  }
  // 조합 결과물은 가방에 들어가므로 takeable 처럼 모든 방의 이름과 겹치면 안 된다
  for (const [rid, r] of Object.entries(rooms)) {
    const scoped = [
      ...(r.objects ?? []).filter((id) => objects[id]).map((id) => ({ id, names: objects[id].names ?? [] })),
      ...(r.exits ?? []).map((e, i) => ({ id: `exit:${i}`, names: e.names ?? [] })),
    ];
    for (const t of recipeOutputs) {
      for (const other of scoped) {
        if (other.id === t.id) continue;
        const dup = t.names.filter((n) => other.names.includes(n));
        if (dup.length) err(`조합 결과 '${t.id}' 의 이름 ${JSON.stringify(dup)} 이 room '${rid}' 의 '${other.id}' 와 겹칩니다.`);
      }
    }
  }

  // hints
  for (const [i, h] of (s.hints ?? []).entries()) {
    if (!h.text) err(`hint #${i} 에 text 가 없습니다.`);
  }

  return errors;
}

function useHooks(onUse) {
  if (!onUse) return [];
  if (onUse.target || onUse.effects) return [onUse];
  return Object.values(onUse);
}

/** 오브젝트에 달린 모든 훅 (onExamine / onTake / onInteract 는 배열 가능, onUse 는 대상별 맵 가능) */
function objectHooks(o) {
  return [...hookList(o.onExamine), ...hookList(o.onTake), ...hookList(o.onInteract), ...useHooks(o.onUse)];
}

function checkDescription(desc, where, err) {
  if (desc == null || typeof desc === "string") return;
  if (!Array.isArray(desc)) { err(`${where} 의 description 은 문자열이거나 배열이어야 합니다.`); return; }
  for (const [i, d] of desc.entries()) {
    if (typeof d?.text !== "string") err(`${where} 의 description #${i} 에 text 가 없습니다.`);
  }
}

const KNOWN_EFFECTS = new Set(["addItem", "removeItem", "setFlag", "clearFlag", "reveal", "hide", "moveTo", "message", "addPenalty", "gameOver"]);

function checkEffects(effects, where, objects, rooms, err) {
  for (const ef of effects ?? []) {
    for (const [k, v] of Object.entries(ef)) {
      if (!KNOWN_EFFECTS.has(k)) err(`${where} 의 효과 '${k}' 는 지원하지 않습니다.`);
      if (["addItem", "removeItem", "reveal", "hide"].includes(k) && !objects[v]) err(`${where} 의 효과 ${k}: '${v}' 오브젝트가 없습니다.`);
      if (k === "moveTo" && !rooms[v]) err(`${where} 의 효과 moveTo: '${v}' 방이 없습니다.`);
      if (k === "addPenalty" && !(typeof v === "number" && v > 0)) err(`${where} 의 효과 addPenalty 는 양수(초)여야 합니다.`);
      if (k === "gameOver" && typeof v !== "string") err(`${where} 의 효과 gameOver 는 메시지 문자열이어야 합니다.`);
    }
  }
}

function checkDuplicateNames(entries, where, err) {
  const seen = new Map();
  for (const e of entries) {
    for (const n of e.names) {
      const key = n.toLowerCase();
      if (seen.has(key) && seen.get(key) !== e.id) err(`${where} 에서 이름 '${n}' 이 '${seen.get(key)}' 와 '${e.id}' 에 중복됩니다.`);
      seen.set(key, e.id);
    }
  }
}
