import { test } from "node:test";
import assert from "node:assert/strict";
import help from "../src/engine/commands/help.js";
import { ALIASES } from "../src/engine/parser.js";

test("도움말에 모든 별칭이 나온다", () => {
  const body = help()[0].body;
  for (const list of Object.values(ALIASES)) {
    for (const alias of list) assert.ok(body.includes(alias), `도움말에 '${alias}' 가 없다`);
  }
});
