"""
generate_demo_data.py

Generates a synthetic calibration dataset for the AI Eval Calibration Dashboard demo.
Outputs: demo_calibration_data.csv (2,520 rows)

Patterns intentionally embedded:
  1. Criterion-level disagreement: 'tone' and 'consistency' have high inter-rater variance
  2. Evaluator bias: eval_01/eval_02 are lenient (70%+ score=2), eval_11/eval_12 are strict (30%+ score=0)
  3. Controversial content: content_005, content_012, content_023 — scores 0~2 evenly distributed
  4. High-agreement content (control): content_001, content_010, content_020 — near-uniform scores
"""

import csv
import random
import statistics
from pathlib import Path

# ── Config ─────────────────────────────────────────────────────────────────────
RANDOM_SEED = 42
NUM_EVALUATORS = 12
NUM_CONTENTS = 30
CRITERIA = ["accuracy", "completeness", "consistency", "clarity", "relevance", "conciseness", "tone"]
OUTPUT_FILE = Path(__file__).parent / "demo_calibration_data.csv"

# ── Reason templates (Korean, 5+ variants per criterion) ──────────────────────
REASONS = {
    "accuracy": [
        "사실과 다른 정보가 포함되어 있음",
        "출처와 일치하지 않는 내용이 서술됨",
        "수치 오류가 발견됨",
        "잘못된 날짜 또는 인물 정보가 포함됨",
        "검증되지 않은 내용이 단정적으로 기술됨",
        "핵심 사실 관계가 뒤바뀌어 서술됨",
    ],
    "completeness": [
        "핵심 정보가 누락됨",
        "요청 범위의 절반만 다룸",
        "중요한 예외 사항이 언급되지 않음",
        "결론 부분이 생략됨",
        "요청한 항목 중 일부가 다뤄지지 않음",
        "배경 설명이 빠져 맥락 파악이 어려움",
    ],
    "consistency": [
        "앞뒤 문맥이 모순됨",
        "동일 개념에 다른 용어를 혼용",
        "초반과 후반의 주장이 상충됨",
        "같은 수치를 다르게 표기함",
        "문단 간 논리 흐름이 단절됨",
        "입장이 중간에 바뀌어 혼선을 야기함",
    ],
    "clarity": [
        "문장 구조가 모호하여 의미 파악 어려움",
        "전문 용어 설명 없이 사용됨",
        "지시어 지칭 대상이 불명확함",
        "문장이 지나치게 길어 가독성이 떨어짐",
        "핵심 메시지가 어디인지 파악하기 어려움",
        "단락 구분이 없어 내용 흐름을 따라가기 어려움",
    ],
    "relevance": [
        "주제와 무관한 내용이 포함됨",
        "질문에 대한 직접적 답변이 아님",
        "요청 범위를 벗어난 부가 설명이 과도함",
        "중심 주제에서 벗어나 지엽적 내용에 집중함",
        "답변이 다른 질문에 더 적합한 내용으로 구성됨",
        "배경 설명이 지나쳐 본론이 묻힘",
    ],
    "conciseness": [
        "불필요한 반복이 많음",
        "핵심 대비 분량이 과도함",
        "같은 내용을 다른 표현으로 여러 번 서술함",
        "간결하게 전달 가능한 내용을 길게 풀어씀",
        "서론이 너무 길어 본론에 도달하기까지 시간이 걸림",
        "불필요한 수식어와 부연 설명이 많음",
    ],
    "tone": [
        "비격식적 표현이 부적절하게 사용됨",
        "톤이 대상 독자에 맞지 않음",
        "지나치게 딱딱한 표현으로 전달력이 낮음",
        "감정적 표현이 과도하게 사용됨",
        "대상 연령층에 맞지 않는 어조가 사용됨",
        "전문적 맥락에서 부적절한 구어체가 포함됨",
    ],
}

# ── Score probability distributions ───────────────────────────────────────────

def get_score_weights(evaluator_id: str, criterion: str, content_id: str) -> list[float]:
    """Return [P(0), P(1), P(2)] weights for this (evaluator, criterion, content) triple."""
    # Default: balanced
    weights = [0.20, 0.45, 0.35]

    # Pattern 2 — evaluator bias
    if evaluator_id in ("eval_01", "eval_02"):
        weights = [0.05, 0.20, 0.75]  # lenient
    elif evaluator_id in ("eval_11", "eval_12"):
        weights = [0.35, 0.40, 0.25]  # strict

    # Pattern 1 — criterion-level disagreement (tone & consistency)
    if criterion in ("tone", "consistency"):
        # Flatten the distribution to increase variance
        weights = [weights[0] * 1.5, weights[1] * 0.7, weights[2] * 1.2]

    # Pattern 3 — controversial content: nearly uniform distribution
    if content_id in ("content_005", "content_012", "content_023"):
        weights = [0.33, 0.34, 0.33]

    # Pattern 4 — high-agreement content: skew strongly toward 2
    if content_id in ("content_001", "content_010", "content_020"):
        weights = [0.02, 0.08, 0.90]

    # Normalize
    total = sum(weights)
    return [w / total for w in weights]


def pick_score(weights: list[float], rng: random.Random) -> int:
    return rng.choices([0, 1, 2], weights=weights, k=1)[0]


def pick_reason(criterion: str, rng: random.Random) -> str:
    return rng.choice(REASONS[criterion])


# ── Main generation ────────────────────────────────────────────────────────────

def generate(seed: int = RANDOM_SEED) -> list[dict]:
    rng = random.Random(seed)
    rows = []

    for c_num in range(1, NUM_CONTENTS + 1):
        content_id = f"content_{c_num:03d}"
        for e_num in range(1, NUM_EVALUATORS + 1):
            evaluator_id = f"eval_{e_num:02d}"
            for criterion in CRITERIA:
                weights = get_score_weights(evaluator_id, criterion, content_id)
                score = pick_score(weights, rng)
                reason = pick_reason(criterion, rng) if score == 0 else ""
                rows.append({
                    "content_id": content_id,
                    "evaluator_id": evaluator_id,
                    "criterion": criterion,
                    "score": score,
                    "reason": reason,
                })

    return rows


def save_csv(rows: list[dict], path: Path) -> None:
    with open(path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["content_id", "evaluator_id", "criterion", "score", "reason"])
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} rows → {path}")


# ── Summary statistics ─────────────────────────────────────────────────────────

def print_summary(rows: list[dict]) -> None:
    scores = [r["score"] for r in rows]
    total = len(scores)

    print("\n=== Overall Score Distribution ===")
    for s in [0, 1, 2]:
        count = scores.count(s)
        print(f"  Score {s}: {count:>5} ({count/total*100:.1f}%)")

    print("\n=== Mean Score by Criterion ===")
    for criterion in CRITERIA:
        vals = [r["score"] for r in rows if r["criterion"] == criterion]
        print(f"  {criterion:<14}: {statistics.mean(vals):.3f}")

    print("\n=== Mean Score by Evaluator ===")
    for e_num in range(1, NUM_EVALUATORS + 1):
        evaluator_id = f"eval_{e_num:02d}"
        vals = [r["score"] for r in rows if r["evaluator_id"] == evaluator_id]
        print(f"  {evaluator_id}: {statistics.mean(vals):.3f}")

    print("\n=== Top 10 Content-Criterion Combos by Std Dev ===")
    combos = {}
    for r in rows:
        key = (r["content_id"], r["criterion"])
        combos.setdefault(key, []).append(r["score"])

    ranked = sorted(
        [(key, statistics.stdev(vals)) for key, vals in combos.items() if len(vals) > 1],
        key=lambda x: x[1],
        reverse=True,
    )
    for (content_id, criterion), stdev in ranked[:10]:
        vals = combos[(content_id, criterion)]
        print(f"  {content_id} / {criterion:<14}: stdev={stdev:.3f}  scores={sorted(vals)}")


# ── Entry point ────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    rows = generate(seed=RANDOM_SEED)
    save_csv(rows, OUTPUT_FILE)
    print_summary(rows)
