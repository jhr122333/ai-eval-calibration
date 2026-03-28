import { useMemo, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import {
  calculateReviewSummary,
  calculateEvaluatorAccuracy,
  calculateCriterionChangeRates,
} from '../utils/disagreementDetector';

const CRITERION_LABELS = {
  accuracy: '정확성',
  completeness: '완전성',
  consistency: '일관성',
  clarity: '명확성',
  relevance: '관련성',
  conciseness: '간결성',
  tone: '톤 적절성',
};

function percent(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function SummaryCard({ label, value, sub, accent = 'text-slate-900' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-400 mt-1">{sub}</p> : null}
    </div>
  );
}

function CorrectionBadge({ upwardChanges, downwardChanges }) {
  return (
    <div className="flex items-center gap-3 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
        상향 {upwardChanges}
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="w-2 h-2 rounded-full bg-rose-500 inline-block" />
        하향 {downwardChanges}
      </span>
    </div>
  );
}

export default function EvaluatorAnalysis({ data }) {
  const [selectedEvaluator, setSelectedEvaluator] = useState('all');
  const [selectedCriterion, setSelectedCriterion] = useState('all');
  const [selectedDirection, setSelectedDirection] = useState('all');
  const hasReviewComparisonData = useMemo(
    () => data.some((row) => typeof row.primaryScore === 'number' && typeof row.secondaryScore === 'number'),
    [data]
  );

  const reviewSummary = useMemo(
    () => (hasReviewComparisonData ? calculateReviewSummary(data) : null),
    [data, hasReviewComparisonData]
  );
  const evaluatorAccuracy = useMemo(
    () => (hasReviewComparisonData ? calculateEvaluatorAccuracy(data) : []),
    [data, hasReviewComparisonData]
  );
  const criterionChangeRates = useMemo(
    () => (hasReviewComparisonData ? calculateCriterionChangeRates(data) : []),
    [data, hasReviewComparisonData]
  );

  const chartData = useMemo(
    () =>
      evaluatorAccuracy
        .map((item) => ({
          ...item,
          label: item.evaluatorId.replace('eval_', 'E'),
          accuracyPct: Number((item.accuracy * 100).toFixed(1)),
          changeRatePct: Number((item.changeRate * 100).toFixed(1)),
        }))
        .sort((a, b) => a.accuracyPct - b.accuracyPct),
    [evaluatorAccuracy]
  );

  const criterionChartData = useMemo(
    () =>
      criterionChangeRates.map((item) => ({
        ...item,
        label: CRITERION_LABELS[item.criterion] ?? item.criterion,
        changeRatePct: Number((item.changeRate * 100).toFixed(1)),
      })),
    [criterionChangeRates]
  );

  const changeCases = useMemo(() => {
    if (!hasReviewComparisonData) return [];

    return data
      .filter((row) => typeof row.primaryScore === 'number' && typeof row.secondaryScore === 'number')
      .filter((row) => row.primaryScore !== row.secondaryScore)
      .filter((row) => selectedEvaluator === 'all' || row.primaryEvaluatorId === selectedEvaluator)
      .filter((row) => selectedCriterion === 'all' || row.criterion === selectedCriterion)
      .filter((row) => {
        if (selectedDirection === 'all') return true;
        if (selectedDirection === 'up') return row.secondaryScore > row.primaryScore;
        if (selectedDirection === 'down') return row.secondaryScore < row.primaryScore;
        return true;
      })
      .sort((a, b) => {
        const contentCompare = a.contentId.localeCompare(b.contentId, undefined, { numeric: true });
        if (contentCompare !== 0) return contentCompare;
        return a.criterion.localeCompare(b.criterion);
      });
  }, [data, hasReviewComparisonData, selectedCriterion, selectedDirection, selectedEvaluator]);

  const topChangeCases = useMemo(() => changeCases.slice(0, 20), [changeCases]);

  if (!hasReviewComparisonData) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-amber-700">
        현재 데이터는 1차-2차 비교 스키마가 아니라서 검수 정확도 대시보드를 표시할 수 없습니다.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <SummaryCard
          label="전체 정확도"
          value={percent(reviewSummary.accuracy)}
          sub={`${reviewSummary.totalRows.toLocaleString()}개 평가 항목 기준`}
          accent="text-emerald-600"
        />
        <SummaryCard
          label="변경 건수"
          value={reviewSummary.changedCount.toLocaleString()}
          sub={`상향 ${reviewSummary.upwardChanges}건 · 하향 ${reviewSummary.downwardChanges}건`}
          accent="text-rose-600"
        />
        <SummaryCard
          label="가장 많이 변경된 항목"
          value={CRITERION_LABELS[reviewSummary.worstCriterion?.criterion] ?? reviewSummary.worstCriterion?.criterion ?? '—'}
          sub={reviewSummary.worstCriterion ? `변경률 ${percent(reviewSummary.worstCriterion.changeRate)}` : undefined}
          accent="text-amber-600"
        />
        <SummaryCard
          label="가장 많이 수정된 평가자"
          value={reviewSummary.mostCorrectedEvaluator?.evaluatorId ?? '—'}
          sub={reviewSummary.mostCorrectedEvaluator ? `정확도 ${percent(reviewSummary.mostCorrectedEvaluator.accuracy)}` : undefined}
          accent="text-sky-700"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.6fr_1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">평가자별 정확도</h2>
            <p className="text-sm text-slate-500 mt-1">검수 점수와 일치한 비율입니다. 아래로 갈수록 더 자주 수정됩니다.</p>
          </div>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 20, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 100]} tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={48} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name, payload) => {
                  if (name === 'accuracyPct') return [`${value}%`, '정확도'];
                  return [`${value}%`, '변경률'];
                }}
                labelFormatter={(_, entries) => entries?.[0]?.payload?.evaluatorId ?? ''}
              />
              <Bar dataKey="accuracyPct" radius={[0, 6, 6, 0]}>
                {chartData.map((entry) => (
                  <Cell
                    key={entry.evaluatorId}
                    fill={entry.accuracy >= 0.7 ? '#10b981' : entry.accuracy >= 0.6 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">수정이 많은 평가자</h2>
            <p className="text-sm text-slate-500 mt-1">누가 SOP 기준과 가장 자주 어긋나는지 빠르게 보는 랭킹입니다.</p>
          </div>
          <div className="space-y-3">
            {evaluatorAccuracy.slice(0, 5).map((item, index) => (
              <div key={item.evaluatorId} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 mb-1">#{index + 1}</p>
                    <p className="text-lg font-semibold text-slate-900">{item.evaluatorId}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      정확도 {percent(item.accuracy)} · 변경 {item.changedCount}건
                    </p>
                  </div>
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${item.changeRate >= 0.4 ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
                    변경률 {percent(item.changeRate)}
                  </span>
                </div>
                <div className="mt-3">
                  <CorrectionBadge upwardChanges={item.upwardChanges} downwardChanges={item.downwardChanges} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1.15fr_1fr] gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">항목별 변경률</h2>
            <p className="text-sm text-slate-500 mt-1">어떤 평가 기준이 가장 자주 검수에서 수정되는지 보여줍니다.</p>
          </div>
          <ResponsiveContainer width="100%" height={320}>
            <BarChart data={criterionChartData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} interval={0} angle={-18} textAnchor="end" height={60} />
              <YAxis tickFormatter={(value) => `${value}%`} tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value) => [`${value}%`, '변경률']} />
              <Bar dataKey="changeRatePct" radius={[6, 6, 0, 0]}>
                {criterionChartData.map((entry) => (
                  <Cell
                    key={entry.criterion}
                    fill={entry.changeRate >= 0.4 ? '#ef4444' : entry.changeRate >= 0.33 ? '#f59e0b' : '#10b981'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="mb-4">
            <h2 className="text-base font-semibold text-slate-800">항목별 핵심 수치</h2>
            <p className="text-sm text-slate-500 mt-1">변경률과 상향/하향 수정 방향을 같이 봅니다.</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">항목</th>
                  <th className="pb-2 font-medium text-right">정확도</th>
                  <th className="pb-2 font-medium text-right">변경률</th>
                  <th className="pb-2 font-medium text-right">변경 건수</th>
                </tr>
              </thead>
              <tbody>
                {criterionChangeRates.map((item) => (
                  <tr key={item.criterion} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 text-slate-700">{CRITERION_LABELS[item.criterion] ?? item.criterion}</td>
                    <td className="py-2 text-right font-semibold text-slate-800">{percent(item.accuracy)}</td>
                    <td className="py-2 text-right font-semibold text-rose-600">{percent(item.changeRate)}</td>
                    <td className="py-2 text-right text-slate-500">{item.changedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-800">변경 사례 보기</h2>
            <p className="text-sm text-slate-500 mt-1">실제 어떤 평가 항목이 1차에서 2차 검수로 수정됐는지 바로 확인할 수 있습니다.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-sm text-slate-600">
              <span className="block mb-1">평가자</span>
              <select
                value={selectedEvaluator}
                onChange={(event) => setSelectedEvaluator(event.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm text-slate-700"
              >
                <option value="all">전체 평가자</option>
                {evaluatorAccuracy.map((item) => (
                  <option key={item.evaluatorId} value={item.evaluatorId}>
                    {item.evaluatorId}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600">
              <span className="block mb-1">항목</span>
              <select
                value={selectedCriterion}
                onChange={(event) => setSelectedCriterion(event.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm text-slate-700"
              >
                <option value="all">전체 항목</option>
                {criterionChangeRates.map((item) => (
                  <option key={item.criterion} value={item.criterion}>
                    {CRITERION_LABELS[item.criterion] ?? item.criterion}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-sm text-slate-600">
              <span className="block mb-1">수정 방향</span>
              <select
                value={selectedDirection}
                onChange={(event) => setSelectedDirection(event.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 bg-white text-sm text-slate-700"
              >
                <option value="all">전체</option>
                <option value="up">상향 수정만</option>
                <option value="down">하향 수정만</option>
              </select>
            </label>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 mb-4 text-sm">
          <span className="inline-flex items-center gap-2 rounded-full bg-slate-100 px-3 py-1 text-slate-600">
            현재 표시
            <strong className="text-slate-900">{topChangeCases.length}</strong>
            건
          </span>
          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            전체 변경
            <strong>{changeCases.length}</strong>
            건
          </span>
          {selectedEvaluator !== 'all' ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-sky-700">
              평가자
              <strong>{selectedEvaluator}</strong>
            </span>
          ) : null}
          {selectedCriterion !== 'all' ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
              항목
              <strong>{CRITERION_LABELS[selectedCriterion] ?? selectedCriterion}</strong>
            </span>
          ) : null}
          {selectedDirection !== 'all' ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
              방향
              <strong>{selectedDirection === 'up' ? '상향 수정' : '하향 수정'}</strong>
            </span>
          ) : null}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">콘텐츠</th>
                <th className="pb-2 font-medium">평가자</th>
                <th className="pb-2 font-medium">항목</th>
                <th className="pb-2 font-medium text-right">1차</th>
                <th className="pb-2 font-medium text-right">2차</th>
                <th className="pb-2 font-medium">변경</th>
                <th className="pb-2 font-medium">사유</th>
              </tr>
            </thead>
            <tbody>
              {topChangeCases.map((row) => {
                const isUpward = row.secondaryScore > row.primaryScore;
                return (
                  <tr key={`${row.contentId}-${row.primaryEvaluatorId}-${row.criterion}`} className="border-b border-slate-50 hover:bg-slate-50 align-top">
                    <td className="py-3 font-mono text-xs text-slate-600">{row.contentId}</td>
                    <td className="py-3 font-mono text-xs text-slate-600">{row.primaryEvaluatorId}</td>
                    <td className="py-3 text-slate-700">{CRITERION_LABELS[row.criterion] ?? row.criterion}</td>
                    <td className="py-3 text-right font-semibold text-slate-500">{row.primaryScore}</td>
                    <td className="py-3 text-right font-semibold text-slate-900">{row.secondaryScore}</td>
                    <td className="py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${isUpward ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                        {isUpward ? '상향 수정' : '하향 수정'}
                      </span>
                    </td>
                    <td className="py-3 text-slate-600 min-w-64">
                      {row.secondaryReason || row.primaryReason || '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {changeCases.length > topChangeCases.length ? (
          <p className="mt-3 text-xs text-slate-400">
            최신 화면에는 상위 20건만 표시합니다. 더 길게 보려면 필터를 좁히는 방향이 좋습니다.
          </p>
        ) : null}
      </div>
    </div>
  );
}
