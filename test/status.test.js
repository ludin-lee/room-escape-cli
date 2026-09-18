import { test } from "node:test";
import assert from "node:assert/strict";
import { renderStatus, displayWidth } from "../src/ui/status.js";

test("displayWidth: 한글은 2칸, 영문은 1칸", () => {
  assert.equal(displayWidth("abc"), 3);
  assert.equal(displayWidth("욕실"), 4);
  assert.equal(displayWidth("a욕b"), 4);
});

test("renderStatus: 다섯 줄이 모두 지정한 폭에 맞는다", () => {
  for (const width of [40, 60, 100]) {
    const lines = renderStatus({
      title: "직쏘의 게임", room: "냉동창고", visible: ["온도계", "23번상자"], items: ["철사", "족쇄열쇠", "토치"],
      remainingMs: 1234_000, remainingText: "20:34", width, color: false,
    });
    assert.equal(lines.length, 5);
    for (const l of lines) assert.equal(displayWidth(l), width, JSON.stringify(l));
    assert.match(lines[0], /직쏘의 게임/);
    assert.match(lines[1], /냉동창고/);
    assert.match(lines[1], /20:34/);
    assert.match(lines[2], /온도계, 23번상자/);
    assert.match(lines[3], /철사, 족쇄열쇠, 토치/);
  }
});

test("renderStatus: 긴 가방 목록은 잘리고, 빈 가방은 표시된다", () => {
  const items = Array.from({ length: 30 }, (_, i) => `아이템${i}`);
  const lines = renderStatus({ title: "t", room: "r", items, remainingMs: 0, remainingText: "00:00", width: 40, color: false });
  assert.equal(displayWidth(lines[3]), 40);
  assert.match(lines[3], /…/);
  const empty = renderStatus({ title: "t", room: "r", items: [], remainingMs: 0, remainingText: "00:00", width: 40, color: false });
  assert.match(empty[2], /없음/);
  assert.match(empty[3], /비어 있음/);
});

test("renderStatus: 색상이 켜져도 보이는 폭은 같다", () => {
  const lines = renderStatus({ title: "t", room: "욕실", items: ["철사"], remainingMs: 30_000, remainingText: "00:30", width: 50, color: true });
  const strip = (s) => s.replace(/\x1b\[[0-9;]*m/g, "");
  for (const l of lines) assert.equal(displayWidth(strip(l)), 50);
});
