import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ErrorBar, Cell,
} from 'recharts';
import { calculateDisagreement, calculateContentSummary } from '../utils/disagreementDetector';
import { useMemo } from 'react';

const CRITERION_LABELS = {
  accuracy: '정확성',
  completeness: '완전성',
  consistency: '일관성',
  clarity: '명확성',
  relevance: '관련성',
  conciseness: '간결성',
  tone: '톤 적절성',
};

function ScoreBar({ dist, total }) {
  const p0 = ((dist[0] ?? 0) / total) * 100;
  const p1 = ((dist[1] ?? 0) / total) * 100;
  const p2 = ((dist[2] ?? 0) / total) * 100;
  return (
    <div className="flex h-4 w-full rounded overflow-hidden">
      <div style={{ width: `${p0}%` }} className="bg-red-400" title={`Score 0: ${dist[0] ?? 0}`} />
      <div style={{ width: `${p1}%` }} className="bg-amber-400" title={`Score 1: ${dist[1] ?? 0}`} />
      <div style={{ width: `${p2}%` }} className="bg-emerald-400" title={`Score 2: ${dist[2] ?? 0}`} />
    </div>
  );
}

function SummaryCard({ label, value, sub, accent }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 p-5 shadow-sm`}>
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${accent ?? 'text-slate-800'}`}>{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function OverviewDashboard({ data, summary }) {
  const disagreements = useMemo(() => calculateDisagreement(data), [data]);
  const contentSummary = useMemo(() => calculateContentSummary(data), [data]);

  // Criterion-level averages and stdDevs
  const criterionStats = useMemo(() => {
    const map = {};
    data.forEach(r => {
      if (!map[r.criterion]) map[r.criterion] = [];
      map[r.criterion].push(r.score);
    });
    return Object.entries(map).map(([criterion, scores]) => {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length;
      const sd = Math.sqrt(variance);
      return { criterion, avg: parseFloat(avg.toFixed(3)), sd: parseFloat(sd.toFixed(3)) };
    }).sort((a, b) => a.avg - b.avg);
  }, [data]);

  const avgStdDev = disagreements.length
    ? (disagreements.reduce((s, d) => s + d.stdDev, 0) / disagreements.length).toFixed(3)
    : '—';

  const worstCriterion = criterionStats.length
    ? criterionStats.reduce((a, b) => a.sd > b.sd ? a : b).criterion
    : '—';

  const top10 = disagreements.slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="총 콘텐츠 수" value={summary.contents.length} />
        <SummaryCard label="평가자 수" value={summary.evaluators.length} />
        <SummaryCard label="평균 표준편차" value={avgStdDev} sub="전체 콘텐츠-항목 조합 기준" accent="text-orange-600" />
        <SummaryCard
          label="가장 불일치가 큰 항목"
          value={CRITERION_LABELS[worstCriterion] ?? worstCriterion}
          sub="표준편차 최고"
          accent="text-red-600"
        />
      </div>

      {/* Criterion chart + Top 10 table side by side */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Criterion bar chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-4">항목별 평균 점수</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={criterionStats} layout="vertical" margin={{ left: 16, right: 24 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 2]} tickCount={5} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="criterion" tick={{ fontSize: 12 }}
                tickFormatter={v => CRITERION_LABELS[v] ?? v} width={90} />
              <Tooltip
                formatter={(value, name) => [value, name === 'avg' ? '평균' : '표준편차']}
                labelFormatter={l => CRITERION_LABELS[l] ?? l}
              />
              <Bar dataKey="avg" name="avg" radius={[0, 4, 4, 0]}>
                {criterionStats.map(entry => (
                  <Cell
                    key={entry.criterion}
                    fill={entry.criterion === worstCriterion ? '#f97316' : '#3b82f6'}
                  />
                ))}
                <ErrorBar dataKey="sd" width={4} strokeWidth={2} stroke="#94a3b8" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top 10 disagreement table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-4">불일치 Top 10</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">콘텐츠</th>
                  <th className="pb-2 font-medium">평가 항목</th>
                  <th className="pb-2 font-medium text-right">표준편차</th>
                  <th className="pb-2 font-medium pl-4">점수 분포</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((item, i) => {
                  const total = Object.values(item.scoreDistribution).reduce((a, b) => a + b, 0);
                  return (
                    <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs text-slate-600">{item.contentId}</td>
                      <td className="py-2 text-slate-700">{CRITERION_LABELS[item.criterion] ?? item.criterion}</td>
                      <td className="py-2 text-right font-semibold text-orange-600">{item.stdDev.toFixed(3)}</td>
                      <td className="py-2 pl-4 w-28">
                        <ScoreBar dist={item.scoreDistribution} total={total} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Legend */}
          <div className="flex gap-4 mt-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-400 inline-block"/>0점</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-400 inline-block"/>1점</span>
            <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-400 inline-block"/>2점</span>
          </div>
        </div>
      </div>
    </div>
  );
}
