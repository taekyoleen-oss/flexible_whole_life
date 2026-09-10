import data from "./formulas.json";

/** 앱의 "?" 팝업과 docs/산출수식_설명.md가 같이 쓰는 수식 설명 */
export interface Formula {
  id: string;
  group: string;        // 기초·보험료·설계·준비금·추천·비교·검증·재설계
  title: string;
  formula: string;      // 평문 수식(줄바꿈 가능)
  meaning: string;      // 무엇을 뜻하는지
  vars: [string, string][];
  where: string;        // 앱 어디에 쓰이는지
}

export const FORMULAS = data as Formula[];
export type FormulaId = (typeof data)[number]["id"];

export function getFormula(id: FormulaId): Formula {
  const f = FORMULAS.find((x) => x.id === id);
  if (!f) throw new Error(`formula ${id} not found`);
  return f;
}
