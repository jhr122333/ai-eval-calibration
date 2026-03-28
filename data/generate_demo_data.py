"""
generate_demo_data.py

Generates a synthetic primary-vs-secondary review dataset for the calibration
dashboard demo.

Outputs:
  - data/demo_calibration_data.csv
  - public/demo_calibration_data.csv

Patterns intentionally embedded:
  1. Primary evaluator accuracy differences: eval_01/eval_02 are strong,
     eval_11/eval_12 are frequently corrected.
  2. Reviewer variance: reviewers are mostly aligned, but review_03 is slightly
     stricter and review_04 is slightly more lenient.
  3. Criterion difficulty: tone, consistency, and completeness have higher
     correction rates than other criteria.
  4. Controversial contents: content_005, content_012, content_023 produce more
     review changes.
"""

from __future__ import annotations

import csv
import random
from pathlib import Path

RANDOM_SEED = 42
NUM_PRIMARY_EVALUATORS = 12
NUM_REVIEWERS = 4
NUM_CONTENTS = 30
CRITERIA = [
    "accuracy",
    "completeness",
    "consistency",
    "clarity",
    "relevance",
    "conciseness",
    "tone",
]

DATA_OUTPUT = Path(__file__).parent / "demo_calibration_data.csv"
PUBLIC_OUTPUT = Path(__file__).resolve().parent.parent / "public" / "demo_calibration_data.csv"

PRIMARY_REASON_TEMPLATES = {
    "accuracy": [
        "핵심 사실 검증이 충분하지 않음",
        "수치 근거가 약해 1차에서 낮게 판단함",
        "출처 불일치 가능성이 보여 감점함",
    ],
    "completeness": [
        "필수 요소 일부가 빠졌다고 판단함",
        "요청 범위를 충분히 다루지 못했다고 봄",
        "결론 정보가 부족해 낮게 평가함",
    ],
    "consistency": [
        "앞뒤 논리 연결이 약하다고 판단함",
        "용어 사용이 흔들린다고 봄",
        "문단 간 주장이 완전히 정렬되지 않음",
    ],
    "clarity": [
        "문장이 다소 길어 이해가 느려짐",
        "핵심 메시지가 빠르게 드러나지 않음",
        "독자가 한 번 더 읽어야 할 표현이 있음",
    ],
    "relevance": [
        "본론과 직접 관련 없는 설명이 섞여 있음",
        "질문 의도와 다소 비껴간다고 판단함",
        "부가 설명 비중이 높아 감점함",
    ],
    "conciseness": [
        "같은 메시지가 반복된다고 느낌",
        "핵심 대비 설명량이 많다고 판단함",
        "조금 더 압축 가능하다고 봄",
    ],
    "tone": [
        "대상 독자 대비 어조가 어색하다고 판단함",
        "표현 톤이 문맥과 살짝 어긋난다고 봄",
        "격식 수준이 기대치와 맞지 않는다고 판단함",
    ],
}

SECONDARY_REASON_TEMPLATES = {
    "accuracy": [
        "검수 기준상 사실 근거가 불충분함",
        "SOP 기준으로는 사실 정확성 감점이 필요함",
        "검수 시점에 근거 부족으로 수정함",
    ],
    "completeness": [
        "검수 기준상 핵심 항목 누락이 확인됨",
        "요청된 범위를 다 채우지 못해 수정함",
        "필수 정보 부족으로 2차 점수를 조정함",
    ],
    "consistency": [
        "SOP 기준상 내부 논리 불일치가 보임",
        "검수 시 용어 혼선이 더 크게 판단됨",
        "문맥 모순이 있어 2차에서 수정함",
    ],
    "clarity": [
        "검수 기준상 독자 이해를 방해하는 표현이 있음",
        "문장 구조가 SOP 기준보다 모호함",
        "가독성 문제로 점수를 조정함",
    ],
    "relevance": [
        "질문과 직접 연결되지 않는 설명이 과함",
        "SOP 기준상 주제 이탈이 확인됨",
        "검수 시 관련성 부족으로 수정함",
    ],
    "conciseness": [
        "반복 서술이 검수 기준을 넘는다고 판단함",
        "SOP 기준상 군더더기가 있어 조정함",
        "핵심 대비 분량 과다로 점수를 수정함",
    ],
    "tone": [
        "검수 기준상 문맥에 맞지 않는 톤이 확인됨",
        "어조가 대상 독자 기대와 달라 수정함",
        "SOP 톤 기준과 차이가 있어 2차 조정함",
    ],
}


def clamp_score(score: int) -> int:
    return max(0, min(2, score))


def choose_reason(score: int, criterion: str, templates: dict[str, list[str]], rng: random.Random) -> str:
    if score != 0:
        return ""
    return rng.choice(templates[criterion])


def base_secondary_score(content_id: str, criterion: str, rng: random.Random) -> int:
    weights = [0.14, 0.36, 0.50]

    if criterion in {"tone", "consistency"}:
        weights = [0.24, 0.34, 0.42]
    elif criterion == "completeness":
        weights = [0.18, 0.40, 0.42]

    if content_id in {"content_005", "content_012", "content_023"}:
        weights = [0.30, 0.36, 0.34]
    elif content_id in {"content_001", "content_010", "content_020"}:
        weights = [0.05, 0.20, 0.75]

    return rng.choices([0, 1, 2], weights=weights, k=1)[0]


def primary_adjustment(evaluator_id: str, criterion: str, content_id: str, rng: random.Random) -> int:
    adjustment = 0

    if evaluator_id in {"eval_01", "eval_02"}:
        adjustment += rng.choices([-1, 0, 1], weights=[0.10, 0.55, 0.35], k=1)[0]
    elif evaluator_id in {"eval_11", "eval_12"}:
        adjustment += rng.choices([-1, 0, 1], weights=[0.40, 0.45, 0.15], k=1)[0]
    else:
        adjustment += rng.choices([-1, 0, 1], weights=[0.20, 0.60, 0.20], k=1)[0]

    if criterion == "tone":
        adjustment += rng.choices([-1, 0, 1], weights=[0.28, 0.44, 0.28], k=1)[0]
    elif criterion == "consistency":
        adjustment += rng.choices([-1, 0, 1], weights=[0.26, 0.48, 0.26], k=1)[0]
    elif criterion == "completeness":
        adjustment += rng.choices([-1, 0, 1], weights=[0.22, 0.56, 0.22], k=1)[0]

    if content_id in {"content_005", "content_012", "content_023"}:
        adjustment += rng.choices([-1, 0, 1], weights=[0.30, 0.40, 0.30], k=1)[0]

    return adjustment


def secondary_adjustment(reviewer_id: str, rng: random.Random) -> int:
    if reviewer_id == "review_03":
        return rng.choices([-1, 0, 1], weights=[0.35, 0.55, 0.10], k=1)[0]
    if reviewer_id == "review_04":
        return rng.choices([-1, 0, 1], weights=[0.10, 0.55, 0.35], k=1)[0]
    return rng.choices([-1, 0, 1], weights=[0.15, 0.70, 0.15], k=1)[0]


def generate(seed: int = RANDOM_SEED) -> list[dict[str, str | int]]:
    rng = random.Random(seed)
    rows: list[dict[str, str | int]] = []

    for content_number in range(1, NUM_CONTENTS + 1):
        content_id = f"content_{content_number:03d}"
        for evaluator_number in range(1, NUM_PRIMARY_EVALUATORS + 1):
            primary_evaluator_id = f"eval_{evaluator_number:02d}"
            reviewer_id = f"review_{((evaluator_number - 1) % NUM_REVIEWERS) + 1:02d}"

            for criterion in CRITERIA:
                secondary_score = clamp_score(
                    base_secondary_score(content_id, criterion, rng)
                    + secondary_adjustment(reviewer_id, rng)
                )
                primary_score = clamp_score(
                    secondary_score + primary_adjustment(primary_evaluator_id, criterion, content_id, rng)
                )

                rows.append(
                    {
                        "content_id": content_id,
                        "primary_evaluator_id": primary_evaluator_id,
                        "reviewer_id": reviewer_id,
                        "criterion": criterion,
                        "primary_score": primary_score,
                        "secondary_score": secondary_score,
                        "primary_reason": choose_reason(primary_score, criterion, PRIMARY_REASON_TEMPLATES, rng),
                        "secondary_reason": choose_reason(secondary_score, criterion, SECONDARY_REASON_TEMPLATES, rng),
                    }
                )

    return rows


def save_csv(rows: list[dict[str, str | int]], path: Path) -> None:
    fieldnames = [
        "content_id",
        "primary_evaluator_id",
        "reviewer_id",
        "criterion",
        "primary_score",
        "secondary_score",
        "primary_reason",
        "secondary_reason",
    ]
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Saved {len(rows)} rows -> {path}")


def accuracy(rows: list[dict[str, str | int]]) -> float:
    if not rows:
        return 0.0
    matches = sum(1 for row in rows if row["primary_score"] == row["secondary_score"])
    return matches / len(rows)


def print_summary(rows: list[dict[str, str | int]]) -> None:
    print("\n=== Overall Review Accuracy ===")
    print(f"  Accuracy: {accuracy(rows) * 100:.1f}%")

    changed_rows = [row for row in rows if row["primary_score"] != row["secondary_score"]]
    print(f"  Changed rows: {len(changed_rows)} / {len(rows)}")

    print("\n=== Accuracy by Primary Evaluator ===")
    for evaluator_number in range(1, NUM_PRIMARY_EVALUATORS + 1):
        evaluator_id = f"eval_{evaluator_number:02d}"
        evaluator_rows = [row for row in rows if row["primary_evaluator_id"] == evaluator_id]
        print(f"  {evaluator_id}: {accuracy(evaluator_rows) * 100:5.1f}%")

    print("\n=== Change Rate by Criterion ===")
    for criterion in CRITERIA:
        criterion_rows = [row for row in rows if row["criterion"] == criterion]
        change_rate = 1 - accuracy(criterion_rows)
        print(f"  {criterion:<14}: {change_rate * 100:5.1f}%")

    print("\n=== Top 10 Evaluator-Criterion Change Rates ===")
    ranked: list[tuple[str, str, float, int]] = []
    for evaluator_number in range(1, NUM_PRIMARY_EVALUATORS + 1):
        evaluator_id = f"eval_{evaluator_number:02d}"
        for criterion in CRITERIA:
            subset = [
                row for row in rows
                if row["primary_evaluator_id"] == evaluator_id and row["criterion"] == criterion
            ]
            change_count = sum(1 for row in subset if row["primary_score"] != row["secondary_score"])
            ranked.append((evaluator_id, criterion, change_count / len(subset), change_count))

    ranked.sort(key=lambda item: item[2], reverse=True)
    for evaluator_id, criterion, rate, count in ranked[:10]:
        print(f"  {evaluator_id} / {criterion:<14}: {rate * 100:5.1f}% ({count:>2} changes)")


if __name__ == "__main__":
    generated_rows = generate(seed=RANDOM_SEED)
    save_csv(generated_rows, DATA_OUTPUT)
    save_csv(generated_rows, PUBLIC_OUTPUT)
    print_summary(generated_rows)
