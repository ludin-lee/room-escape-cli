import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateScenario } from "./validate.js";

export const SCENARIOS_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "scenarios");

/** 시나리오 디렉토리 이름 목록 */
export async function listScenarios() {
  const entries = await readdir(SCENARIOS_DIR, { withFileTypes: true });
  const ids = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  const result = [];
  for (const id of ids) {
    try {
      const s = await loadScenario(id);
      result.push({ id, title: s.title, timeLimitSec: s.timeLimitSec });
    } catch { /* 깨진 시나리오는 목록에서 제외 */ }
  }
  return result;
}

/** 시나리오 로드 + 검증. 실패하면 예외. */
export async function loadScenario(id) {
  const file = path.join(SCENARIOS_DIR, id, "scenario.json");
  const raw = await readFile(file, "utf8");
  const scenario = JSON.parse(raw);
  const errors = validateScenario(scenario);
  if (errors.length) {
    throw new Error(`시나리오 '${id}' 검증 실패:\n  - ${errors.join("\n  - ")}`);
  }
  return scenario;
}
