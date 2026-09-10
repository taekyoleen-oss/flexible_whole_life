export type Sex = "M" | "F";

/** 연령 인덱스 배열(index = 나이). */
export interface RateSet { q: number[]; f: number[]; qStd: number[]; fStd: number[] }
export interface RateTable {
  meta: { name: string; source?: string; ages: [number, number]; terminal: Record<Sex, number> };
  M: RateSet;
  F: RateSet;
}

/** 산출 기초: 이율 + 연령별 사망률·납입면제율 */
export interface Basis { interest: number; q: number[]; f: number[] }

export interface ExpensesMethod {
  model: "method";
  alphaS: number;     // 신계약비 정액(기준보험금 비례)
  alphaP: number;     // 신계약비율(기준연납순보험료 비례)
  betaS: number;      // 유지비 정액(납입 1회당 /freq)
  betaG: number;      // 유지비율(영업보험료 비례)
  betaPrime: number;  // 납입 후 유지비 정액
  gamma: number;      // 수금비율
}
export interface ExpensesSimple { model: "simple"; alpha: number; beta: number; gamma: number }
export type Expenses = ExpensesMethod | ExpensesSimple;

/** 기준보험금 1단위 기준 계약 */
export interface Contract {
  age: number;
  termYears: number;  // n: 사망보장 t=0..n-1
  payYears: number;   // m
  freq: number;       // 연 납입 횟수(12)
  S: number[];        // 길이 n, 사망보장 배수
  C: number[];        // 길이 n+1, 시점 t 생존급부 배수
}

export interface Block { fromAge: number; toAge: number; multiple: number; kind: "death" | "celebration" }

export interface AssumptionSet {
  id: string; version: string; label: string;
  mortality: "kli7";
  interest: number; standardInterest: number;
  expenses: Expenses;
  waiver: boolean;
  lowSurrender: { ratio: number; premiumDiscount: number };  // 납입기간 중 환급금 비율, 보험료 인하율
  needs: { discount: number; livingRatio: number; selfRatio: number; educationPerChild: number; finalExpense: number; independenceAge: number; retirementAge: number };
}

export interface EngineInput {
  sex: Sex; age: number; payYears: number; freq?: number;
  S0: number;                 // 기준보험금(원)
  blocks: Block[];
  waiver?: boolean;           // 미지정 시 가정 세트 값
  lowSurrender?: boolean;
  termYears?: number;         // 미지정 시 ω − age (종신)
}
