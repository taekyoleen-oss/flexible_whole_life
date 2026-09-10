/**
 * 평문 수식(`l_{x+1}`, `v^{t+½}`, `S_t`)을 아래·위첨자 조각으로 나눈다.
 * `_`/`^` 뒤에 `{…}` 또는 영숫자 한 덩어리가 오면 첨자, 아니면 문자 그대로. 라이브러리 없이 <sub>/<sup>로 그린다.
 */
export type Seg = { kind: "text" | "sub" | "sup"; text: string };

const TOKEN = /^[A-Za-z0-9]+/;

export function parseFormula(s: string): Seg[] {
  const out: Seg[] = [];
  let buf = "", i = 0;
  const push = (kind: Seg["kind"], text: string) => { if (text) out.push({ kind, text }); };
  while (i < s.length) {
    const ch = s[i];
    if ((ch === "_" || ch === "^") && i + 1 < s.length) {
      let arg = "";
      if (s[i + 1] === "{") {
        const end = s.indexOf("}", i + 2);
        if (end > 0) { arg = s.slice(i + 2, end); i = end + 1; }
      } else {
        const m = TOKEN.exec(s.slice(i + 1));
        if (m) { arg = m[0]; i += 1 + arg.length; }
      }
      if (arg) { push("text", buf); buf = ""; push(ch === "_" ? "sub" : "sup", arg); continue; }
    }
    buf += ch; i++;
  }
  push("text", buf);
  return out;
}

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** 마크다운 문서용 HTML(<sub>/<sup>) */
export function formulaHtml(s: string): string {
  return parseFormula(s).map((x) => x.kind === "text" ? esc(x.text) : `<${x.kind}>${esc(x.text)}</${x.kind}>`).join("");
}
