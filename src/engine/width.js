/** 터미널 표시 폭. 한글·CJK·이모지는 2칸, 제어·결합 문자는 0칸. */
export function displayWidth(str) {
  let w = 0;
  for (const ch of str) {
    const cp = ch.codePointAt(0);
    if (cp < 0x20 || (cp >= 0x7f && cp < 0xa0)) continue;
    if (cp >= 0x300 && cp <= 0x36f) continue;
    w += isWide(cp) ? 2 : 1;
  }
  return w;
}

function isWide(cp) {
  return (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3)
    || (cp >= 0xf900 && cp <= 0xfaff) || (cp >= 0xfe30 && cp <= 0xfe4f) || (cp >= 0xff00 && cp <= 0xff60)
    || (cp >= 0xffe0 && cp <= 0xffe6) || (cp >= 0x1f300 && cp <= 0x1faff) || (cp >= 0x20000 && cp <= 0x3fffd);
}

/** 표시 폭 기준 오른쪽 공백 채우기 */
export function padEndWidth(str, width) {
  return str + " ".repeat(Math.max(0, width - displayWidth(str)));
}
