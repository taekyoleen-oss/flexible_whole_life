import { childNeedCurve, debtNeedCurve, estateTaxCurve, groupGapRatio, inheritanceTax, needs, remainingPrincipal, retireNeed, type AssumptionSet, type EnvelopeParams, type PresetId, type RateTable } from "@/lib/engine";
import { roundS0, won } from "./format";
import type { Profile } from "./state";

/** 프리셋 하나의 조건 반영 결과: 목표 배수 곡선(표준 모양 대신 규칙에 맞춰 그려진다)과 근거 수치 */
export interface PresetNeeds {
  available: boolean;        // 조건이 갖춰졌는지(없으면 표준 모양)
  reason?: string;           // 갖춰지지 않은 이유
  target: number[];          // 길이 n, 필요액 / 기준액
  floor?: number;            // 프리셋 하한(상속준비형 0.2)
  baseNeed: number;          // 기준액(원): target = 1 인 필요액
  proposedS0: number;        // 기준보험금 제안(1천만원 단위)
  figures: [string, string][];   // 근거 팝업에 보여줄 계산 수치
}

const yr = (p: Profile, t: number) => `${p.age + t}세`;

/** 프리셋별 필요액 곡선. 공통 조건은 프로필 한 곳에서 오므로 어느 팝업에서 고쳐도 모두 반영된다 */
export function presetNeeds(id: PresetId, p: Profile, a: AssumptionSet, table: RateTable, n: number, env: EnvelopeParams, opts: { retirementAge?: number } = {}): PresetNeeds | null {
  const np = a.needs;
  const retireAt = opts.retirementAge ?? p.retirementAge;
  // 은퇴·단체 프리셋의 기준 필요액은 단체보험을 빼지 않는다(단체보험은 공백 비율 g 에서 한 번만 차감, 퇴직 후에는 사라진다)
  const preNeed = needs({ age: p.age, income: p.income, liquidAssets: p.liquidAssets, debt: p.debt, childrenAges: p.childrenAges, existingCover: p.termCover }, np).needs;
  const none = (reason: string): PresetNeeds => ({ available: false, reason, target: [], baseNeed: 0, proposedS0: 0, figures: [] });
  switch (id) {
    case "level": return null;
    case "child": {
      if (!p.childrenAges.length) return none("자녀 나이를 입력하세요");
      if (p.income <= 0) return none("연소득을 입력하세요(평준형 입력과 공통)");
      const raw = childNeedCurve({ income: p.income, childrenAges: p.childrenAges }, np, n);   // 부채는 부채상환형(또는 추가 조건)에서 따로 다룬다
      const off = p.liquidAssets + p.groupCover + p.termCover;   // 이미 있는 자산·보장은 곡선 전체에서 뺀다(비율로 줄이지 않는다)
      const c = raw.map((v) => Math.max(0, v - off));
      if (!(c[0] > 0)) return none("유동자산·기존 보장이 필요액보다 커서 추가 보장이 필요 없습니다");
      const kids = p.childrenAges.filter((x) => x < np.independenceAge).length;
      const youngest = Math.min(...p.childrenAges), tInd = Math.max(0, np.independenceAge - youngest);
      const living0 = raw[0] - kids * np.educationPerChild - np.finalExpense;
      const ti = Math.min(n - 1, tInd);
      return {
        available: true, target: c.map((v) => v / c[0]), baseNeed: c[0], proposedS0: roundS0(c[0]),
        figures: [
          [`유족 생활비 현가 (연소득 × ${Math.round(np.livingRatio * 100)}% × a(${tInd}년, ${np.discount * 100}%))`, won(Math.round(living0))],
          [`교육·결혼 자금 (독립 전 ${kids}명 × ${won(np.educationPerChild)})`, won(kids * np.educationPerChild)],
          ["정리자금", won(np.finalExpense)],
          ["− 유동자산·기존 보장", `−${won(off)}`],
          ["현재 필요액 (기준액 = 기준보험금 제안)", won(Math.round(c[0]))],
          [`막내 독립(${yr(p, tInd)}) 이후 필요액`, `${won(Math.round(c[ti]))} (${Math.round((c[ti] / c[0]) * 100)}%)`],
        ],
      };
    }
    case "debt": {
      if (p.debt <= 0) return none("부채 잔액을 입력하세요");
      const c = debtNeedCurve({ debt: p.debt, debtYears: p.debtYears, debtRate: p.debtRate, debtMethod: p.debtMethod }, np, n);
      const method = { annuity: "원리금균등", principal: "원금균등", bullet: "만기일시" }[p.debtMethod];
      const pay = p.debtMethod === "bullet" ? p.debt * p.debtRate : p.debtMethod === "principal" ? p.debt / p.debtYears + p.debt * p.debtRate : p.debtRate > 0 ? (p.debt * p.debtRate) / (1 - (1 + p.debtRate) ** -p.debtYears) : p.debt / p.debtYears;
      const pts = [5, 10, 15, 20].filter((t) => t < p.debtYears).map((t): [string, string] => [`${yr(p, t)} 잔액`, won(Math.round(remainingPrincipal(p.debt, p.debtRate, p.debtYears, t, p.debtMethod)))]);
      return {
        available: true, target: c.map((v) => v / c[0]), baseNeed: c[0], proposedS0: roundS0(c[0]),
        figures: [
          [`대출 ${won(p.debt)} · ${method} · 금리 ${(p.debtRate * 100).toFixed(1)}% · 만기 ${p.debtYears}년`, `첫해 상환액 약 ${won(Math.round(pay))}`],
          ...pts,
          [`만기(${yr(p, p.debtYears)}) 이후 필요액`, `정리자금 ${won(np.finalExpense)}`],
          ["현재 필요액 (기준액 = 잔액 + 정리자금)", won(c[0])],
        ],
      };
    }
    case "retire": {
      const base = preNeed > 0 ? preNeed : 1e8;
      const r = retireNeed({ age: p.age, retirementAge: retireAt, hasSpouse: p.hasSpouse, spouseSex: p.sex === "M" ? "F" : "M", spouseAge: p.spouseAge, livingMonthly: p.livingMonthly, retireAssets: p.retireAssets, preNeed: base }, np, table);
      const tRet = Math.max(0, retireAt - p.age);
      return {
        available: true, target: Array.from({ length: n }, (_, t) => (t >= tRet ? r.ratio : 1)), baseNeed: base, proposedS0: roundS0(base),
        figures: [
          [`은퇴 전 필요액 (니즈${preNeed > 0 ? "" : " 없음 → 1억 가정"})`, won(base)],
          ...(p.hasSpouse ? [[`은퇴(${retireAt}세) 시 배우자 나이 · 기대여명`, `${r.spouseAgeAtRetire}세 · ${r.expectancy.toFixed(1)}년`], [`배우자 생활비 현가 (월 ${won(p.livingMonthly)} × 12 × a(${Math.round(r.expectancy)}년))`, won(Math.round(r.living))]] as [string, string][] : [["배우자", "없음 → 정리자금만"] as [string, string]]),
          ["정리자금", won(np.finalExpense)], ["− 은퇴 자산(연금·퇴직금 현가)", `−${won(p.retireAssets)}`],
          ["은퇴 후 필요액", won(Math.round(r.post))],
          ["은퇴 후 배수 R = 은퇴 후 ÷ 은퇴 전", `${r.ratio.toFixed(2)}배${r.ratio > env.maxMultiple ? ` (상한 ${env.maxMultiple}배)` : ""}`],
        ],
      };
    }
    case "group": {
      if (p.groupCover <= 0) return none("단체보험 보험금을 입력하세요(평준형 입력과 공통)");
      const base = preNeed > 0 ? preNeed : 1e8;
      const g = groupGapRatio(p.groupCover, base);
      const tRet = Math.max(0, retireAt - p.age);
      return {
        available: true, target: Array.from({ length: n }, (_, t) => (t >= tRet ? 1 : g)), baseNeed: base, proposedS0: roundS0(base),
        figures: [
          [`필요액 (니즈, 단체보험 차감 전${preNeed > 0 ? "" : " · 없음 → 1억 가정"})`, won(base)], ["단체보험 보험금 (재직 중)", won(p.groupCover)],
          ["재직 중 개인 보장 비율 g = 1 − 단체 ÷ 필요액", `${Math.round(g * 100)}%${g < env.minMultiple ? ` (하한 ${env.minMultiple * 100}%)` : ""}`],
          [`퇴직(${retireAt}세) 후`, "단체보험 소멸 → 100%"],
        ],
      };
    }
    case "estate": {
      if (p.netAssets <= 0) return none("순자산을 입력하세요");
      const kids = p.childrenAges.length;
      const c = estateTaxCurve({ netAssets: p.netAssets, assetGrowth: p.assetGrowth, hasSpouse: p.hasSpouse, children: kids }, n);
      const tRef = Math.min(n - 1, Math.max(0, env.growthEndAge - p.age));
      const ref = c[tRef];
      if (ref <= 0) return none(`증액 종료 연령(${env.growthEndAge}세)까지 상속세가 없습니다 (공제 ${won(inheritanceTax(p.netAssets, p.hasSpouse, kids).deduction)})`);
      const now = inheritanceTax(p.netAssets, p.hasSpouse, kids);
      return {
        available: true, target: c.map((v) => v / ref), floor: env.minMultiple, baseNeed: ref, proposedS0: roundS0(ref),
        figures: [
          [`순자산 ${won(p.netAssets)} · 증가율 ${(p.assetGrowth * 100).toFixed(1)}% · 배우자 ${p.hasSpouse ? "있음" : "없음"} · 자녀 ${kids}명`, `공제 ${won(now.deduction)}`],
          ["현재 상속세", won(Math.round(now.tax))],
          [`${env.growthEndAge}세 자산 · 상속세 (기준액)`, `${won(Math.round(p.netAssets * (1 + p.assetGrowth) ** tRef))} · ${won(Math.round(ref))}`],
          ["현재 ÷ 기준액", `${Math.round((c[0] / ref) * 100)}% (하한 ${env.minMultiple * 100}%)`],
        ],
      };
    }
  }
}
