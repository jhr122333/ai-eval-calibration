import { useMemo } from 'react';
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
  calculateCriterionChangeRates,
  calculateContentChangeSummary,
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

function SummaryCard({ label, value, sub, accent = 'text-slate-800' }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent}`}>{value}</p>
      {sub ? <p className="text-xs text-slate-400 mt-1">{sub}</p> : null}
    </div>
  );
}

export default function OverviewDashboard({ data, summary }) {
  const reviewSummary = useMemo(() => calculateReviewSummary(data), [data]);
  const criterionChangeRates = useMemo(() => calculateCriterionChangeRates(data), [data]);
  const contentChangeSummary = useMemo(() => calculateContentChangeSummary(data), [data]);

  const criterionChartData = useMemo(
    () =>
      criterionChangeRates.map((item) => ({
        ...item,
        label: CRITERION_LABELS[item.criterion] ?? item.criterion,
        changeRatePct: Number((item.changeRate * 100).toFixed(1)),
      })),
    [criterionChangeRates]
  );

  const topContents = useMemo(() => contentChangeSummary.slice(0, 10), [contentChangeSummary]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="총 갯수" value={summary.contents.length.toLocaleString()} />
        <SummaryCard label="평가 항목" value={`${summary.criteria.length}개`} />
        <SummaryCard
          label="전체 정확도"
          value={percent(reviewSummary.accuracy)}
          sub={`변경 ${reviewSummary.changedCount.toLocaleString()}건`}
          accent="text-emerald-600"
        />
        <SummaryCard
          label="가장 많이 바뀐 항목"
          value={CRITERION_LABELS[reviewSummary.worstCriterion?.criterion] ?? reviewSummary.worstCriterion?.criterion ?? '—'}
          sub={reviewSummary.worstCriterion ? `변경률 ${percent(reviewSummary.worstCriterion.changeRate)}` : undefined}
          accent="text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-1">항목별 변경률</h2>
          <p className="text-sm text-slate-500 mb-4">검수에서 자주 수정되는 기준을 바로 볼 수 있습니다.</p>
          <ResponsiveContainer width="100%" height={280}>
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
          <h2 className="text-base font-semibold text-slate-700 mb-1">변경이 많은 콘텐츠 Top 10</h2>
          <p className="text-sm text-slate-500 mb-4">어떤 콘텐츠가 검수에서 가장 자주 수정됐는지 보여줍니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">콘텐츠</th>
                  <th className="pb-2 font-medium text-right">정확도</th>
                  <th className="pb-2 font-medium text-right">변경률</th>
                  <th className="pb-2 font-medium text-right">변경 건수</th>
                </tr>
              </thead>
              <tbody>
                {topContents.map((item) => (
                  <tr key={item.contentId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-mono text-xs text-slate-600">{item.contentId}</td>
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
    </div>
  );
}
