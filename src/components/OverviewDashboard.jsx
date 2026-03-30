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
  ErrorBar,
} from 'recharts';
import { calculateDisagreement } from '../utils/disagreementDetector';

const CRITERION_LABELS = {
  accuracy: '정확성',
  completeness: '완전성',
  consistency: '일관성',
  clarity: '명확성',
  relevance: '관련성',
  conciseness: '간결성',
  tone: '톤 적절성',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmt2(n) {
  return n.toFixed(2);
}

/** Inline score-distribution mini bar (0=red 1=amber 2=green) */
function ScoreBar({ dist, total }) {
  const segments = [
    { score: 0, color: '#ef4444', count: dist[0] ?? 0 },
    { score: 1, color: '#f59e0b', count: dist[1] ?? 0 },
    { score: 2, color: '#10b981', count: dist[2] ?? 0 },
  ];
  return (
    <div className="flex h-2 rounded overflow-hidden w-24">
      {segments.map(({ score, color, count }) =>
        count > 0 ? (
          <div
            key={score}
            style={{ width: `${(count / total) * 100}%`, backgroundColor: color }}
            title={`${score}점: ${count}명`}
          />
        ) : null
      )}
    </div>
  );
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

// ── Component ──────────────────────────────────────────────────────────────────

export default function OverviewDashboard({ data, summary }) {
  // All (content, criterion) pairs sorted by std dev descending
  const disagreements = useMemo(() => calculateDisagreement(data), [data]);

  // Average std dev across all pairs
  const avgStdDev = useMemo(() => {
    if (disagreements.length === 0) return 0;
    const total = disagreements.reduce((s, d) => s + d.stdDev, 0);
    return total / disagreements.length;
  }, [disagreements]);

  // Most disagreed criterion (highest avg stdDev per criterion)
  const worstCriterion = useMemo(() => {
    const map = {};
    const cnt = {};
    disagreements.forEach(({ criterion, stdDev }) => {
      map[criterion] = (map[criterion] ?? 0) + stdDev;
      cnt[criterion] = (cnt[criterion] ?? 0) + 1;
    });
    let best = null, bestVal = -1;
    Object.keys(map).forEach((c) => {
      const avg = map[c] / cnt[c];
      if (avg > bestVal) { bestVal = avg; best = c; }
    });
    return best;
  }, [disagreements]);

  // Top 10 disagreement items
  const top10 = useMemo(() => disagreements.slice(0, 10), [disagreements]);

  // Per-criterion average score + std dev for bar chart
  const criterionChartData = useMemo(() => {
    const map = {};
    const cnt = {};
    const sdSum = {};
    data.forEach(({ criterion, score }) => {
      map[criterion] = (map[criterion] ?? 0) + score;
      sdSum[criterion] = sdSum[criterion] ?? [];
      sdSum[criterion].push(score);
      cnt[criterion] = (cnt[criterion] ?? 0) + 1;
    });
    return Object.keys(map).map((c) => {
      const scores = sdSum[c];
      const avg = map[c] / cnt[c];
      const variance = scores.reduce((s, v) => s + (v - avg) ** 2, 0) / scores.length;
      const sd = Math.sqrt(variance);
      return {
        criterion: c,
        label: CRITERION_LABELS[c] ?? c,
        avg: Number(avg.toFixed(3)),
        sd: Number(sd.toFixed(3)),
        errorBar: [sd, sd],
      };
    }).sort((a, b) => a.avg - b.avg);
  }, [data]);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard label="총 콘텐츠 수" value={summary.contents.length} />
        <SummaryCard label="평가자 수" value={`${summary.evaluators.length}명`} />
        <SummaryCard
          label="평균 불일치 (σ)"
          value={fmt2(avgStdDev)}
          sub="전체 표준편차 평균"
          accent="text-amber-600"
        />
        <SummaryCard
          label="불일치 최다 항목"
          value={CRITERION_LABELS[worstCriterion] ?? worstCriterion ?? '—'}
          sub="항목 평균 σ 기준"
          accent="text-rose-600"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Top 10 disagreement table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-1">불일치 Top 10</h2>
          <p className="text-xs text-slate-400 mb-4">평가자 간 점수 표준편차가 큰 항목 순서입니다.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">콘텐츠</th>
                  <th className="pb-2 font-medium">항목</th>
                  <th className="pb-2 font-medium text-right">σ</th>
                  <th className="pb-2 font-medium text-right">평균</th>
                  <th className="pb-2 font-medium pl-3">분포</th>
                </tr>
              </thead>
              <tbody>
                {top10.map((item) => {
                  const total = item.scores.length;
                  return (
                    <tr key={`${item.contentId}-${item.criterion}`} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-2 font-mono text-xs text-slate-600">{item.contentId}</td>
                      <td className="py-2 text-slate-700">{CRITERION_LABELS[item.criterion] ?? item.criterion}</td>
                      <td className="py-2 text-right font-semibold text-rose-600">{fmt2(item.stdDev)}</td>
                      <td className="py-2 text-right text-slate-500">{fmt2(item.mean)}</td>
                      <td className="py-2 pl-3">
                        <ScoreBar dist={item.scoreDistribution} total={total} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex items-center gap-3 mt-3 text-xs text-slate-400">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-500 inline-block"/>0점</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-400 inline-block"/>1점</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-emerald-500 inline-block"/>2점</span>
          </div>
        </div>

        {/* Criterion avg score chart */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-1">항목별 평균 점수</h2>
          <p className="text-xs text-slate-400 mb-4">막대 길이 = 평균 점수 · 에러바 = 표준편차</p>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={criterionChartData} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" domain={[0, 2]} ticks={[0, 0.5, 1, 1.5, 2]} tick={{ fontSize: 12 }} />
              <YAxis type="category" dataKey="label" width={68} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value, name) => {
                  if (name === 'avg') return [value.toFixed(3), '평균 점수'];
                  return [value, name];
                }}
              />
              <Bar dataKey="avg" radius={[0, 6, 6, 0]} maxBarSize={28}>
                {criterionChartData.map((entry) => (
                  <Cell
                    key={entry.criterion}
                    fill={entry.avg >= 1.5 ? '#10b981' : entry.avg >= 1.0 ? '#f59e0b' : '#ef4444'}
                  />
                ))}
                <ErrorBar dataKey="errorBar" width={4} strokeWidth={2} stroke="#64748b" direction="x" />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
