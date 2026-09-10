# 설계형 종신보험 (flexible whole life)

보험금을 구간별로 설계하는 종신보험의 보험료·준비금·해약환급금 엔진과 Next.js 앱.

- 계획서: `docs/tkLeen_설계형종신보험_앱개발계획서.md` (§3.4 엔진 명세, §7 골든값)
- 엔진 구현 계획: `docs/superpowers/plans/2026-09-10-engine.md`

## 명령

```bash
npm test                        # vitest 골든·규칙 테스트
node scripts/extract-rates.mjs  # 위험률표 재추출 (../Python_Web_like_Excel 워크북 필요)
npm run dev                     # Next.js 개발 서버
```

## 엔진 `lib/engine`

UI 무관 순수 함수. 진입점은 `compute`, `compareAtBudget`, `validate`, `buildPreset`, `needs` (`lib/engine/index.ts`).

| 모듈 | 내용 |
|---|---|
| `commutation` | 이중탈퇴(사망+납입면제) 생존자표·계산기수 |
| `schedule` | 구간 카드 ↔ 연도별 보험금 배수 벡터 |
| `premium` | 급부 현가, 월납 보정 N*, 순·기준연납·영업보험료, 부가보험료 분해 |
| `reserve` / `surrender` | 연말 준비금, 해약공제·환급금·환급률 |
| `lowSurrender` | 초기 5년 저해지 환급금과 보험료 인하 |
| `compute` | 통합 산출(적용·표준기초, 10만원당 반올림, 사업비 흐름) |
| `presets` / `envelope` | 프리셋 6종, 설계 제약 E01~E08 |
| `needs` / `compare` | 니즈·HLV·프리셋 추천, 같은 예산 3안 비교 |

## 골든값 (10만원당 월 보험료)

| 케이스 | 조건 | 순 | 영업 |
|---|---|---|---|
| G1 정기 | 31세 남 · 90세 만기 · 20년납 · 3.4% · 경영인정기 1504 사업비 | 93 | 133 |
| G2 종신공제 | 59세 남 · 5년납 · 3.5% · 2배(59~64)·축하금 65세 · 써미트 표 | 2,350 | 2,875 |

G1은 준비금·해약환급금(1억 기준 10년 13,417,000 · 20년 31,346,000)까지 1원 일치.
