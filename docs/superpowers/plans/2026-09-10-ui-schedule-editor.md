# 보험금 스케줄 그래프 편집기 구현 계획 (단계 2.5)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 설계 캔버스의 중심을 보험금 스케줄 그래프로 옮긴다. 그래프에서 연령을 클릭·드래그해 보험금을 "1칸 = 기준보험금의 10%" 단위로, 마지막 변경 후 지난 연수만큼만 올리거나 내릴 수 있게 하고, 축하금은 해당 연령 사망보험금의 10%로 자동 지정한다. 레이아웃은 왼쪽 예산·계약, 오른쪽 큰 그래프 + 아래 결과, 그리고 확대 보기.

**Architecture:** 규칙은 전부 `lib/state.ts`의 순수 함수(`allowedRange`, `level` 액션, 축하금 파생)에 두고 vitest로 고정한다. 그래프는 Recharts 대신 직접 그린 SVG(`ScheduleEditor`)로, 포인터 이벤트 → 연령·배수 변환 → 리듀서 dispatch만 한다. 확대는 브라우저 기본 `<dialog>`.

**Tech Stack:** 기존과 동일(Next.js 15, React 19, Tailwind v4, vitest 5). 새 의존성 없음. Recharts는 결과 곡선에만 남는다.

**결정 (2026-09-10 인터뷰, 계획서 v0.4 §0.6):** 1칸 = 기준보험금 10% · 앞 연령을 움직이면 뒤 구간은 같은 폭만큼 함께 이동(상·하한에서 정지) · 축하금 = 해당 연령 사망보험금의 10%(나이만 입력) · 가입 시 기준보험금 1억 · 최소 보험금은 E05(20%)·E06(1,000만원) 중 큰 쪽에서 무조건 보장 · 45세(첫 편집 가능 연령)는 0칸이므로 실제 첫 이동은 46세부터.

**실행 환경 주의:** RTK 훅이 vitest 표준출력을 삼킨다. 결과는 아래로 읽는다. 파일은 Write/Edit 도구로 쓴다(한글 heredoc 파싱 오류).

```bash
npx vitest run >/dev/null 2>&1; node -e "const j=require('./.vitest/json/output.json');console.log(j.numPassedTests,'passed',j.numFailedTests,'failed');for(const f of j.testResults)for(const t of f.assertionResults)if(t.status!=='passed')console.log(t.fullName,(t.failureMessages||[]).join('\n').slice(0,400))"
```

---

## 파일 구조

| 파일 | 책임 |
|---|---|
| `lib/state.ts` (수정) | `STEP`, `CELEBRATION_RATIO`, `firstEditableAge`, `levels`, `floorMultiple`, `allowedRange`, `level` 액션, 축하금 배수 파생, `addCelebration`/`celebration` 시그니처 변경 |
| `tests/ui/state.test.ts` (수정) | 그래프 편집 규칙·축하금 10% 테스트, 기존 축하금 테스트 갱신 |
| `components/canvas/schedule-editor.tsx` (신규) | SVG 스케줄 편집기: 격자, 고정 구간, 계단선, 축하금 마커, 허용 범위 밴드, 드래그·키보드 |
| `components/canvas/celebration-bar.tsx` (신규) | 축하금 나이 입력·추가·칩 목록 |
| `components/canvas/schedule-chart.tsx` (교체) | 카드 껍데기: 안내문, 배수/금액 토글, 확대(`<dialog>`), 편집기 + 축하금 바 |
| `components/canvas/block-cards.tsx` (수정) | 축하금 행에서 배수 입력 제거(파생값 표시), 추가 버튼 시그니처 |
| `components/canvas/preset-picker.tsx` (수정) | 넓은 화면에서 6열 |
| `app/design/page.tsx` (수정) | 2열 레이아웃(왼쪽 300px 입력·예산, 오른쪽 그래프 → 결과 → 카드 → 근거), 탭 2개 |
| `docs/tkLeen_설계형종신보험_앱개발계획서.md`, `README.md` (수정) | v0.4 결정 기록 |

---

### Task 1: 규칙 — 그래프 편집 액션과 축하금 10%

**Files:**
- Modify: `lib/state.ts`, `tests/ui/state.test.ts`

- [ ] **Step 1: 실패하는 테스트**

`tests/ui/state.test.ts` 상단 import에 `allowedRange, floorMultiple, levels, STEP, CELEBRATION_RATIO, firstEditableAge` 를 추가하고, 파일 끝에 붙인다:

```ts
describe("그래프 단계 편집 (level 액션)", () => {
  const s0 = initialState(); // 40세 남 · 1억 · 평준 1.0
  const S = (s: DesignState) => levels(s);
  it("상수: 1칸 10%, 축하금 10%, 첫 편집 연령 45", () => {
    expect(STEP).toBe(0.1); expect(CELEBRATION_RATIO).toBe(0.1);
    expect(firstEditableAge(s0.profile)).toBe(45);
  });
  it("45세 이전은 편집 불가, 45세는 0칸, 50세는 45세부터 5칸", () => {
    expect(allowedRange(s0, 44).editable).toBe(false);
    expect(allowedRange(s0, 45)).toMatchObject({ editable: true, steps: 0, ref: 45, prev: 1, min: 1, max: 1 });
    expect(allowedRange(s0, 50)).toMatchObject({ editable: true, steps: 5, ref: 45, prev: 1, min: 0.5, max: 1.5 });
  });
  it("50세를 1.7로 올리면 5칸 상한 1.5로 잘리고 50세 이후가 모두 1.5", () => {
    const s = reducer(s0, { type: "level", age: 50, multiple: 1.7 });
    expect(S(s)[9]).toBe(1); expect(S(s)[10]).toBe(1.5); expect(S(s)[69]).toBe(1.5);
    expect(s.presetId).toBe("custom");
  });
  it("60세는 마지막 변경(50세)부터 10칸, E04 상한 3배", () => {
    let s = reducer(s0, { type: "level", age: 50, multiple: 1.5 });
    expect(allowedRange(s, 60)).toMatchObject({ steps: 10, ref: 50, prev: 1.5, min: 0.5, max: 2.5 });
    s = reducer(s, { type: "level", age: 60, multiple: 9 });
    expect(S(s)[20]).toBe(2.5);
    s = reducer(s, { type: "level", age: 70, multiple: 9 });   // 10칸이면 3.5지만 상한 3
    expect(S(s)[30]).toBe(3);
    expect(allowedRange(s, 55)).toMatchObject({ steps: 5, ref: 50, prev: 1.5 });
  });
  it("앞 연령을 움직이면 뒤 구간은 같은 폭만큼 함께 움직인다", () => {
    let s = reducer(s0, { type: "level", age: 50, multiple: 1.5 });
    s = reducer(s, { type: "level", age: 60, multiple: 2.5 });
    s = reducer(s, { type: "level", age: 50, multiple: 1.4 });
    expect(S(s)[10]).toBe(1.4); expect(S(s)[20]).toBe(2.4);
    s = reducer(s, { type: "level", age: 50, multiple: 0 });    // 5칸 아래 = 0.5, 뒤 구간도 −0.9
    expect(S(s)[10]).toBe(0.5); expect(S(s)[20]).toBe(1.5);
  });
  it("하한은 E05 20%와 E06 1,000만원 중 큰 쪽", () => {
    expect(floorMultiple(1e8)).toBe(0.2);
    expect(floorMultiple(2e7)).toBe(0.5);
    const small = reducer(s0, { type: "S0", S0: 2e7 });
    expect(S(reducer(small, { type: "level", age: 50, multiple: 0 }))[10]).toBe(0.5);
    let s = reducer(s0, { type: "level", age: 60, multiple: 0 });      // 15칸 아래 → 하한 0.2
    expect(S(s)[20]).toBe(0.2);
  });
  it("편집 불가 연령·변화 없음은 같은 상태 참조를 돌려준다", () => {
    expect(reducer(s0, { type: "level", age: 44, multiple: 2 })).toBe(s0);
    expect(reducer(s0, { type: "level", age: 45, multiple: 1.3 })).toBe(s0);
    expect(reducer(s0, { type: "level", age: 50, multiple: 1 })).toBe(s0);
  });
});

describe("축하금 10% 규칙", () => {
  it("해당 연령 사망보험금의 10%이고, 보험금이 바뀌면 따라간다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65 });
    expect(celebrations(s.blocks)).toEqual([{ fromAge: 65, toAge: 65, multiple: 0.1, kind: "celebration" }]);
    s = reducer(s, { type: "level", age: 60, multiple: 2.5 });   // 45→60 15칸, 상한 2.5
    expect(celebrations(s.blocks)[0].multiple).toBe(0.25);
    s = reducer(s, { type: "celebration", index: 0, patch: { fromAge: 55 } });
    expect(celebrations(s.blocks)[0]).toMatchObject({ fromAge: 55, multiple: 0.1 });
  });
  it("같은 나이에 두 번 추가하지 않는다", () => {
    let s = reducer(initialState(), { type: "addCelebration", age: 65 });
    s = reducer(s, { type: "addCelebration", age: 65 });
    expect(celebrations(s.blocks)).toHaveLength(1);
  });
});
```

기존 축하금 테스트 3곳을 새 시그니처로 고친다:
- "프리셋 상태에서 프로필을 바꾸면 축하금은 유지된다": `addCelebration` 호출에서 `multiple` 제거, 기대값 `multiple: 0.1`, `expect(C[20]).toBe(0.1)`.
- "축하금을 편집해도 프리셋(자녀연령형)이 …": `addCelebration` 호출에서 `multiple` 제거.
- "추가·수정·삭제, 범위 밖이면 버린다": `addCelebration` 호출에서 `multiple` 제거, `celebration` patch는 `{ fromAge: 70 }`만, 기대값 `{ fromAge: 70, toAge: 70, multiple: 0.1, kind: "celebration" }`.

- [ ] **Step 2: 실패 확인** — Run tests → `allowedRange` 등 export 없음/타입 오류.

- [ ] **Step 3: 구현**

`lib/state.ts`:

(a) import 줄에 `expandBlocks, toBlocks` 추가.

(b) `toEngineInput` 아래에 추가:
```ts
export const STEP = 0.1;               // 그래프 1칸 = 기준보험금의 10%
export const CELEBRATION_RATIO = 0.1;  // 축하금 = 해당 연령 사망보험금의 10%
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** 첫 편집 가능 연령 = 가입연령 + 초기 고정 연수(E01) */
export const firstEditableAge = (p: Profile) => p.age + DEFAULT_ENVELOPE.fixYears;
/** 연도별 사망보험금 배수 S_t (t = 0..n−1) */
export const levels = (s: DesignState): number[] => expandBlocks(s.blocks, s.profile.age, termOf(s.profile)).S;
/** 하한 배수: E05 감액 하한과 E06 최소 금액 중 큰 쪽 */
export const floorMultiple = (S0: number) => Math.max(DEFAULT_ENVELOPE.minMultiple, DEFAULT_ENVELOPE.minAmount / S0);

export interface AllowedRange { editable: boolean; prev: number; ref: number; steps: number; min: number; max: number }

/**
 * 연령 A에서 그래프로 움직일 수 있는 범위.
 * 기준은 직전 연령(A−1)의 배수 prev이고, prev가 시작된 연령(ref, 최소 firstEditable)부터 A까지 지난 연수만큼 칸(STEP)을 쓸 수 있다.
 * 급격한 증액을 막는 규칙이므로 프리셋이 만든 램프에는 적용하지 않고 수동 편집에만 쓴다.
 */
export function allowedRange(s: DesignState, ageAt: number): AllowedRange {
  const x = s.profile.age, S = levels(s), first = firstEditableAge(s.profile), end = endAgeOf(s.profile);
  const t = ageAt - x;
  if (ageAt < first || ageAt > end) {
    const prev = S[clamp(t, 0, S.length - 1)];
    return { editable: false, prev, ref: ageAt, steps: 0, min: prev, max: prev };
  }
  const prev = S[t - 1];
  let ref = ageAt - 1;
  while (ref > x && S[ref - x - 1] === S[ref - x]) ref--;
  ref = Math.max(ref, first);
  const steps = ageAt - ref;
  return {
    editable: true, prev, ref, steps,
    min: r4(Math.max(floorMultiple(s.S0), prev - steps * STEP)),
    max: r4(Math.min(DEFAULT_ENVELOPE.maxMultiple, prev + steps * STEP)),
  };
}
```

(c) `withBlocks`를 축하금 배수 파생으로 바꾼다:
```ts
function withBlocks(s: DesignState, deaths: Block[], cels: Block[], presetId: DesignState["presetId"] = s.presetId): DesignState {
  const p = s.profile, n = termOf(p);
  const d = normalizeSegments(deaths, p.age, endAgeOf(p));
  const { S } = expandBlocks(d, p.age, n);
  const seen = new Set<number>();
  const c: Block[] = [];
  for (const b of cels) {
    if (b.fromAge < p.age || b.fromAge > p.age + n || seen.has(b.fromAge)) continue;
    seen.add(b.fromAge);
    const t = Math.min(b.fromAge - p.age, n - 1);
    c.push({ fromAge: b.fromAge, toAge: b.fromAge, multiple: r4(CELEBRATION_RATIO * S[t]), kind: "celebration" });
  }
  return { ...s, blocks: [...d, ...c], presetId, updatedAt: Date.now() };
}
```

(d) `Action` 유니온: `addCelebration`은 `{ type: "addCelebration"; age: number }`, `celebration`은 `{ type: "celebration"; index: number; patch: { fromAge: number } }`, 그리고 `| { type: "level"; age: number; multiple: number }` 추가.

(e) 리듀서 케이스 교체·추가:
```ts
    case "addCelebration": {
      const c: Block = { fromAge: Math.round(a.age), toAge: Math.round(a.age), multiple: 0, kind: "celebration" };
      return withBlocks(s, deathSegments(s.blocks), [...celebrations(s.blocks), c]);
    }
    case "celebration": {
      if (!celebrations(s.blocks)[a.index]) return s;
      const c = celebrations(s.blocks).map((b, i) => (i !== a.index ? b : { ...b, fromAge: Math.round(a.patch.fromAge) }));
      return withBlocks(s, deathSegments(s.blocks), c);
    }
    case "level": {
      const r = allowedRange(s, a.age);
      if (!r.editable) return s;
      const target = r4(clamp(a.multiple, r.min, r.max));
      const S = levels(s), t = a.age - s.profile.age, delta = r4(target - S[t]);
      if (delta === 0) return s;
      const lo = floorMultiple(s.S0), hi = DEFAULT_ENVELOPE.maxMultiple;
      const next = S.map((v, i) => (i >= t ? r4(clamp(v + delta, lo, hi)) : v));
      return withBlocks(s, toBlocks(next, s.profile.age), celebrations(s.blocks), "custom");
    }
```
`clamp`는 `lib/format.ts`의 것(NaN → lo).

- [ ] **Step 4: 통과 확인** — Run tests → 0 failed (state 파일 약 30개). `S(s)[20]`이 2.4가 아니라 2.5면 `level`이 delta 대신 target을 뒤 구간에 덮어쓴 것.

- [ ] **Step 5: 타입 확인·커밋** — `npx tsc --noEmit`는 `block-cards.tsx`의 옛 `addCelebration`/`celebration` 호출 때문에 실패할 수 있다. Task 3에서 고치므로 여기서는 `lib/state.ts`와 테스트만 커밋한다: `git add lib/state.ts tests/ui/state.test.ts && git commit -m "feat(state): stepwise level editing rule and 10% celebration rule"`.

---

### Task 2: SVG 스케줄 편집기

**Files:**
- Create: `components/canvas/schedule-editor.tsx`

- [ ] **Step 1: 구현**

```tsx
"use client";
import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { useDesign } from "@/components/design-provider";
import { DEFAULT_ENVELOPE } from "@/lib/engine";
import { won } from "@/lib/format";
import { allowedRange, celebrations, endAgeOf, firstEditableAge, STEP } from "@/lib/state";

const M = { left: 64, right: 16, top: 18, bottom: 28 };
const r4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** 컨테이너 폭을 ResizeObserver로 읽는다 */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [w, setW] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(e.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/**
 * 보험금 스케줄 편집기. 연령을 클릭·드래그하거나 화살표 키로 배수를 STEP 단위로 바꾼다.
 * 규칙(허용 범위·하한·뒤 구간 이동)은 전부 lib/state의 allowedRange·level 액션에 있다.
 */
export function ScheduleEditor({ height, amount }: { height: number; amount: boolean }) {
  const { state, dispatch, result } = useDesign();
  const [box, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [selected, setSelected] = useState<number | null>(null);
  const drag = useRef<number | null>(null);

  const x0 = state.profile.age, n = result.n, S = result.S, S0 = state.S0;
  const first = firstEditableAge(state.profile), endAge = endAgeOf(state.profile);
  const yMax = Math.max(DEFAULT_ENVELOPE.maxMultiple, Math.ceil((Math.max(...S) + 0.3) * 2) / 2);
  const W = Math.max(width, 320), H = height;
  const pw = W - M.left - M.right, ph = H - M.top - M.bottom;
  const xs = (age: number) => M.left + ((age - x0) / n) * pw;
  const ys = (m: number) => M.top + ph - (m / yMax) * ph;
  const ageAt = (px: number) => Math.min(endAge, Math.max(x0, Math.round(x0 + ((px - M.left) / pw) * n)));
  const levelAt = (py: number) => ((M.top + ph - py) / ph) * yMax;
  const at = (age: number) => S[Math.min(Math.max(age - x0, 0), n - 1)];
  const label = (m: number) => (amount ? won(m * S0) : `${r4(m)}배`);

  const line = S.map((m, t) => `${t === 0 ? "M" : "L"}${xs(x0 + t)},${ys(m)} L${xs(x0 + t + 1)},${ys(m)}`).join(" ");
  const area = `${line} L${xs(x0 + n)},${ys(0)} L${xs(x0)},${ys(0)} Z`;

  const pos = (e: PointerEvent<SVGSVGElement>) => { const r = e.currentTarget.getBoundingClientRect(); return { px: e.clientX - r.left, py: e.clientY - r.top }; };
  /** 포인터 y → prev 기준 칸 수로 양자화해 dispatch. 범위 밖은 리듀서가 자른다 */
  const moveTo = (age: number, py: number) => {
    const r = allowedRange(state, age);
    if (!r.editable) return;
    const k = Math.round((levelAt(py) - r.prev) / STEP);
    dispatch({ type: "level", age, multiple: r.prev + k * STEP });
  };
  const onDown = (e: PointerEvent<SVGSVGElement>) => {
    const { px, py } = pos(e);
    const age = ageAt(px);
    setSelected(age);
    e.currentTarget.focus();
    if (age < first) return;
    drag.current = age;
    e.currentTarget.setPointerCapture(e.pointerId);
    moveTo(age, py);
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const { px, py } = pos(e);
    if (drag.current !== null) moveTo(drag.current, py);
    else setHover(ageAt(px));
  };
  const onUp = (e: PointerEvent<SVGSVGElement>) => {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId);
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "Escape") { setSelected(null); return; }
    if (selected === null) return;
    if (e.key === "ArrowLeft") setSelected(Math.max(x0, selected - 1));
    else if (e.key === "ArrowRight") setSelected(Math.min(endAge, selected + 1));
    else if (e.key === "ArrowUp" || e.key === "ArrowDown") dispatch({ type: "level", age: selected, multiple: at(selected) + (e.key === "ArrowUp" ? STEP : -STEP) });
    else return;
    e.preventDefault();
  };

  const focus = drag.current ?? selected ?? hover;
  const range = focus === null ? null : allowedRange(state, focus);
  const cels = celebrations(state.blocks);
  const gridLevels = Array.from({ length: Math.round(yMax / STEP) + 1 }, (_, i) => r4(i * STEP));
  const xTicks: number[] = [];
  for (let a = x0; a <= x0 + n; a += 5) xTicks.push(a);

  return (
    <div ref={box} className="w-full select-none">
      <svg width={W} height={H} tabIndex={0} role="application"
        aria-label={`보험금 스케줄 편집기. ${first}세 이후 연령을 클릭하고 위아래로 드래그하거나 화살표 키로 조정`}
        className="block touch-none rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-sky"
        style={{ cursor: focus !== null && focus >= first ? "ns-resize" : "default" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}
        onPointerLeave={() => setHover(null)} onKeyDown={onKey}>
        <rect x={xs(x0)} y={M.top} width={xs(first) - xs(x0)} height={ph} fill="#4a90c2" fillOpacity={0.1} />
        <text x={xs(x0) + 6} y={M.top + 14} fontSize={11} fill="#1b2845">초기 고정 {x0}~{first - 1}세</text>
        {gridLevels.map((m) => (
          <line key={m} x1={M.left} x2={W - M.right} y1={ys(m)} y2={ys(m)} stroke="#1b2845" strokeOpacity={Math.round(m * 10) % 5 === 0 ? 0.15 : 0.05} />
        ))}
        {gridLevels.filter((m) => Math.round(m * 10) % 5 === 0).map((m) => (
          <text key={m} x={M.left - 6} y={ys(m) + 4} fontSize={11} textAnchor="end" fill="#1b2845">
            {amount ? `${Math.round((m * S0) / 1e4).toLocaleString()}만` : `${m}배`}
          </text>
        ))}
        {xTicks.map((a) => (
          <g key={a}>
            <line x1={xs(a)} x2={xs(a)} y1={M.top} y2={M.top + ph} stroke="#1b2845" strokeOpacity={0.08} />
            <text x={xs(a)} y={H - 8} fontSize={11} textAnchor="middle" fill="#1b2845">{a}세</text>
          </g>
        ))}
        <path d={area} fill="#1b2845" fillOpacity={0.06} />
        <path d={line} fill="none" stroke="#1b2845" strokeWidth={2.5} />
        {cels.map((c) => (
          <g key={c.fromAge}>
            <circle cx={xs(c.fromAge)} cy={ys(at(c.fromAge))} r={6} fill="#4a90c2" stroke="#fff" strokeWidth={2} />
            <text x={xs(c.fromAge)} y={ys(at(c.fromAge)) - 12} fontSize={11} textAnchor="middle" fill="#1b2845">축하금 {won(c.multiple * S0)}</text>
          </g>
        ))}
        {focus !== null && range && (
          <g>
            <line x1={xs(focus)} x2={xs(focus)} y1={M.top} y2={M.top + ph} stroke="#4a90c2" strokeDasharray="3 3" />
            {range.editable && <rect x={xs(focus) - 3} y={ys(range.max)} width={6} height={Math.max(2, ys(range.min) - ys(range.max))} rx={3} fill="#4a90c2" fillOpacity={0.35} />}
            <circle cx={xs(focus)} cy={ys(at(focus))} r={5} fill="#fff" stroke="#4a90c2" strokeWidth={2} />
            <text x={Math.min(xs(focus) + 8, W - 170)} y={Math.max(M.top + 12, ys(at(focus)) - 10)} fontSize={12} fontWeight={600} fill="#1b2845">{focus}세 {label(at(focus))}</text>
            <text x={Math.min(xs(focus) + 8, W - 170)} y={Math.max(M.top + 26, ys(at(focus)) + 4)} fontSize={11} fill={range.editable ? "#1b2845" : "#b91c1c"}>
              {range.editable ? `${range.ref}세부터 ${range.steps}년 → ±${range.steps}칸` : "고정 구간 (편집 불가)"}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}
```

- [ ] **Step 2: 타입 확인** — `npx tsc --noEmit` (Task 1의 시그니처 변경으로 `block-cards.tsx` 오류가 남아 있을 수 있음; 이 파일 자체의 오류만 0이면 된다).

- [ ] **Step 3: 커밋** — `git add components/canvas/schedule-editor.tsx && git commit -m "feat(ui): SVG schedule editor with stepwise drag and keyboard"`

---

### Task 3: 축하금 바, 카드 껍데기(확대), 카드 편집기 정리

**Files:**
- Create: `components/canvas/celebration-bar.tsx`
- Replace: `components/canvas/schedule-chart.tsx`
- Modify: `components/canvas/block-cards.tsx`, `components/canvas/preset-picker.tsx`

- [ ] **Step 1: 축하금 바**

`components/canvas/celebration-bar.tsx`:
```tsx
"use client";
import { useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, NumInput } from "@/components/ui";
import { won } from "@/lib/format";
import { CELEBRATION_RATIO, celebrations, endAgeOf } from "@/lib/state";

/** 축하금은 나이만 고른다. 금액은 해당 연령 사망보험금의 10%로 리듀서가 정한다. */
export function CelebrationBar() {
  const { state, dispatch } = useDesign();
  const x0 = state.profile.age, endAge = endAgeOf(state.profile);
  const [age, setAge] = useState(Math.min(x0 + 25, endAge));
  const cels = celebrations(state.blocks);
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
      <span className="text-navy/70">축하금 (해당 연령 보험금의 {CELEBRATION_RATIO * 100}%)</span>
      <div className="w-20"><NumInput value={age} min={x0} max={endAge + 1} onCommit={(v) => setAge(Math.min(endAge + 1, Math.max(x0, Math.round(v))))} /></div>
      <span className="text-navy/60">세 (경과 {age - x0}년)</span>
      <Button onClick={() => dispatch({ type: "addCelebration", age })} disabled={cels.some((c) => c.fromAge === age)}>추가</Button>
      {cels.map((c, i) => (
        <span key={c.fromAge} className="inline-flex items-center gap-1 rounded-full bg-sky/10 px-2 py-0.5 text-xs text-navy">
          {c.fromAge}세 · {won(c.multiple * state.S0)}
          <button type="button" aria-label={`${c.fromAge}세 축하금 삭제`} className="ml-1 text-navy/50 hover:text-red-600" onClick={() => dispatch({ type: "removeCelebration", index: i })}>×</button>
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 카드 껍데기 교체**

`components/canvas/schedule-chart.tsx` 전체 교체:
```tsx
"use client";
import { useRef, useState } from "react";
import { useDesign } from "@/components/design-provider";
import { Button, Card } from "@/components/ui";
import { won } from "@/lib/format";
import { STEP } from "@/lib/state";
import { CelebrationBar } from "./celebration-bar";
import { ScheduleEditor } from "./schedule-editor";

export function ScheduleChart() {
  const { state } = useDesign();
  const [amount, setAmount] = useState(true);
  const dlg = useRef<HTMLDialogElement>(null);
  const toggle = <Button onClick={() => setAmount(!amount)}>{amount ? "배수로 보기" : "금액으로 보기"}</Button>;
  return (
    <Card title="보험금 스케줄">
      <div className="-mt-2 mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-navy/60">
        <span>연령을 클릭한 뒤 위아래로 드래그 · 1칸 = 기준보험금의 {STEP * 100}% ({won(STEP * state.S0)}) · 마지막 변경 후 지난 연수만큼 이동 가능</span>
        <span className="flex gap-2">{toggle}<Button onClick={() => dlg.current?.showModal()}>확대</Button></span>
      </div>
      <ScheduleEditor height={400} amount={amount} />
      <CelebrationBar />
      <dialog ref={dlg} className="m-auto w-[min(96vw,1400px)] rounded-lg bg-white p-4 shadow-xl backdrop:bg-navy/50"
        onClick={(e) => { if (e.target === e.currentTarget) e.currentTarget.close(); }}>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-display text-lg text-navy">보험금 스케줄</h2>
          <span className="flex gap-2">{toggle}<Button onClick={() => dlg.current?.close()}>닫기</Button></span>
        </div>
        <ScheduleEditor height={560} amount={amount} />
        <CelebrationBar />
      </dialog>
    </Card>
  );
}
```

- [ ] **Step 3: 카드 편집기 축하금 행**

`components/canvas/block-cards.tsx`에서 축하금 `<li>`의 두 번째 칸(배수 `NumInput`)을 파생값 표시로 바꾸고, 추가 버튼의 `multiple` 인자를 없앤다:
```tsx
            <div className="text-xs text-navy/60">보험금의 10% = {won(c.multiple * state.S0)}</div>
```
```tsx
      <Button className="mt-2" onClick={() => dispatch({ type: "addCelebration", age: Math.min(age + 10, endAge) })}>+ 축하금 추가</Button>
```
`<li>`의 grid는 `grid-cols-[auto_1fr_auto]`로 바꾼다.

- [ ] **Step 4: 프리셋 6열** — `preset-picker.tsx`의 grid 클래스를 `grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6`로.

- [ ] **Step 5: 검증** — `npx tsc --noEmit`, `./node_modules/.bin/eslint app components lib`, `npm run build 2>&1 | tail -6`, Run tests → 0 failed.

- [ ] **Step 6: 커밋** — `git add components/canvas && git commit -m "feat(ui): celebration bar, enlarged schedule dialog, derived celebration amounts"`

---

### Task 4: 레이아웃 — 왼쪽 예산·계약, 오른쪽 그래프 중심

**Files:**
- Modify: `app/design/page.tsx`

- [ ] **Step 1: 페이지**

`app/design/page.tsx` 전체 교체:
```tsx
"use client";
import { useState, type ReactNode } from "react";
import { BlockCards } from "@/components/canvas/block-cards";
import { BudgetPanel } from "@/components/canvas/budget-panel";
import { InputSummary } from "@/components/canvas/input-summary";
import { PresetPicker } from "@/components/canvas/preset-picker";
import { ScheduleChart } from "@/components/canvas/schedule-chart";
import { useDesign } from "@/components/design-provider";
import { Evidence } from "@/components/result/evidence";
import { PremiumSummary } from "@/components/result/premium-summary";
import { ResultChart } from "@/components/result/result-chart";
import { ValidationBadges } from "@/components/result/validation-badges";
import { Button } from "@/components/ui";

const TABS = ["입력", "설계"] as const;
type Tab = (typeof TABS)[number];

export default function DesignPage() {
  const { loaded } = useDesign();
  const [tab, setTab] = useState<Tab>("설계");
  if (!loaded) return null;
  const col = (name: Tab, node: ReactNode) => <div className={`${tab === name ? "block" : "hidden"} space-y-4 lg:block`}>{node}</div>;
  return (
    <>
      <div className="mb-4 flex gap-2 lg:hidden">
        {TABS.map((t) => <Button key={t} primary={tab === t} aria-pressed={tab === t} onClick={() => setTab(t)}>{t}</Button>)}
      </div>
      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {col("입력", <><BudgetPanel /><InputSummary /></>)}
        {col("설계", (
          <>
            <PresetPicker />
            <ScheduleChart />
            <div className="grid gap-4 xl:grid-cols-2">
              <div className="space-y-4"><PremiumSummary /><ValidationBadges /></div>
              <ResultChart />
            </div>
            <BlockCards />
            <Evidence />
          </>
        ))}
      </div>
    </>
  );
}
```

- [ ] **Step 2: 검증** — `npx tsc --noEmit`, eslint, `npm run build`, Run tests.

- [ ] **Step 3: 커밋** — `git add app/design && git commit -m "feat(ui): two-column canvas with the schedule editor as the centerpiece"`

---

### Task 5: 문서와 마무리

**Files:**
- Modify: `docs/tkLeen_설계형종신보험_앱개발계획서.md`, `README.md`

- [ ] **Step 1: 계획서 v0.4** — 상태 줄을 `v0.4 (그래프 편집기 반영)`으로, §0.5 아래에 다음 절을 추가하고, §0.2 9번 행 끝에 `→ v0.4에서 1차로 승격(§0.6)`을 덧붙인다:

```markdown
### 0.6 그래프 편집기 결정 (2026-09-10, 객관식 3문항 + 요청 사항)

| # | 항목 | 결정 |
|---|---|---|
| 17 | 편집 방식 | 스케줄 그래프에서 연령을 클릭·드래그(또는 화살표 키)로 보험금을 바꾼다. 카드 편집은 그래프 아래 접힌 보조 기능 |
| 18 | 1칸 | 기준보험금의 10%. 연령 A에서 움직일 수 있는 칸 수 = A − (직전 배수가 시작된 연령, 최소 45세). 예: 40세 가입 → 50세 ±5칸, 이후 60세는 50세부터 ±10칸 |
| 19 | 뒤 구간 | 앞 연령을 움직이면 뒤 구간은 같은 폭만큼 함께 이동. 상한 3배(E04)·하한(E05 20%와 E06 1,000만원 중 큰 쪽)에서 정지 |
| 20 | 축하금 | 나이만 고르면 해당 연령 사망보험금의 10%로 자동 지정. 보험금이 바뀌면 따라간다 |
| 21 | 기준보험금·예산 | 가입 시 1억. 설계 후 월 보험료를 입력하면 배수는 유지한 채 기준보험금이 비례 조정 |
| 22 | 레이아웃 | 왼쪽 예산·계약·입력 요약, 오른쪽 큰 그래프 → 보험료·검증·환급금 곡선 → 카드 편집 → 근거. `<dialog>` 확대 보기 |
```

- [ ] **Step 2: README** — `/design` 행을 `2열 캔버스: 예산·계약·입력 요약 / 보험금 스케줄 편집기(드래그·키보드·확대)·보험료·검증·환급금 곡선·카드 편집·산출 근거`로 바꾸고, 표 아래에 한 줄 추가: `그래프 편집 규칙: 1칸 = 기준보험금 10%, 마지막 변경 후 지난 연수만큼 이동, 축하금 = 해당 연령 보험금의 10%.`

- [ ] **Step 3: 전체 검증** — `npm run build`, Run tests, `./node_modules/.bin/eslint app components lib`.

- [ ] **Step 4: 커밋·푸시** — `git add -A && git commit -m "docs: plan v0.4 schedule editor decisions, README" && git push`

---

## 자체 점검

- 요청 항목 → 태스크: 그래프 내 편집·연 단위 칸 제한·뒤 구간 유지·최소금액 보장 → Task 1·2; 기준 1억·예산 비례 조정 → 기존 `S0`/`BudgetFields` 유지(Task 5 문서화); 축하금 10% 자동 → Task 1·3; 그래프 확대·왼쪽 예산/오른쪽 그래프·아래 추가 그림 → Task 3·4.
- 타입 일관성: `Action`의 `level`·`addCelebration(age)`·`celebration({fromAge})` 시그니처를 Task 1·2·3이 같이 쓴다. `allowedRange` 반환 필드 `editable/prev/ref/steps/min/max`를 Task 2가 그대로 읽는다.
- 프리셋 램프(연 20%)는 수동 편집 규칙(연 10%)보다 완만하지 않지만 envelope(E02)로만 검증한다 — 규칙은 수동 편집에만 적용한다고 §0.6에 적었다.
