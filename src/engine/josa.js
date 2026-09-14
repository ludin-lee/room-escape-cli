/** 한글 받침 유무에 따라 조사를 고른다. josa("열쇠", "을/를") → "열쇠를" */
export function josa(word, pair) {
  const [withBatchim, without] = pair.split("/");
  const code = word.codePointAt(word.length - 1);
  const isHangul = code >= 0xac00 && code <= 0xd7a3;
  if (!isHangul) return `${word}${without}`;
  return (code - 0xac00) % 28 === 0 ? `${word}${without}` : `${word}${withBatchim}`;
}
