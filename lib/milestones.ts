import { assumptionOf, endAgeOf, envelopeOf, presetContext, type DesignState } from "./state";

/** 그래프에 표시할 주요 시점: 프리셋의 근거가 되는 연령(자녀 독립·은퇴·대출 종료 등)과 추가 조건의 종료 시점 */
export interface Milestone { age: number; label: string; kind: "preset" | "addon"; anchor?: "start" }

export function milestones(s: DesignState): Milestone[] {
  const p = s.profile, x0 = p.age, end = endAgeOf(p);
  const id = s.presetId !== "custom" ? s.presetId : s.basePresetId;
  const c = presetContext(p, envelopeOf(s), s.infoApplied, assumptionOf(s));
  const indep = assumptionOf(s).needs.independenceAge;
  const out: Milestone[] = [];
  const push = (age: number, label: string, kind: Milestone["kind"] = "preset", anchor?: "start") => { if (age >= x0 && age <= end) out.push({ age, label, kind, anchor }); };
  const std = (flag: boolean) => (flag ? "" : " (표준)");
  switch (id) {
    case "child": {
      const applied = s.infoApplied.child && p.childrenAges.length > 0;
      const youngest = c.youngestChildAge ?? 5;
      push(x0, applied ? `가입 · 자녀 ${[...p.childrenAges].sort((a, b) => a - b).join("·")}세` : `가입 · 막내 ${youngest}세 가정`, "preset", "start");
      if (applied) {
        const ages = [...new Set(p.childrenAges)].sort((a, b) => b - a);   // 나이 많은 자녀부터 독립
        ages.forEach((ca) => push(x0 + Math.max(0, indep - ca), ca === Math.min(...p.childrenAges) ? `막내 독립 ${indep}세` : `자녀(${ca}세) 독립`));
      } else push(x0 + Math.max(0, indep - youngest), `막내 독립 ${indep}세${std(false)}`);
      break;
    }
    case "debt": push(x0 + (c.debtYears ?? 20), `대출 종료${std(s.infoApplied.debt && p.debt > 0)}`); break;
    case "retire": push(c.retirementAge ?? 65, `은퇴 ${c.retirementAge ?? 65}세${std(s.infoApplied.retire)}`); break;
    case "group": push(c.groupCoverEndAge ?? 65, `퇴직 ${c.groupCoverEndAge ?? 65}세 · 단체보험 종료${std(s.infoApplied.retire)}`); break;
    case "estate": push(c.growthEndAge ?? 70, `증액 종료 ${c.growthEndAge ?? 70}세 · 상속세 기준`); break;
    default: break;
  }
  for (const a of s.addons) {
    if (a.merged) continue;
    if (a.kind === "education") push(x0 + Math.max(0, indep - (a.childAge ?? indep)), `자녀 독립(추가 · ${a.childAge}세)`, "addon");
    else if (a.kind === "loan") push(x0 + a.years, "대출 종료(추가)", "addon");
    else push(x0 + a.years, "정액 종료(추가)", "addon");
  }
  return out;
}
