// lib/formulas.json → docs/산출수식_설명.md. 앱의 "?" 팝업과 같은 원본을 쓴다.
import { readFileSync, writeFileSync } from "node:fs";
import { formulaHtml } from "../lib/formula-text.ts";   // Node 22.18+ 타입 제거 실행

const formulas = JSON.parse(readFileSync("lib/formulas.json", "utf8"));
const groups = [...new Set(formulas.map((f) => f.group))];
const lines = [
  "# 설계형 종신보험 산출 수식 설명",
  "",
  "앱의 각 숫자 옆 \"?\" 버튼이 보여주는 설명과 같은 내용입니다. 원본은 `lib/formulas.json`이며 `node scripts/build-formula-doc.mjs`로 이 문서를 다시 만듭니다.",
  "",
  formulaHtml("기호: x 가입연령, t 경과년, n 보장기간(최종연령 − x), m 납입기간, S_t 사망보험금 배수, C_t 축하금 배수, S_0 기준보험금(원), v = 1/(1+예정이율). 계산기수(D, N, C)는 라딕스 100,000 기준이며 ′ 표시는 납입면제를 반영한 납입 집단 기준입니다."),
  "",
  "## 차례",
  ...groups.map((g) => `- ${g}: ${formulas.filter((f) => f.group === g).map((f) => formulaHtml(f.title)).join(" · ")}`),
  "",
];
for (const g of groups) {
  lines.push(`## ${g}`, "");
  for (const f of formulas.filter((x) => x.group === g)) {
    lines.push(`### ${formulaHtml(f.title)}`, "", `<pre>${formulaHtml(f.formula)}</pre>`, "", formulaHtml(f.meaning), "");
    if (f.vars.length) { lines.push("| 기호 | 뜻 |", "|---|---|", ...f.vars.map(([k, v]) => `| ${formulaHtml(k)} | ${v} |`), ""); }
    lines.push(`**앱에서:** ${f.where}`, "");
  }
}
lines.push("## 검증", "", "엔진은 워크북 원본 정답값(G1 정기 31세 10만원당 133원, G2 종신공제 59세 2,875원)과 준비금·해약환급금을 1원 단위로 재현하는 골든 테스트를 통과합니다. 설정 화면의 '검산'에서 G1을 언제든 확인할 수 있습니다.", "");
writeFileSync("docs/산출수식_설명.md", lines.join("\n"));
console.log(`docs/산출수식_설명.md: ${formulas.length} formulas, ${groups.length} groups`);
