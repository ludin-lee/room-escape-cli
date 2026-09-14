import { mkdir, readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

export const SAVE_DIR = path.join(os.homedir(), ".room-escape", "saves");

function slotPath(slot) {
  if (!/^[\w-]+$/.test(slot)) throw new Error(`슬롯 이름은 영문/숫자/_/- 만 가능합니다: ${slot}`);
  return path.join(SAVE_DIR, `${slot}.json`);
}

export async function saveSlot(slot, snapshot) {
  await mkdir(SAVE_DIR, { recursive: true });
  await writeFile(slotPath(slot), JSON.stringify({ savedAt: Date.now(), ...snapshot }, null, 2));
}

export async function loadSlot(slot) {
  const raw = await readFile(slotPath(slot), "utf8");
  return JSON.parse(raw);
}

export async function listSlots() {
  try {
    const files = await readdir(SAVE_DIR);
    return files.filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  } catch {
    return [];
  }
}
