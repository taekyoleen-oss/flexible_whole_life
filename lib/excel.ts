import * as XLSX from "xlsx";
import { commutation, type EngineResult } from "@/lib/engine";
import { reserveRows } from "./reserve-table";
import { assumptionOf, BENEFIT_LABEL, celebrations, deathSegments, effective, PRODUCT_LABEL, tableOf, type DesignState } from "./state";

/**
 * 계리 검산용 워크북. 값은 엔진 산출값 그대로 넣고, 보험료 시트의 핵심 항목(PVB·N*·순보험료)은
 * 계산기수 시트를 참조하는 Excel 수식으로도 넣어 Excel 안에서 같은 값이 나오는지 확인할 수 있게 한다.
 */
export const SHEETS = ["입력·가정", "위험률·계산기수", "표준기초 계산기수", "보험료 산출", "준비금·환급금", "설계 스케줄"] as const;

type Row = (string | number | boolean | null | { f: string; t?: "n" })[];

function kvSheet(rows: Row[]): XLSX.WorkSheet {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 40 }];
  return ws;
}

/** 계산기수 시트: t, 연령, q, f, lx, l′x, Dx, D′x, Cx, Nx, N′x (1행 헤더, 2행부터 t=0) */
function commutationSheet(sex: DesignState["profile"]["sex"], age: number, n: number, interest: number, q: number[], f: number[]): { ws: XLSX.WorkSheet; rows: number } {
  const k = commutation({ interest, q, f }, age, n);
  const header = ["t", "연령", "q", "f", "lx", "l'x", "Dx", "D'x", "Cx", "Nx", "N'x"];
  const rows: Row[] = [header];
  for (let t = 0; t <= n; t++) rows.push([t, age + t, q[age + t] ?? 0, f[age + t] ?? 0, k.lx[t], k.lxp[t], k.Dx[t], k.Dpx[t], k.Cx[t], k.Nx[t], k.Npx[t]]);
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = header.map(() => ({ wch: 14 }));
  return { ws, rows: n + 1 };
}

export function buildWorkbook(s: DesignState, r: EngineResult): XLSX.WorkBook {
  const a = assumptionOf(s), p = s.profile, rs = tableOf(p)[p.sex];
  const eff = effective(r, s.payYears);
  const wb = XLSX.utils.book_new();
  const zero = new Array<number>(rs.q.length).fill(0);

  // 1. 입력·가정
  const exp = a.expenses;
  const expRows: Row[] = exp.model === "method"
    ? [["사업비 모형", "산출방법서형"], ["α_S 신계약비 정액", exp.alphaS], ["α_P 신계약비율", exp.alphaP], ["β_S 유지비 정액", exp.betaS], ["β_G 유지비율", exp.betaG], ["β′ 납입 후 유지비", exp.betaPrime], ["γ 수금비율", exp.gamma]]
    : [["사업비 모형", "3이원 단순형"], ["α", exp.alpha], ["β", exp.beta], ["γ", exp.gamma]];
  const inputRows: Row[] = [
    ["항목", "값", "비고"],
    ["작성 시각", new Date().toLocaleString("ko-KR"), `${PRODUCT_LABEL[p.product]} 앱 검산 파일`],
    ["성별", p.sex === "M" ? "남" : "여"], ["가입연령", p.age], ["최종연령 ω", r.omega], ["보장기간 n", r.n],
    ["기준보험금 S0 (원)", s.S0], ["납입기간 m", s.payYears], ["납입 횟수/년", 12],
    ["납입면제", s.waiver], ["저해지", s.lowSurrender, s.lowSurrender ? `납입기간 중 환급금 ${a.lowSurrender.ratio * 100}% · 보험료 −${a.lowSurrender.premiumDiscount * 100}%` : ""],
    ["프리셋", s.presetId], ["변경점", s.anchors.join(", ") || "없음"],
    [], ["가정 세트", a.id, a.label], ["버전", a.version], ["예정이율", a.interest], ["표준이율", a.standardInterest], ["위험률", "제7회 경험생명표 (kli7)"],
    ...expRows,
    [], ["설계 제약", ""], ...Object.entries(s.settings.envelope).map(([k, v]) => [k, v] as Row),
    [], [`${BENEFIT_LABEL[p.product]} 구간 카드`, "배수", "연령"], ...deathSegments(s.blocks).map((b) => [`${b.fromAge}~${b.toAge}세`, b.multiple] as Row),
    ["축하금", "배수", "연령"], ...celebrations(s.blocks).map((c) => [`${c.fromAge}세`, c.multiple] as Row),
  ];
  XLSX.utils.book_append_sheet(wb, kvSheet(inputRows), SHEETS[0]);

  // 2·3. 계산기수(적용·표준)
  const k1 = commutationSheet(p.sex, p.age, r.n, a.interest, rs.q, s.waiver ? rs.f : zero);
  XLSX.utils.book_append_sheet(wb, k1.ws, SHEETS[1]);
  const k2 = commutationSheet(p.sex, p.age, r.n, a.standardInterest, rs.qStd, s.waiver ? rs.fStd : zero);
  XLSX.utils.book_append_sheet(wb, k2.ws, SHEETS[2]);

  // 4. 보험료 산출 — 값 + Excel 수식(계산기수 시트 참조)
  const K = `'${SHEETS[1]}'`;
  const first = 2, lastS = first + r.n - 1, lastC = first + r.n;           // S: t=0..n−1, C: t=0..n
  const mRow = first + s.payYears;                                           // t=m 행
  const kApplied = commutation({ interest: a.interest, q: rs.q, f: s.waiver ? rs.f : zero }, p.age, r.n);
  const premiumRows: Row[] = [
    ["항목", "엔진 값", "Excel 수식(검산)", "설명"],
    ["급부 현가 PVB", r.perUnit.pvb, { f: `SUMPRODUCT('${SHEETS[5]}'!C${first}:C${lastS},${K}!I${first}:I${lastS})+SUMPRODUCT('${SHEETS[5]}'!D${first}:D${lastC},${K}!G${first}:G${lastC})`, t: "n" }, "Σ S_t·Cx + Σ C_t·Dx"],
    ["월납 보정 납입기수 N*", r.perUnit.nStar, { f: `12*((${K}!K${first}-${K}!K${mRow})-11/24*(${K}!H${first}-${K}!H${mRow}))`, t: "n" }, "12[(N′0−N′m) − 11/24(D′0−D′m)]"],
    ["순보험료 P (1단위·월)", r.perUnit.net, { f: "B2/B3", t: "n" }, "PVB / N*"],
    ["기준연납순보험료", r.perUnit.base, null, "PVB/(N′0−N′min(n,20))"],
    ["β′ 포함 연납순보험료 P_β", r.perUnit.pBeta, null, "준비금용"],
    ["영업보험료 G (1단위·월)", r.perUnit.gross, null, "사업비 포함"],
    ["신계약비 α (1단위)", r.perUnit.alpha, null, "α_S + α_P·round5(기준연납)"],
    [], ["10만원당 (원, 반올림)", ""], ["순보험료", r.per100k.net], ["기준연납순보험료", r.per100k.base], ["영업보험료", r.per100k.gross], ["신계약비 산출", r.per100k.alpha], ["신계약비 표준", r.per100k.alphaStd], ["해약공제 기준 신계약비", r.per100k.newBiz],
    [], ["가입금액 기준 (원)", ""], ["월 순보험료", r.monthly.net], ["월 영업보험료(표준형)", r.monthly.gross], ["월 영업보험료(고객 납입)", eff.monthly], ["총 납입보험료", eff.totalPaid],
    [], ["부가보험료 분해 (1회 납입, 원)", ""], ["α", r.loading.alpha], ["β_S", r.loading.betaS], ["β′", r.loading.betaPrime], ["β_G", r.loading.betaG], ["γ", r.loading.gamma],
    [], ["검산 메모", `Dx0 = ${kApplied.Dx[0]} (라딕스 100,000). 수식 셀 값이 엔진 값과 같으면 검산 통과.`],
  ];
  XLSX.utils.book_append_sheet(wb, kvSheet(premiumRows), SHEETS[3]);

  // 5. 준비금·환급금
  const rows = reserveRows(s, r);
  const resRows: Row[] = [["경과년", "연령", BENEFIT_LABEL[p.product], "축하금", "납입누계", "적용준비금", "표준준비금", "해약환급금", "환급률", "사업비(연)", "적용준비금(10만원당)", "표준준비금(10만원당)"]];
  for (const x of rows) resRows.push([x.t, x.age, x.benefit, x.celebration, x.paid, x.reserve, x.reserveStd, x.cash, x.rate, x.expense, r.reserve100k[x.t], r.reserveStd100k[x.t]]);
  const wsRes = XLSX.utils.aoa_to_sheet(resRows); wsRes["!cols"] = resRows[0].map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsRes, SHEETS[4]);

  // 6. 설계 스케줄 (배수 벡터: 보험료 시트 수식이 참조)
  const schRows: Row[] = [["t", "연령", "S_t (배수)", "C_t (축하금 배수)", `${BENEFIT_LABEL[p.product]}(원)`, "축하금(원)"]];
  for (let t = 0; t <= r.n; t++) schRows.push([t, p.age + t, t < r.n ? r.S[t] : null, r.C[t] ?? 0, t < r.n ? r.S[t] * s.S0 : null, (r.C[t] ?? 0) * s.S0]);
  const wsSch = XLSX.utils.aoa_to_sheet(schRows); wsSch["!cols"] = schRows[0].map(() => ({ wch: 16 }));
  XLSX.utils.book_append_sheet(wb, wsSch, SHEETS[5]);
  return wb;
}

/** 브라우저에서 .xlsx 다운로드 */
export function downloadWorkbook(s: DesignState, r: EngineResult, filename: string): void {
  XLSX.writeFile(buildWorkbook(s, r), filename, { compression: true });
}
