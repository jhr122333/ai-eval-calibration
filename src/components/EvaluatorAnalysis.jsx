import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { calculateEvaluatorBias, generateHeatmapData } from '../utils/disagreementDetector';

const CRITERION_LABELS = {
  accuracy: '정확성',
  completeness: '완전성',
  consistency: '일관성',
  clarity: '명확성',
  relevance: '관련성',
  conciseness: '간결성',
  tone: '톤',
};

const BIAS_STYLE = {
  lenient: { label: '관대', bg: 'bg-emerald-100', text: 'text-emerald-700' },
  neutral: { label: '보통', bg: 'bg-slate-100',   text: 'text-slate-600'   },
  strict:  { label: '엄격', bg: 'bg-rose-100',    text: 'text-rose-700'    },
};

// ── Heatmap helpers ────────────────────────────────────────────────────────────

/** Map a 0..2 mean score to a blue gradient cell color */
function meanToColor(value) {
  if (value === null) return '#f8fafc';
  const ratio = Math.min(Math.max(value / 2, 0), 1); // 0=strict/red, 1=lenient/green
  const r = Math.round(239 - ratio * (239 - 16));
  const g = Math.round(68  + ratio * (196 - 68));
  const b = Math.round(68  + ratio * (87  - 68));
  return `rgb(${r},${g},${b})`;
}

function HeatmapCell({ value }) {
  const bg = meanToColor(value);
  const light = value !== null && value > 1.0;
  return (
    <td
      style={{ backgroundColor: bg, color: light ? '#fff' : '#0f172a' }}
      className="text-center text-xs py-2 px-1 font-semibold border border-white"
      title={value !== null ? `평균 ${value.toFixed(2)}` : '—'}
    >
      {value !== null ? value.toFixed(2) : '—'}
    </td>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function EvaluatorAnalysis({ data }) {
  const biasData  = useMemo(() => calculateEvaluatorBias(data), [data]);
  const heatmap   = useMemo(() => generateHeatmapData(data, 'evaluator', 'mean'), [data]);
  const globalAvg = useMemo(() => {
    if (data.length === 0) return 0;
    return data.reduce((s, r) => s + r.score, 0) / data.length;
  }, [data]);

  // Stacked bar chart data: evaluator × score distribution (%)
  const stackedData = useMemo(
    () =>
      biasData.map((item) => {
        const total = (item.scoreDistribution[0] ?? 0) + (item.scoreDistribution[1] ?? 0) + (item.scoreDistribution[2] ?? 0);
        return {
          evaluatorId: item.evaluatorId,
          label: item.evaluatorId.replace('eval_', 'E'),
          score0: total > 0 ? Number(((item.scoreDistribution[0] ?? 0) / total * 100).toFixed(1)) : 0,
          score1: total > 0 ? Number(((item.scoreDistribution[1] ?? 0) / total * 100).toFixed(1)) : 0,
          score2: total > 0 ? Number(((item.scoreDistribution[2] ?? 0) / total * 100).toFixed(1)) : 0,
        };
      }).sort((a, b) => a.evaluatorId.localeCompare(b.evaluatorId, undefined, { numeric: true })),
    [biasData]
  );

  return (
    <div className="space-y-6">
      {/* Stacked bar chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-1">평가자별 점수 분포</h2>
        <p className="text-sm text-slate-500 mb-4">각 평가자가 0 / 1 / 2점을 준 비율입니다.</p>
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={stackedData} margin={{ top: 8, right: 20, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="label" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${v}%`} tick={{ fontSize: 12 }} domain={[0, 100]} />
            <Tooltip formatter={(value, name) => [`${value}%`, `${name.replace('score', '')}점`]} />
            <Legend formatter={(value) => `${value.replace('score', '')}점`} />
            <Bar dataKey="score0" stackId="a" fill="#ef4444" name="score0" />
            <Bar dataKey="score1" stackId="a" fill="#f59e0b" name="score1" />
            <Bar dataKey="score2" stackId="a" fill="#10b981" name="score2" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bias table */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-1">평가자 편향 분석</h2>
        <p className="text-sm text-slate-500 mb-4">
          전체 평균 {globalAvg.toFixed(2)}점 기준 · ±0.2 초과 시 관대/엄격으로 분류
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-400 border-b border-slate-100">
                <th className="pb-2 font-medium">평가자</th>
                <th className="pb-2 font-medium text-right">평균 점수</th>
                <th className="pb-2 font-medium text-right">편차</th>
                <th className="pb-2 font-medium">편향</th>
                <th className="pb-2 font-medium text-right">0점 비율</th>
                <th className="pb-2 font-medium text-right">2점 비율</th>
              </tr>
            </thead>
            <tbody>
              {biasData.map((item) => {
                const total = Object.values(item.scoreDistribution).reduce((a, b) => a + b, 0);
                const r0 = total > 0 ? ((item.scoreDistribution[0] ?? 0) / total * 100).toFixed(1) : '0.0';
                const r2 = total > 0 ? ((item.scoreDistribution[2] ?? 0) / total * 100).toFixed(1) : '0.0';
                const style = BIAS_STYLE[item.biasLabel] ?? BIAS_STYLE.neutral;
                const devColor = item.deviationFromMean > 0 ? 'text-emerald-600' : item.deviationFromMean < 0 ? 'text-rose-600' : 'text-slate-500';
                return (
                  <tr key={item.evaluatorId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-mono text-xs text-slate-700">{item.evaluatorId}</td>
                    <td className="py-2 text-right font-semibold text-slate-800">{item.avgScore.toFixed(3)}</td>
                    <td className={`py-2 text-right font-semibold ${devColor}`}>
                      {item.deviationFromMean >= 0 ? '+' : ''}{item.deviationFromMean.toFixed(3)}
                    </td>
                    <td className="py-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="py-2 text-right text-slate-500">{r0}%</td>
                    <td className="py-2 text-right text-slate-500">{r2}%</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Evaluator × Criterion heatmap */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-800 mb-1">평가자 × 항목 히트맵</h2>
        <p className="text-sm text-slate-500 mb-4">셀 색상은 평균 점수를 나타냅니다. 초록=높음(관대), 빨강=낮음(엄격)</p>
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-400 font-medium pr-4 pb-2 whitespace-nowrap">평가자</th>
                {heatmap.columns.map((c) => (
                  <th key={c} className="text-slate-500 font-medium pb-2 px-2 text-center whitespace-nowrap">
                    {(CRITERION_LABELS[c] ?? c).slice(0, 4)}
                  </th>
                ))}
                <th className="text-slate-400 font-medium pb-2 px-2 text-right whitespace-nowrap">전체 평균</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((evaluatorId, rowIdx) => {
                const bias = biasData.find((b) => b.evaluatorId === evaluatorId);
                return (
                  <tr key={evaluatorId} className="hover:brightness-95">
                    <td className="text-slate-600 font-mono pr-4 py-1 whitespace-nowrap">{evaluatorId}</td>
                    {heatmap.values[rowIdx].map((val, colIdx) => (
                      <HeatmapCell key={`${evaluatorId}-${heatmap.columns[colIdx]}`} value={val} />
                    ))}
                    <td className="text-right px-2 font-semibold text-slate-700">
                      {bias ? bias.avgScore.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <span>엄격(낮음)</span>
          <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right, #ef4444, #f59e0b, #10b981)' }} />
          <span>관대(높음)</span>
        </div>
      </div>
    </div>
  );
}
