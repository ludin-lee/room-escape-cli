import { mkdir, readFile, writeFile, readdir, rm, rename } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

/** 저장 디렉토리. ESCAPE_SAVE_DIR 로 바꿀 수 있다 (테스트·이식용). */
export const SAVE_DIR = process.env.ESCAPE_SAVE_DIR ?? path.join(os.homedir(), ".room-escape", "saves");
export const AUTO_SLOT = "auto";

function slotPath(slot) {
  if (!/^[\w-]+$/.test(slot)) throw new Error(`슬롯 이름은 영문/숫자/_/- 만 가능합니다: ${slot}`);
  return path.join(SAVE_DIR, `${slot}.json`);
}

export async function saveSlot(slot, snapshot) {
  await mkdir(SAVE_DIR, { recursive: true });
  const file = slotPath(slot);
  const tmp = `${file}.tmp`;
  // 임시 파일에 쓴 뒤 교체해서, 도중에 꺼져도 깨진 저장 파일이 남지 않게 한다.
  await writeFile(tmp, JSON.stringify({ savedAt: Date.now(), ...snapshot }, null, 2));
  await rename(tmp, file);
}

export async function loadSlot(slot) {
  const raw = await readFile(slotPath(slot), "utf8");
  return JSON.parse(raw);
}

/** 슬롯 삭제. 없으면 조용히 넘어간다. */
export async function deleteSlot(slot) {
  await rm(slotPath(slot), { force: true });
}

export async function listSlots() {
  try {
    const files = await readdir(SAVE_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
  } catch {
    return [];
  }
}

/**
 * 이어할 수 있는 자동 저장을 찾는다.
 * 진행 중(status === "playing")이고, scenarioId 를 지정했다면 그 시나리오의 저장일 때만 돌려준다.
 * @returns {Promise<object|null>} 스냅샷 또는 null
 */
export async function findResumable(scenarioId = null) {
  let snapshot;
  try {
    snapshot = await loadSlot(AUTO_SLOT);
  } catch {
    return null;
  }
  if (snapshot?.status !== "playing") return null;
  if (scenarioId && snapshot.scenarioId !== scenarioId) return null;
  return snapshot;
}
