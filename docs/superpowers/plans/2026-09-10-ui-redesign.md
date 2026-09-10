# 재설계 모드 구현 계획 (2차 · `/redesign`)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 이미 가입한 계약(원계약)의 준비금·미래 보험료를 예산으로 새 보험금 스케줄을 설계한다. 예산 모드 3종(납입 지속·감액·납입 중단), 규칙 R01~R03 검사, 기초율 차이로 생기는 전환 손실 표시, 비교(유지·감액완납·해지·재설계), 보관함 저장·복원.

**Architecture:** 엔진에 `redesign()`을 추가한다. 재설계 계약은 "재설계 시점 연령에서 시작하는 신계약비 없는 계약"으로 보고, 이월 금액(준비금 또는 해약환급금)이 사는 완납 부분과 앞으로 낼 보험료가 사는 부분을 같은 스케줄 모양으로 합쳐 기준보험금을 역산한다. 준비금은 순보식 전향 공식이라 이월분이 자연히 들어간다. 화면은 중첩 `DesignProvider`(persist=false)로 기존 스케줄 편집기를 그대로 쓰고, 기준보험금만 예산에서 역산해 동기화한다.

**Tech Stack:** 기존과 동일. 새 의존성 없음.

**결정 (2026-09-10 인터뷰, 계획서 v0.7 §0.9):** 원계약 입력은 세 가지(현재 설계 + 경과년 / 보관함 항목 / 직접 입력) · 예산 모드 3종 · 새 스케줄은 현재 가정 세트로 산출하고 R01은 원계약 기초율로 검사, 손실 표시 · 비교안은 유지·감액완납·해지·재설계(연장정기는 다음).

**자체 결정:** 재설계 계약에는 신계약비를 부과하지 않는다(α=0, 해약공제 0) · 이월분에 대한 납입후유지비는 준비금에 포함해 보수적으로 둔다 · R02는 재설계 후 5년 동안 새 보험금이 원계약 보험금을 넘지 않는지 금액으로 검사하고, 편집기의 초기 고정 5년(E01)이 그 기간의 변경도 막는다 · R03은 보관함의 `redesignedAt`으로 1년 이내 재설계를 경고만 한다 · 재설계 결과는 보관함에 `redesign` 메타와 함께 저장하고, 열면 `/redesign?id=`로 복원한다(일반 설계로 열면 신계약비가 붙어 값이 달라지므로) · 재설계 기준보험금은 1천만원 단위로 반올림하지 않는다(예산이 정하는 값이므로 `S0` 액션에 `exact` 플래그).

**실행 환경 주의:** RTK 훅 때문에 vitest는 `./node_modules/.bin/vitest run --reporter=default > "$TMPDIR/vt.txt" 2>&1; grep -E "Test Files|Tests |FAIL|×" "$TMPDIR/vt.txt"` 로 읽는다. 파일은 Write/Edit 도구로 쓴다. eslint는 `./node_modules/.bin/eslint`.

---

## 산식 (엔진 `redesign`)

기호: 재설계 시점 연령 x, 남은 보장기간 n = ω − x, 남은 납입기간 m, 월 영업보험료 G(원), 이월 금액 K(원), 새 스케줄 배수 S_t·C_t (x 기준, S_0 = 1), 사업비 e에서 신계약비 항을 0으로 둔 e′.

1. 계산기수 k = commutation(현재 가정 이율, x, n). 1단위당 `premium(k, c, e′)` → 급부 현가 PVB(radix), 순보험료 P, 영업보험료 P_G(α 없음), 준비금용 P_β.
2. 1단위 완납 순보험료 π = PVB / Dx_0.
3. 이월분 기준보험금 S_K = K / π, 보험료분 S_G = G / P_G (G = 0이면 0). **S_0 = S_K + S_G**, 보험료 분담 비율 f = S_G / S_0.
4. 준비금: `reserves(k, c, e′, {…p, pBeta: f·P_β})` → V_t(1단위당). f·P_β 만 미래 보험료로 들어오므로 V_0·S_0 ≈ K (β′=0이면 정확히 같다).
5. 해약환급금 = 준비금(해약공제 없음), 납입 누계 = min(t, m)·12·G.
6. R01(기초율 차익 방지): 원계약 기초율 i₀로 새 급부 현가 S_0·π₀(신 스케줄) ≤ 이월액 K + 미래 순보험료 현가 (월 순보험료 × ä₀), ä₀ = N*₀(m)/Dx_0. 같은 기초율이면 등식으로 통과하고, 현재 이율이 원계약보다 낮으면 여유 있게 통과하며, 현재 이율이 더 높으면(새 기초율로 싸게 산 보장) 위반이 된다. 신계약비를 다시 받지 않으므로 급부 현가끼리 비교하면 항상 위반이 되어 이렇게 정의한다.
7. 전환 손실 = S_0^구·[π(남은 구 스케줄, 현재 이율) − π(남은 구 스케줄, i₀)] (양수면 현재 기초율이 불리).
8. 예산 모드: 지속 → K = V_t^구, G = G^구, m = m^구 − t · 감액 → K = V_t^구, G = 입력(≤ G^구) · 중단 → K = W_t^구(해약환급금), G = 0.

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/engine/redesign.ts` (신규), `lib/engine/index.ts` (수정) | `redesign()`, `pvUnit()`, `noAcquisition()` |
| `tests/engine/redesign.test.ts` (신규) | 자기일관성·완납·규칙·손실 테스트 |
| `lib/state.ts` (수정) | `S0` 액션 `exact` 플래그 |
| `lib/redesign.ts` (신규) | 원계약 모델(`OldContract`), 현재 설계·직접 입력에서 만들기, 남은 스케줄, 예산 모드, 규칙 검사, 비교안 |
| `tests/ui/redesign.test.ts` (신규) | 원계약 변환·예산·규칙·비교 테스트 |
| `lib/library.ts` (수정) | `LibraryEntry.redesign?` 메타 |
| `components/redesign/old-contract-form.tsx` (신규) | 원계약 입력(세 가지 소스) |
| `components/redesign/budget-mode.tsx` (신규) | 예산 모드 3종 |
| `components/redesign/redesign-canvas.tsx` (신규) | 중첩 Provider 안: 편집기·축하금·결과·규칙·비교·저장 |
| `app/redesign/page.tsx` (신규) | 조립, `?id=` 복원 |
| `components/library-panel.tsx`, `components/canvas/design-toolbar.tsx`, `app/layout.tsx` (수정) | 재설계 항목 표시·진입 |
| `docs/…계획서.md`, `README.md` (수정) | v0.7 §0.9 |

---

### Task 1: 엔진 `redesign()`

**Files:**
- Create: `lib/engine/redesign.ts`
- Modify: `lib/engine/index.ts`
- Test: `tests/engine/redesign.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/engine/redesign.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import kli7 from "@/lib/engine/data/rates-kli7.json";
import { ASSUMPTIONS, compute, pvUnit, redesign, type AssumptionSet, type RateTable } from "@/lib/engine";

const table = kli7 as RateTable;
const a0 = ASSUMPTIONS[0];
const noExp: AssumptionSet = { ...a0, expenses: { model: "simple", alpha: 0, beta: 0, gamma: 0 } };
const level = (from: number, to: number) => [{ fromAge: from, toAge: to, multiple: 1, kind: "death" as const }];

describe("redesign — 자기일관성", () => {
  // 원계약: 40세 남 1억 평준 20년납. 10년 뒤(50세) 준비금 + 같은 보험료로 같은 스케줄을 다시 사면 같은 보험금이 나와야 한다 (사업비 0)
  const old = compute({ sex: "M", age: 40, payYears: 20, S0: 1e8, blocks: level(40, 109), waiver: false }, noExp, table);
  const t = 10, carry = old.reserve100k[t] * old.units;
  it("납입 지속: 준비금 이월 + 같은 보험료 → 기준보험금 ≈ 1억 (10만원당 반올림 때문에 0.5% 이내)", () => {
    const r = redesign({ sex: "M", attainedAge: 50, carry, monthlyGross: old.monthly.gross, payYears: 10, blocks: level(50, 109), waiver: false }, noExp, table);
    expect(r.S0 / 1e8).toBeCloseTo(1, 2);
    expect(r.monthly.gross).toBeCloseTo(old.monthly.gross, -1);
    expect(r.reserve100k[0] * r.units).toBeCloseTo(carry, -2);   // 시점 0 준비금 = 이월액
    expect(r.cash[0]).toBe(r.reserve100k[0] * r.units);          // 해약공제 없음
  });
  it("납입 중단(감액완납): 이월액만으로 사는 보험금, 보험료 0", () => {
    const r = redesign({ sex: "M", attainedAge: 50, carry, monthlyGross: 0, payYears: 10, blocks: level(50, 109), waiver: false }, noExp, table);
    expect(r.monthly.gross).toBe(0);
    expect(r.fundedByCarry).toBe(1);
    expect(r.S0).toBeCloseTo(carry / pvUnit({ sex: "M", age: 50, blocks: level(50, 109), waiver: false }, noExp.interest, table), 6);
    expect(r.S0).toBeLessThan(1e8);
    expect(r.paid[20]).toBe(0);
  });
  it("이월액 0·보험료 0이면 기준보험금 0, 계산이 깨지지 않는다", () => {
    const r = redesign({ sex: "M", attainedAge: 50, carry: 0, monthlyGross: 0, payYears: 0, blocks: level(50, 109), waiver: false }, a0, table);
    expect(r.S0).toBe(0);
    expect(r.reserve100k.every(Number.isFinite)).toBe(true);
  });
  it("신계약비가 붙지 않는다: 사업비 있는 세트에서도 t=0 준비금 ≈ 이월액이고 해약공제가 없다", () => {
    const oldE = compute({ sex: "M", age: 40, payYears: 20, S0: 1e8, blocks: level(40, 109) }, a0, table);
    const K = oldE.reserve100k[10] * oldE.units;
    const r = redesign({ sex: "M", attainedAge: 50, carry: K, monthlyGross: oldE.monthly.gross, payYears: 10, blocks: level(50, 109), waiver: true }, a0, table);
    expect(r.reserve100k[0] * r.units).toBeGreaterThanOrEqual(K * 0.999);
    expect(r.reserve100k[0] * r.units).toBeLessThan(K * 1.06);   // 이월분의 납입후유지비 β′ 몫만큼만 위
    expect(r.cash[1]).toBe(r.reserve100k[1] * r.units);
  });
});

describe("pvUnit — 기초율 차이", () => {
  it("이율이 낮을수록 1단위 급부 현가가 크다", () => {
    const hi = pvUnit({ sex: "M", age: 50, blocks: level(50, 109), waiver: false }, 0.034, table);
    const lo = pvUnit({ sex: "M", age: 50, blocks: level(50, 109), waiver: false }, 0.025, table);
    expect(lo).toBeGreaterThan(hi);
    expect(hi).toBeGreaterThan(0); expect(hi).toBeLessThan(1);
  });
});
```

- [ ] **Step 2: 실패 확인** — 테스트 실행 → `redesign` export 없음.

- [ ] **Step 3: 구현**

`lib/engine/redesign.ts`:
```ts
import { commutation } from "./commutation";
import { premium, pvBenefit } from "./premium";
import { reserves } from "./reserve";
import { expandBlocks } from "./schedule";
import type { AssumptionSet, Block, Contract, Expenses, RateTable, Sex } from "./types";

export interface RedesignInput {
  sex: Sex;
  attainedAge: number;     // 재설계 시점 연령
  carry: number;           // 이월 금액(원): 지속·감액 = 준비금, 중단 = 해약환급금
  monthlyGross: number;    // 앞으로 낼 월 영업보험료(원). 0이면 완납형
  payYears: number;        // 남은 납입기간(년)
  blocks: Block[];         // 재설계 스케줄(attainedAge 기준 배수, S_0 = 1)
  waiver: boolean;
}

export interface RedesignResult {
  n: number; S: number[]; C: number[];
  S0: number; units: number;
  fundedByCarry: number;                  // 기준보험금 중 이월분 비율 0..1
  monthly: { net: number; gross: number };
  totalPaid: number;
  per100k: { net: number; gross: number };
  reserve100k: number[];                  // 이월분 포함 연말 준비금(10만원당)
  cash: number[]; paid: number[]; rate: number[];
  pvbUnit: number;                        // 1단위 급부의 완납 순보험료 π (현재 기초율)
}

/** 재설계 계약에는 신계약비를 부과하지 않는다 */
export const noAcquisition = (e: Expenses): Expenses => (e.model === "method" ? { ...e, alphaS: 0, alphaP: 0 } : { ...e, alpha: 0 });

/** 1단위 급부의 완납 순보험료 π = PVB / Dx_0 (연령 x에서 시작하는 스케줄, 이율 i) */
export function pvUnit(c: { sex: Sex; age: number; blocks: Block[]; waiver: boolean }, interest: number, table: RateTable): number {
  const rs = table[c.sex], n = table.meta.terminal[c.sex] - c.age;
  const zero = new Array<number>(rs.q.length).fill(0);
  const k = commutation({ interest, q: rs.q, f: c.waiver ? rs.f : zero }, c.age, n);
  const { S, C } = expandBlocks(c.blocks, c.age, n);
  return pvBenefit(k, S, C) / k.Dx[0];
}

export function redesign(input: RedesignInput, a: AssumptionSet, table: RateTable): RedesignResult {
  const rs = table[input.sex];
  const n = table.meta.terminal[input.sex] - input.attainedAge, freq = 12;
  const zero = new Array<number>(rs.q.length).fill(0);
  const { S, C } = expandBlocks(input.blocks, input.attainedAge, n);
  const m = Math.min(Math.max(Math.round(input.payYears), 0), n);
  const paying = input.monthlyGross > 0 && m > 0;
  const c: Contract = { age: input.attainedAge, termYears: n, payYears: paying ? m : 1, freq, S, C };   // premium()은 m ≥ 1 필요
  const e = noAcquisition(a.expenses);
  const k = commutation({ interest: a.interest, q: rs.q, f: input.waiver ? rs.f : zero }, input.attainedAge, n);
  const p = premium(k, c, e);
  const pvbUnit = p.pvb / k.Dx[0];
  const S0carry = pvbUnit > 0 ? input.carry / pvbUnit : 0;
  const S0prem = paying && p.gross > 0 ? input.monthlyGross / p.gross : 0;
  const S0 = S0carry + S0prem;
  const f = S0 > 0 ? S0prem / S0 : 0;
  const pAdj = { ...p, net: p.net * f, pBeta: p.pBeta * f, gross: p.gross * f };
  const V = reserves(k, c, e, pAdj);
  const r0 = (x: number) => Math.round(x * 1e5);
  const units = S0 / 1e5;
  const per100k = { net: r0(pAdj.net), gross: r0(pAdj.gross) };
  const reserve100k = V.map(r0);
  const cash = reserve100k.map((v) => v * units);
  const paid = cash.map((_, t) => Math.min(t, paying ? m : 0) * freq * per100k.gross * units);
  const rate = cash.map((w, t) => (paid[t] > 0 ? w / paid[t] : 0));
  return {
    n, S, C, S0, units, fundedByCarry: 1 - f,
    monthly: { net: per100k.net * units, gross: per100k.gross * units },
    totalPaid: paid[n], per100k, reserve100k, cash, paid, rate, pvbUnit,
  };
}
```
`lib/engine/index.ts`에 `export { redesign, pvUnit, noAcquisition, type RedesignInput, type RedesignResult } from "./redesign";` 추가.

- [ ] **Step 4: 통과 확인** — 테스트 4+1개 통과. 자기일관성이 0.5%를 벗어나면 `paying ? m : 1`과 `pAdj.pBeta`(f 곱)를 확인.

- [ ] **Step 5: 커밋** — `git add lib/engine tests/engine/redesign.test.ts && git commit -m "feat(engine): redesign() — carry-funded schedule without acquisition cost"`

---

### Task 2: 원계약 모델·예산·규칙·비교 (`lib/redesign.ts`) + `S0 exact`

**Files:**
- Modify: `lib/state.ts`, `lib/library.ts`
- Create: `lib/redesign.ts`
- Test: `tests/ui/redesign.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/ui/redesign.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import { budgetFor, checkRules, compareOptions, conversionLoss, fromDesign, fromManual, newDesignFor, remainingBlocks, runRedesign, type OldContract } from "@/lib/redesign";
import { initialState, levels, reducer, DEFAULT_SETTINGS } from "@/lib/state";

const design = reducer(reducer(initialState(), { type: "level", age: 50, multiple: 1.5 }), { type: "addCelebration", age: 65 });   // 40세 남 1억, 50세부터 1.5배

describe("원계약", () => {
  it("현재 설계 + 경과년 10 → 50세 원계약, 남은 스케줄은 50세 보험금(1.5억)을 1로 정규화", () => {
    const old = fromDesign(design, 10);
    expect(old).toMatchObject({ sex: "M", entryAge: 40, elapsed: 10, attainedAge: 50, S0: 1e8, payYears: 20, interest: 0.025 });
    expect(old.benefitNow).toBe(1.5e8);
    const rem = remainingBlocks(old);
    expect(rem.filter((b) => b.kind === "death")[0]).toMatchObject({ fromAge: 50, multiple: 1 });
    expect(rem.some((b) => b.kind === "celebration" && b.fromAge === 65)).toBe(true);
    expect(old.reserve).toBeGreaterThan(0); expect(old.cash).toBeGreaterThan(0); expect(old.cash).toBeLessThanOrEqual(old.reserve);
    expect(old.monthlyGross).toBeGreaterThan(0);
  });
  it("직접 입력: 평준 보험금·예정이율 3.5%, 준비금 직접 지정", () => {
    const old = fromManual({ sex: "F", entryAge: 35, benefit: 2e8, payYears: 20, elapsed: 12, interest: 0.035, reserve: 3e7, cash: 2.5e7 }, DEFAULT_SETTINGS);
    expect(old).toMatchObject({ attainedAge: 47, S0: 2e8, benefitNow: 2e8, interest: 0.035, reserve: 3e7, cash: 2.5e7 });
    expect(remainingBlocks(old).filter((b) => b.kind === "death")).toEqual([{ fromAge: 47, toAge: 111, multiple: 1, kind: "death" }]);
  });
});

describe("예산 모드", () => {
  const old = fromDesign(design, 10);
  it("지속 = 준비금 + 같은 보험료 + 남은 10년, 감액 = 낮춘 보험료, 중단 = 환급금 + 0", () => {
    expect(budgetFor(old, "continue")).toMatchObject({ carry: old.reserve, monthlyGross: old.monthlyGross, payYears: 10 });
    expect(budgetFor(old, "reduce", 100000)).toMatchObject({ carry: old.reserve, monthlyGross: 100000, payYears: 10 });
    expect(budgetFor(old, "stop")).toMatchObject({ carry: old.cash, monthlyGross: 0, payYears: 0 });
  });
  it("납입이 이미 끝난 원계약은 지속 모드도 보험료 0", () => {
    expect(budgetFor(fromDesign(design, 25), "continue")).toMatchObject({ monthlyGross: 0, payYears: 0 });
  });
});

describe("규칙·손실·비교", () => {
  const old = fromDesign(design, 10);
  const nd = newDesignFor(old, design.settings);   // 중첩 편집기 초기 상태(50세, 남은 스케줄)
  it("새 설계 초기 상태: 50세, custom, 변경점 없음, 설정 승계", () => {
    expect(nd.profile.age).toBe(50); expect(nd.presetId).toBe("custom"); expect(nd.anchors).toEqual([]);
    expect(levels(nd)[0]).toBe(1);
  });
  it("지속 모드 그대로면 R01(등식)·R02 통과, 손실은 같은 기초율이라 0", () => {
    const r = runRedesign(old, budgetFor(old, "continue"), nd, design.settings);
    const rules = checkRules(old, nd, r, null);
    expect(rules.find((x) => x.code === "R01")?.ok).toBe(true);
    expect(rules.find((x) => x.code === "R02")?.ok).toBe(true);
    expect(rules.find((x) => x.code === "R03")?.ok).toBe(true);
    expect(Math.abs(conversionLoss(old, design.settings))).toBeLessThan(1);
  });
  it("재설계 직후 5년 안에 보험금을 올리면 R02 위반, 1년 안에 또 하면 R03 경고", () => {
    const up = { ...nd, blocks: [{ fromAge: 50, toAge: 52, multiple: 1, kind: "death" as const }, { fromAge: 53, toAge: 109, multiple: 1.2, kind: "death" as const }] };
    const r = runRedesign(old, budgetFor(old, "continue"), up, design.settings);
    const rules = checkRules(old, up, r, Date.now() - 100 * 86400e3);
    expect(rules.find((x) => x.code === "R02")?.ok).toBe(false);
    expect(rules.find((x) => x.code === "R03")?.ok).toBe(false);
  });
  it("원계약 이율이 현재보다 높으면 전환 손실 > 0, 현재 이율이 더 높으면 R01 위반(기초율 차익)", () => {
    const oldHi: OldContract = { ...old, interest: 0.035 };
    expect(conversionLoss(oldHi, design.settings)).toBeGreaterThan(0);
    const hiNow = { ...design.settings, assumption: { ...design.settings.assumption, interest: 0.035 } };
    const oldLo: OldContract = { ...old, interest: 0.025 };
    const r = runRedesign(oldLo, budgetFor(oldLo, "continue"), nd, hiNow);
    expect(checkRules(oldLo, nd, r, null).find((x) => x.code === "R01")?.ok).toBe(false);
  });
  it("비교안 4개: 유지·감액완납·해지·재설계, 해지는 환급금", () => {
    const r = runRedesign(old, budgetFor(old, "continue"), nd, design.settings);
    const rows = compareOptions(old, r, design.settings);
    expect(rows.map((x) => x.id)).toEqual(["keep", "paidup", "surrender", "redesign"]);
    expect(rows[2].cashNow).toBe(old.cash);
    expect(rows[1].monthly).toBe(0);
    expect(rows[1].benefitNow).toBeLessThan(rows[0].benefitNow);
    expect(rows[3].benefitNow).toBeGreaterThan(rows[0].benefitNow * 0.97);   // 신계약비가 없어 같은 보험료로 조금 더 산다
    expect(rows[3].benefitNow).toBeLessThan(rows[0].benefitNow * 1.1);
  });
});
```

- [ ] **Step 2: 실패 확인**.

- [ ] **Step 3: `S0 exact`** — `lib/state.ts`: `| { type: "S0"; S0: number; exact?: boolean }`, 케이스 `case "S0": return touch({ S0: a.exact ? clamp(Math.round(a.S0), 0, S0_MAX) : roundS0(a.S0) });`. (재설계 기준보험금은 0이 될 수 있다.)

- [ ] **Step 4: 보관함 메타** — `lib/library.ts`의 `LibraryEntry`에 `redesign?: RedesignMeta` 추가:
```ts
export interface RedesignMeta { old: OldContract; mode: BudgetMode; monthlyGross: number; redesignedAt: number }
```
(`OldContract`·`BudgetMode`는 `./redesign`에서 import — 순환 import를 피하려고 `lib/redesign.ts`는 `library.ts`를 import하지 않는다.) `sanitizeLibrary`는 `redesign`을 있으면 그대로 넘긴다(`e.redesign && typeof e.redesign === "object" ? e.redesign : undefined`).

- [ ] **Step 5: `lib/redesign.ts`**

```ts
import { commutation, nStar, pvUnit, redesign, toBlocks, type Block, type RedesignInput, type RedesignResult } from "@/lib/engine";
import { assumptionOf, CELEBRATION_RATIO, celebrations, evaluate, initialState, levels, reducer, TABLE, type DesignState, type Profile, type Settings, type Sex } from "./state";

export interface OldContract {
  sex: Sex; entryAge: number; elapsed: number; attainedAge: number;
  S0: number; blocks: Block[];          // 가입연령 기준
  payYears: number; interest: number;   // 원계약 예정이율
  waiver: boolean;
  benefitNow: number;                   // 재설계 시점 사망보험금(원)
  reserve: number; cash: number;        // 재설계 시점 준비금·해약환급금(원)
  monthlyGross: number;                 // 원계약 월 영업보험료(원, 표준형). 납입이 끝났으면 0
  label: string;
}
export type BudgetMode = "continue" | "reduce" | "stop";
export interface Budget { carry: number; monthlyGross: number; payYears: number }
export interface RuleCheck { code: "R01" | "R02" | "R03"; ok: boolean; message: string }
export interface OptionRow { id: "keep" | "paidup" | "surrender" | "redesign"; label: string; benefitNow: number; monthly: number; cashNow: number; pv: number }

const r4 = (x: number) => Math.round(x * 1e4) / 1e4;
const withInterest = (s: Settings, interest: number): Settings => ({ ...s, assumption: { ...s.assumption, id: "custom", label: `원계약 기초율 ${(interest * 100).toFixed(2)}%`, interest } });
/** 가입연령 기준 배수 벡터 (원계약 블록 전개) */
const oldLevels = (old: OldContract) => levels({ ...initialState(), profile: { ...initialState().profile, sex: old.sex, age: old.entryAge }, blocks: old.blocks });

/** 이 앱 설계를 원계약으로. 경과년 t 시점의 준비금·환급금·보험료는 그 설계의 가정(원계약 이율)으로 계산 */
export function fromDesign(d: DesignState, elapsed: number, label = "현재 설계"): OldContract {
  const t = Math.max(0, Math.round(elapsed));
  const r = evaluate(d);
  const S = levels(d);
  return {
    sex: d.profile.sex, entryAge: d.profile.age, elapsed: t, attainedAge: d.profile.age + t,
    S0: d.S0, blocks: d.blocks, payYears: d.payYears, interest: assumptionOf(d).interest, waiver: d.waiver,
    benefitNow: (S[Math.min(t, S.length - 1)] ?? 0) * d.S0,
    reserve: (r.reserve100k[Math.min(t, r.n)] ?? 0) * r.units,
    cash: r.surrender.cash[Math.min(t, r.n)] ?? 0,
    monthlyGross: t < d.payYears ? r.monthly.gross : 0,
    label,
  };
}

export interface ManualOld { sex: Sex; entryAge: number; benefit: number; payYears: number; elapsed: number; interest: number; reserve?: number; cash?: number }
/** 타사·수기 계약: 평준 보험금으로 두고 준비금·환급금은 입력값 우선, 없으면 엔진 계산 */
export function fromManual(m: ManualOld, settings: Settings): OldContract {
  const base = initialState();
  let d: DesignState = { ...base, profile: { ...base.profile, sex: m.sex, age: m.entryAge }, payYears: m.payYears, settings: withInterest(settings, m.interest) };
  d = reducer(d, { type: "preset", id: "level" });
  d = reducer(d, { type: "S0", S0: m.benefit, exact: true });
  const old = fromDesign(d, m.elapsed, "직접 입력");
  return { ...old, interest: m.interest, reserve: m.reserve ?? old.reserve, cash: m.cash ?? old.cash };
}

/** 재설계 시점 이후 스케줄을 재설계 시점 보험금 = 1로 정규화한 카드(축하금은 그 연령 보험금의 10%) */
export function remainingBlocks(old: OldContract): Block[] {
  const rem = oldLevels(old).slice(old.elapsed);
  const base = rem[0] || 1;
  const norm = rem.map((v) => r4(v / base));
  const deaths = toBlocks(norm, old.attainedAge);
  const cels: Block[] = celebrations(old.blocks).filter((c) => c.fromAge >= old.attainedAge)
    .map((c) => ({ fromAge: c.fromAge, toAge: c.fromAge, multiple: r4(CELEBRATION_RATIO * (norm[Math.min(c.fromAge - old.attainedAge, norm.length - 1)] ?? 0)), kind: "celebration" }));
  return [...deaths, ...cels];
}

export function budgetFor(old: OldContract, mode: BudgetMode, reducedMonthly = 0): Budget {
  const payYears = Math.max(0, old.payYears - old.elapsed);
  if (mode === "stop") return { carry: old.cash, monthlyGross: 0, payYears: 0 };
  const G = payYears > 0 ? (mode === "reduce" ? Math.min(Math.max(reducedMonthly, 0), old.monthlyGross) : old.monthlyGross) : 0;
  return { carry: old.reserve, monthlyGross: G, payYears };
}

/** 중첩 편집기의 초기 상태: 재설계 시점 연령, 남은 스케줄, 현재 설정. 기준보험금은 재설계 시점 보험금(예산이 곧 덮어쓴다) */
export function newDesignFor(old: OldContract, settings: Settings): DesignState {
  const base = initialState();
  const profile: Profile = { ...base.profile, sex: old.sex, age: old.attainedAge };
  const draft: DesignState = { ...base, profile, payYears: Math.max(1, old.payYears - old.elapsed), waiver: old.waiver, settings, presetId: "custom", anchors: [], blocks: remainingBlocks(old) };
  const d = reducer(base, { type: "load", state: draft });
  return { ...d, S0: old.benefitNow || d.S0, presetId: "custom", updatedAt: Date.now() };
}

export const toInput = (old: OldContract, b: Budget, nd: DesignState): RedesignInput =>
  ({ sex: old.sex, attainedAge: old.attainedAge, carry: b.carry, monthlyGross: b.monthlyGross, payYears: b.payYears, blocks: nd.blocks, waiver: nd.waiver });

export const runRedesign = (old: OldContract, b: Budget, nd: DesignState, settings: Settings): RedesignResult =>
  redesign(toInput(old, b, nd), settings.assumption, TABLE);

/** 남은 구 스케줄(정규화, 재설계 시점 기준) — R01·손실·비교용 */
const oldRemaining = (old: OldContract) => ({ sex: old.sex, age: old.attainedAge, blocks: remainingBlocks(old), waiver: old.waiver });

/** 월납 연금 현가 ä = N*(m)/Dx_0 (연령 x, 이율 i). 미래 보험료 현가용 */
function payUnit(sex: Sex, age: number, m: number, interest: number, waiver: boolean): number {
  const rs = TABLE[sex], n = TABLE.meta.terminal[sex] - age;
  const zero = new Array<number>(rs.q.length).fill(0);
  const k = commutation({ interest, q: rs.q, f: waiver ? rs.f : zero }, age, n);
  return m > 0 ? nStar(k, Math.min(m, n), 12) / k.Dx[0] : 0;
}

/** 전환 손실: 같은 남은 보장을 현재 기초율로 살 때 더 드는 완납 순보험료(원). 양수면 현재 기초율이 불리 */
export function conversionLoss(old: OldContract, settings: Settings): number {
  const c = oldRemaining(old);
  return old.benefitNow * (pvUnit(c, settings.assumption.interest, TABLE) - pvUnit(c, old.interest, TABLE));
}

export function checkRules(old: OldContract, nd: DesignState, r: RedesignResult, lastRedesignedAt: number | null): RuleCheck[] {
  const b = { carry: r.reserve100k[0] * r.units, monthly: r.monthly.net };   // 이월액은 시점 0 준비금으로 대신(β′ 포함), 순보험료는 재설계 계약 값
  const pvNew = r.S0 * pvUnit({ sex: old.sex, age: old.attainedAge, blocks: nd.blocks, waiver: nd.waiver }, old.interest, TABLE);
  const m = Math.max(0, old.payYears - old.elapsed);
  const fund = b.carry + b.monthly * payUnit(old.sex, old.attainedAge, m, old.interest, nd.waiver);
  const r01 = pvNew <= fund * (1 + 1e-3);
  const Sold = oldLevels(old).slice(old.elapsed);
  const over: number[] = [];
  for (let t = 0; t < 5 && t < r.S.length; t++) if (r.S[t] * r.S0 > (Sold[t] ?? 0) * old.S0 + 1) over.push(old.attainedAge + t);
  const recent = lastRedesignedAt !== null && Date.now() - lastRedesignedAt < 365 * 86400e3;
  return [
    { code: "R01", ok: r01, message: `원계약 기초율 ${(old.interest * 100).toFixed(2)}%로 새 급부 현가 ${Math.round(pvNew).toLocaleString()}원 ${r01 ? "≤" : ">"} 이월액 + 미래 순보험료 현가 ${Math.round(fund).toLocaleString()}원` },
    { code: "R02", ok: over.length === 0, message: over.length ? `재설계 후 5년(${old.attainedAge}~${old.attainedAge + 4}세) 안에 보험금이 원계약보다 큽니다: ${over.join(", ")}세` : "재설계 후 5년은 원계약 보험금 이하" },
    { code: "R03", ok: !recent, message: recent ? "1년 안에 이미 재설계한 계약입니다(연 1회)" : "재설계 횟수 제한(연 1회) 해당 없음" },
  ];
}

export function compareOptions(old: OldContract, r: RedesignResult, settings: Settings): OptionRow[] {
  const i = settings.assumption.interest;
  const c = oldRemaining(old);
  const paidup = redesign({ sex: old.sex, attainedAge: old.attainedAge, carry: old.cash, monthlyGross: 0, payYears: 0, blocks: c.blocks, waiver: old.waiver }, settings.assumption, TABLE);
  return [
    { id: "keep", label: "원계약 유지", benefitNow: old.benefitNow, monthly: old.monthlyGross, cashNow: old.cash, pv: old.benefitNow * pvUnit(c, i, TABLE) },
    { id: "paidup", label: "감액완납 (납입 중단, 스케줄 유지)", benefitNow: paidup.S0, monthly: 0, cashNow: paidup.cash[0], pv: paidup.S0 * paidup.pvbUnit },
    { id: "surrender", label: "해지 (환급금 수령)", benefitNow: 0, monthly: 0, cashNow: old.cash, pv: 0 },
    { id: "redesign", label: "재설계 (현재 안)", benefitNow: r.S0 * r.S[0], monthly: r.monthly.gross, cashNow: r.cash[0], pv: r.S0 * r.pvbUnit },
  ];
}
```
`commutation`·`nStar`는 엔진 index에서 이미 export된다. R01의 이월액은 재설계 결과의 시점 0 준비금(β′ 포함)으로 잡아 같은 기초율에서 등식이 되게 한다.

- [ ] **Step 6: 통과 확인** — 테스트 9개 통과.

- [ ] **Step 7: 커밋** — `git add lib tests/ui/redesign.test.ts && git commit -m "feat(redesign): old contract model, budget modes, rules, comparison"`

---

### Task 3: 원계약 입력과 예산 모드 UI

**Files:**
- Create: `components/redesign/old-contract-form.tsx`, `components/redesign/budget-mode.tsx`

- [ ] **Step 1: 원계약 입력**

`components/redesign/old-contract-form.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Card, Field, ManwonInput, NumInput, Select } from "@/components/ui";
import { won } from "@/lib/format";
import { loadLibrary, type LibraryEntry } from "@/lib/library";
import { fromDesign, fromManual, type ManualOld, type OldContract } from "@/lib/redesign";

type Source = "current" | "library" | "manual";

export function OldContractForm({ value, onChange }: { value: OldContract | null; onChange: (o: OldContract) => void }) {
  const { state } = useDesign();                   // 루트(내 설계)
  const [source, setSource] = useState<Source>("current");
  const [elapsed, setElapsed] = useState(10);
  const [lib, setLib] = useState<LibraryEntry[]>([]);
  const [libId, setLibId] = useState("");
  const [manual, setManual] = useState<ManualOld>({ sex: "M", entryAge: 40, benefit: 1e8, payYears: 20, elapsed: 10, interest: 0.035 });
  useEffect(() => { const l = loadLibrary().filter((e) => !e.redesign); setLib(l); if (l[0]) setLibId(l[0].id); }, []);

  const build = () => {
    if (source === "current") return fromDesign(state, elapsed);
    if (source === "library") { const e = lib.find((x) => x.id === libId); return e ? fromDesign(e.state, elapsed, e.name) : null; }
    return fromManual(manual, state.settings);
  };
  const apply = () => { const o = build(); if (o) onChange(o); };

  return (
    <Card title="1. 원계약">
      <div className="flex flex-wrap gap-2 text-sm">
        {(["current", "library", "manual"] as Source[]).map((s) => (
          <Button key={s} primary={source === s} aria-pressed={source === s} onClick={() => setSource(s)}>{{ current: "현재 설계", library: "보관함", manual: "직접 입력" }[s]}</Button>
        ))}
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {source === "library" && (
          <Field label="보관함 항목"><Select value={libId} onChange={(e) => setLibId(e.target.value)}>{lib.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</Select></Field>
        )}
        {source !== "manual" ? (
          <Field label="경과년" hint="가입 후 지난 연수(재설계 시점)"><NumInput value={elapsed} min={0} max={60} onCommit={(v) => setElapsed(Math.round(v))} /></Field>
        ) : (
          <>
            <Field label="성별"><Select value={manual.sex} onChange={(e) => setManual({ ...manual, sex: e.target.value as ManualOld["sex"] })}><option value="M">남</option><option value="F">여</option></Select></Field>
            <Field label="가입연령"><NumInput value={manual.entryAge} min={15} max={70} onCommit={(v) => setManual({ ...manual, entryAge: Math.round(v) })} /></Field>
            <Field label="보험금(평준)"><ManwonInput value={manual.benefit} onChange={(v) => setManual({ ...manual, benefit: v })} min={100} max={1e6} /></Field>
            <Field label="납입기간(년)"><NumInput value={manual.payYears} min={1} max={40} onCommit={(v) => setManual({ ...manual, payYears: Math.round(v) })} /></Field>
            <Field label="경과년"><NumInput value={manual.elapsed} min={0} max={60} onCommit={(v) => setManual({ ...manual, elapsed: Math.round(v) })} /></Field>
            <Field label="원계약 예정이율(%)"><NumInput value={Math.round(manual.interest * 1e4) / 100} step={0.05} min={0} max={20} onCommit={(v) => setManual({ ...manual, interest: v / 100 })} /></Field>
            <Field label="현재 준비금 (비우면 엔진 계산)"><ManwonInput value={manual.reserve ?? 0} onChange={(v) => setManual({ ...manual, reserve: v || undefined })} min={0} max={1e6} /></Field>
            <Field label="현재 해약환급금 (비우면 엔진 계산)"><ManwonInput value={manual.cash ?? 0} onChange={(v) => setManual({ ...manual, cash: v || undefined })} min={0} max={1e6} /></Field>
          </>
        )}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Button primary onClick={apply}>원계약으로 사용</Button>
        {value && <span className="text-xs text-navy/60">{value.label} · {value.attainedAge}세 · 현재 보험금 {won(value.benefitNow)} · 준비금 {won(value.reserve)} · 환급금 {won(value.cash)} · 월 {won(value.monthlyGross)} · 이율 {(value.interest * 100).toFixed(2)}%</span>}
      </div>
    </Card>
  );
}
```

- [ ] **Step 2: 예산 모드**

`components/redesign/budget-mode.tsx`:
```tsx
"use client";
import { Card, Field, ManwonInput } from "@/components/ui";
import { won } from "@/lib/format";
import { budgetFor, type BudgetMode, type OldContract } from "@/lib/redesign";

const LABEL: Record<BudgetMode, string> = { continue: "납입 지속", reduce: "감액", stop: "납입 중단(감액완납형)" };
const DESC: Record<BudgetMode, string> = { continue: "준비금을 이월하고 지금 보험료를 그대로 냅니다", reduce: "준비금을 이월하고 보험료를 낮춰 냅니다", stop: "해약환급금만 이월하고 더 내지 않습니다" };

export function BudgetModePanel({ old, mode, reduced, onChange }: { old: OldContract; mode: BudgetMode; reduced: number; onChange: (mode: BudgetMode, reduced: number) => void }) {
  const b = budgetFor(old, mode, reduced);
  return (
    <Card title="2. 예산">
      <div className="grid gap-2 sm:grid-cols-3">
        {(Object.keys(LABEL) as BudgetMode[]).map((m) => {
          const bb = budgetFor(old, m, reduced);
          return (
            <button key={m} type="button" aria-pressed={mode === m} onClick={() => onChange(m, reduced)}
              className={`rounded border p-3 text-left ${mode === m ? "border-sky bg-sky/10" : "border-navy/15 hover:bg-navy/5"}`}>
              <div className="text-sm font-medium text-navy">{LABEL[m]}</div>
              <div className="text-xs text-navy/60">{DESC[m]}</div>
              <div className="mt-1 font-mono text-xs text-navy">이월 {won(bb.carry)} · 월 {won(bb.monthlyGross)} · {bb.payYears}년</div>
            </button>
          );
        })}
      </div>
      {mode === "reduce" && (
        <div className="mt-3 max-w-xs"><Field label="낮춘 월 보험료" hint={`원계약 월 ${won(old.monthlyGross)} 이하`}><ManwonInput value={reduced} onChange={(v) => onChange("reduce", v)} min={0} max={Math.floor(old.monthlyGross / 1e4)} /></Field></div>
      )}
      <p className="mt-2 text-xs text-navy/60">이월 {won(b.carry)} + 월 {won(b.monthlyGross)} × {b.payYears}년 → 새 기준보험금은 3단계 그래프에서 스케줄에 맞춰 자동 역산됩니다. 신계약비는 붙지 않습니다.</p>
    </Card>
  );
}
```

- [ ] **Step 3: 커밋** — tsc·eslint 통과 후 `git add components/redesign && git commit -m "feat(redesign): old-contract form and budget mode panel"`

---

### Task 4: 재설계 캔버스·결과·비교·저장, 페이지 조립

**Files:**
- Create: `components/redesign/redesign-canvas.tsx`, `app/redesign/page.tsx`

- [ ] **Step 1: 캔버스(중첩 Provider 안)**

`components/redesign/redesign-canvas.tsx`:
```tsx
"use client";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useMemo, useState } from "react";
import { CelebrationBar } from "@/components/canvas/celebration-bar";
import { ScheduleEditor } from "@/components/canvas/schedule-editor";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { pct, won } from "@/lib/format";
import { downloadJson, loadLibrary, saveLibrary, upsert } from "@/lib/library";
import { checkRules, compareOptions, conversionLoss, runRedesign, type Budget, type BudgetMode, type OldContract } from "@/lib/redesign";
import { reserveCsv, RESERVE_HEADERS, type ReserveRow } from "@/lib/reserve-table";

export function RedesignCanvas({ old, budget, mode, lastRedesignedAt, onSaved }: { old: OldContract; budget: Budget; mode: BudgetMode; lastRedesignedAt: number | null; onSaved?: () => void }) {
  const { state, dispatch } = useDesign();     // 중첩(새 스케줄)
  const router = useRouter();
  const [amount, setAmount] = useState(true);
  const [msg, setMsg] = useState("");
  const r = useMemo(() => runRedesign(old, budget, state, state.settings), [old, budget, state]);
  // 예산이 정한 기준보험금을 편집기 상태에 동기화(라벨·하한 계산용)
  useEffect(() => { if (Math.abs(state.S0 - r.S0) > 1) dispatch({ type: "S0", S0: r.S0, exact: true }); }, [r.S0, state.S0, dispatch]);
  const rules = checkRules(old, state, r, lastRedesignedAt);
  const loss = conversionLoss(old, state.settings);
  const rows = compareOptions(old, r, state.settings);
  const table: ReserveRow[] = r.reserve100k.map((v, t) => ({ t, age: old.attainedAge + t, benefit: (r.S[Math.min(t, r.n - 1)] ?? 0) * r.S0, celebration: (r.C[t] ?? 0) * r.S0, paid: r.paid[t], reserve: v * r.units, reserveStd: v * r.units, cash: r.cash[t], rate: r.rate[t] }));

  const save = () => {
    const name = window.prompt("보관함에 저장할 이름", `재설계 · ${old.label} · ${old.attainedAge}세 · 월 ${won(r.monthly.gross)}`);
    if (!name?.trim()) return;
    saveLibrary(upsert(loadLibrary(), { id: String(Date.now()), name: name.trim(), savedAt: Date.now(), state: { ...state, S0: r.S0 }, redesign: { old, mode, monthlyGross: budget.monthlyGross, redesignedAt: Date.now() } }));
    setMsg("보관함에 저장했습니다. 시작 화면에서 열면 이 화면으로 돌아옵니다."); setTimeout(() => setMsg(""), 3000);
    onSaved?.();
  };

  return (
    <div className="space-y-4">
      <Card title="3. 새 스케줄">
        <div className="-mt-2 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/60">
          <span>{old.attainedAge}세부터 다시 설계합니다. 초기 5년은 고정(R02), 1칸 = 새 기준보험금의 10% ({won(r.S0 / 10)})</span>
          <Button onClick={() => setAmount(!amount)}>{amount ? "배수로 보기" : "금액으로 보기"}</Button>
        </div>
        <ScheduleEditor height={360} amount={amount} />
        <CelebrationBar />
      </Card>

      <div className="grid gap-4 xl:grid-cols-2">
        <Card title="재설계 결과">
          <div className="text-xs text-navy/60">새 기준보험금 (이월 {pct(r.fundedByCarry)} + 보험료 {pct(1 - r.fundedByCarry)})</div>
          <div className="font-mono text-3xl text-navy">{won(r.S0)}</div>
          <dl className="mt-2 grid grid-cols-[1fr_auto] gap-y-1 text-sm">
            {([["월 보험료 (남은 " + budget.payYears + "년)", won(r.monthly.gross)], ["이월 금액", won(budget.carry)], ["재설계 시점 준비금", won(r.reserve100k[0] * r.units)], ["최대 보험금", won(Math.max(...r.S) * r.S0)], ["전환 손실 (기초율 차이)", `${loss >= 0 ? "" : "−"}${won(Math.abs(loss))}`]] as [string, string][]).map(([k, v]) => <Fragment key={k}><dt className="text-navy/60">{k}</dt><dd className="font-mono">{v}</dd></Fragment>)}
          </dl>
          <ul className="mt-3 space-y-1 text-sm">
            {rules.map((x) => <li key={x.code} className={x.ok ? "text-emerald-800" : "text-red-800"}>{x.ok ? "✓" : "✗"} {x.code} · {x.message}</li>)}
          </ul>
          <p className="mt-2 text-xs text-navy/50">신계약비 없음 · 해약공제 없음 · 현재 가정 {state.settings.assumption.label}</p>
        </Card>
        <Card title="비교">
          <table className="w-full text-sm">
            <thead><tr className="text-left text-navy/60"><th>안</th><th className="text-right">현재 보험금</th><th className="text-right">월 보험료</th><th className="text-right">지금 해지 시</th><th className="text-right">보험금 현가</th></tr></thead>
            <tbody>{rows.map((x) => <tr key={x.id} className={`border-t border-navy/10 ${x.id === "redesign" ? "bg-sky/10" : ""}`}><td className="py-1">{x.label}</td><td className="text-right font-mono">{won(x.benefitNow)}</td><td className="text-right font-mono">{won(x.monthly)}</td><td className="text-right font-mono">{won(x.cashNow)}</td><td className="text-right font-mono">{won(x.pv)}</td></tr>)}</tbody>
          </table>
        </Card>
      </div>

      <details className="rounded-lg border border-navy/10 bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-display text-lg text-navy">준비금·환급금 표 (재설계)</summary>
        <div className="mt-2 flex justify-end"><Button onClick={() => downloadJson(`재설계_준비금표_${old.attainedAge}세.csv`, reserveCsv(table), "text/csv")}>CSV 다운로드</Button></div>
        <div className="mt-2 max-h-80 overflow-auto"><table className="w-full text-xs"><thead className="sticky top-0 bg-white text-navy/60"><tr>{RESERVE_HEADERS.map((h) => <th key={h} className="text-right first:text-left">{h}</th>)}</tr></thead>
          <tbody>{table.map((row) => <tr key={row.t} className="border-t border-navy/10 font-mono"><td>{row.t}</td><td className="text-right">{row.age}</td><td className="text-right">{won(row.benefit)}</td><td className="text-right">{row.celebration ? won(row.celebration) : "-"}</td><td className="text-right">{won(row.paid)}</td><td className="text-right">{won(row.reserve)}</td><td className="text-right">{won(row.reserveStd)}</td><td className="text-right">{won(row.cash)}</td><td className="text-right">{pct(row.rate)}</td></tr>)}</tbody></table></div>
      </details>

      <div className="flex flex-wrap items-center gap-2">
        <Button primary onClick={save}>보관함에 저장 (재설계)</Button>
        <Button onClick={() => router.push("/")}>시작 화면</Button>
        {msg && <span className="text-xs text-emerald-700">{msg}</span>}
      </div>
    </div>
  );
}
```
표의 `reserveStd`는 재설계에서 표준기초 준비금을 따로 내지 않으므로 적용 준비금과 같게 둔다(헤더는 그대로, 설명 문구에 "표준 준비금 = 적용 준비금" 명시).

- [ ] **Step 2: 페이지**

`app/redesign/page.tsx`:
```tsx
"use client";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { DesignProvider, useDesign } from "@/components/design-provider";
import { BudgetModePanel } from "@/components/redesign/budget-mode";
import { OldContractForm } from "@/components/redesign/old-contract-form";
import { RedesignCanvas } from "@/components/redesign/redesign-canvas";
import { loadLibrary } from "@/lib/library";
import { budgetFor, newDesignFor, type BudgetMode, type OldContract } from "@/lib/redesign";

function RedesignInner() {
  const { state, loaded } = useDesign();
  const params = useSearchParams();
  const [old, setOld] = useState<OldContract | null>(null);
  const [mode, setMode] = useState<BudgetMode>("continue");
  const [reduced, setReduced] = useState(0);
  const [restored, setRestored] = useState<{ state: ReturnType<typeof newDesignFor>; at: number } | null>(null);
  useEffect(() => {                                   // 보관함에서 열기: ?id=
    const id = params.get("id"); if (!id) return;
    const e = loadLibrary().find((x) => x.id === id && x.redesign); if (!e) return;
    setOld(e.redesign!.old); setMode(e.redesign!.mode); setReduced(e.redesign!.monthlyGross); setRestored({ state: e.state, at: e.redesign!.redesignedAt });
  }, [params]);
  const budget = useMemo(() => (old ? budgetFor(old, mode, reduced || (old.monthlyGross / 2)) : null), [old, mode, reduced]);
  const initial = useMemo(() => (old ? (restored?.state ?? newDesignFor(old, state.settings)) : null), [old, restored, state.settings]);
  if (!loaded) return null;
  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="font-display text-2xl text-navy">재설계</h1>
      <p className="text-sm text-navy/60">이미 가입한 계약의 준비금과 앞으로 낼 보험료를 예산으로 보험금 스케줄을 다시 설계합니다. 규칙: 같은 기초율로 보험금 현가가 늘지 않고(R01), 재설계 후 5년은 보험금을 올리지 않으며(R02), 연 1회(R03).</p>
      <OldContractForm value={old} onChange={(o) => { setOld(o); setRestored(null); setReduced(Math.round(o.monthlyGross / 2)); }} />
      {old && budget && initial && (
        <>
          <BudgetModePanel old={old} mode={mode} reduced={reduced} onChange={(m, v) => { setMode(m); setReduced(v); }} />
          <DesignProvider key={`${old.label}-${old.attainedAge}-${restored?.at ?? 0}`} initial={initial} persist={false}>
            <RedesignCanvas old={old} budget={budget} mode={mode} lastRedesignedAt={restored?.at ?? null} />
          </DesignProvider>
        </>
      )}
    </div>
  );
}

export default function RedesignPage() {
  return <Suspense fallback={null}><RedesignInner /></Suspense>;
}
```
`useSearchParams`는 정적 빌드에서 `Suspense`가 필요하다. `DesignProvider`의 `key`로 원계약이 바뀌면 편집기를 새로 만든다.

- [ ] **Step 3: 검증** — tsc, eslint, `npm run build`(`/redesign` 정적). 브라우저: 샘플 열기 → `/redesign` → 현재 설계·경과년 10 → 원계약으로 사용 → 지속 모드에서 새 기준보험금 ≈ 현재 보험금, R01·R02 ✓ → 55세를 올리면 R02 ✗ → 납입 중단 모드에서 보험료 0·보험금 감소 → CSV 버튼 → 보관함 저장.

- [ ] **Step 4: 커밋** — `git add components/redesign app/redesign && git commit -m "feat(redesign): canvas, results, rules, comparison, reserve table, save"`

---

### Task 5: 진입점·보관함 복원

**Files:**
- Modify: `components/library-panel.tsx`, `components/canvas/design-toolbar.tsx`, `app/layout.tsx`

- [ ] **Step 1: 보관함** — 항목에 `e.redesign`이 있으면 이름 옆에 `재설계` 배지를 붙이고, 열기는 `router.push(`/redesign?id=${e.id}`)`로. `lib.filter((e) => !e.redesign)`는 원계약 선택용(Task 3)이고 목록에는 모두 표시한다.
- [ ] **Step 2: 툴바** — `DesignToolbar`에 `<Link href="/redesign">재설계</Link>` 추가(설정 앞).
- [ ] **Step 3: 내비** — `app/layout.tsx`에 `/redesign` "재설계" 링크.
- [ ] **Step 4: 커밋** — `git add components app/layout.tsx && git commit -m "feat(redesign): entry points and library restore"`

---

### Task 6: 문서·마무리

- [ ] **Step 1: 계획서 v0.7** — 상태 줄 갱신, §0.8 아래 `### 0.9 재설계 결정 (2026-09-10, 객관식 4문항)` 표(#32 원계약 입력 3종, #33 예산 3종, #34 기초율·손실, #35 비교안 4종, #36 신계약비 미부과·R02=편집기 고정 5년·보관함 메타 복원). 부록 B.1~B.4 각 절 첫 줄에 `(v0.7에서 구현, §0.9)` 표시.
- [ ] **Step 2: README** — 화면 표에 `/redesign` 행, 엔진 표에 `redesign` 행.
- [ ] **Step 3: 전체 검증** — 빌드 8 라우트, 테스트 103 + 엔진 5 + UI 9 = 117, eslint.
- [ ] **Step 4: 커밋·푸시** — `git add -A && git commit -m "feat(redesign): docs, plan v0.7" && git push`

---

## 자체 점검

- 부록 B.1 입력(기존 보험금·잔여 납입기간·현재 준비금/환급금·원계약 예정이율, 이 앱 계약이면 자동) → Task 2 `fromDesign`/`fromManual`, Task 3 폼. B.2 R01~R03 → Task 2 `checkRules`(R02는 편집기 고정 5년으로도 막힘). B.2 예산식(V_t + PV 미래보험료 − PV 미래사업비) → Task 1: 미래 보험료·사업비는 `premium()`의 α 없는 영업보험료로 한 번에 처리. B.2 "납입 지속은 준비금 이월, 중단은 환급금 이월, 신계약비 미부과" → Task 1·2. B.2 전환 손실 → `conversionLoss`. B.2 비교(유지·감액완납·해지·재설계) → `compareOptions`; 감액·연장정기는 다음. B.4 화면 흐름 → Task 3·4.
- R01은 급부 현가끼리가 아니라 "원계약 기초율에서 새 급부 현가 ≤ 이월액 + 미래 순보험료 현가"로 검사한다(신계약비 미부과 때문). 같은 기초율이면 등식, 현재 이율이 낮으면 통과, 높으면 위반.
- 타입 일관성: `OldContract`·`Budget`·`BudgetMode`·`RedesignMeta`(Task 2)를 Task 3·4·5가 같은 이름으로 쓴다. `redesign()`의 `RedesignResult` 필드(`S0`, `S`, `C`, `n`, `units`, `reserve100k`, `cash`, `paid`, `rate`, `monthly`, `fundedByCarry`, `pvbUnit`)를 Task 2·4가 그대로 읽는다. `S0` 액션의 `exact`(Task 2)를 Task 4가 쓴다.
- 알려진 단순화: 이월분의 납입후유지비를 준비금에 포함(보수적) · 표준기초 준비금 미산출 · 비교안의 "감액"(보험료 낮춤)은 재설계 모드 안에서 다루므로 별도 행 없음 · 연장정기 없음.
