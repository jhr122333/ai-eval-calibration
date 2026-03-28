# AI 평가 캘리브레이션 대시보드

평가자 간 점수 차이, 한눈에 파악하세요.

---

## v1.0

### 주요 기능

- **CSV / Excel 업로드** — 평가 데이터를 바로 불러와 분석
- **데모 데이터 제공** — 파일 없이도 즉시 체험 가능
- **개요 대시보드** — 전체 평가 현황, 불일치율, 점수 분포 시각화
- **평가자 분석** — 평가자별 편향 패턴 및 점수 성향 비교
- **콘텐츠 분석** — 항목별 논쟁 지수 및 평가자 간 불일치 탐지
- **평가 가이드라인** — SOP 문서 인앱 열람

### 기술 스택

| 영역 | 라이브러리 |
|------|-----------|
| UI 프레임워크 | React 19 + Vite |
| 스타일링 | Tailwind CSS v4 |
| 차트 | Recharts |
| CSV 파싱 | PapaParse |
| Excel 파싱 | xlsx |
| 마크다운 렌더링 | react-markdown |

### 데이터 형식

업로드할 CSV / Excel 파일에는 아래 칼럼이 필요합니다.

```
content_id, evaluator_id, criterion, score, reason
```

- `score` — 0, 1, 2 중 하나
- `reason` — `score=0`일 때만 필수

### 로컬 실행

```bash
npm install
npm run dev
```

---

> 계속 업데이트 예정입니다.
