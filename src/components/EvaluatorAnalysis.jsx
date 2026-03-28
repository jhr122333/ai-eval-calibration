import { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { calculateEvaluatorBias, generateHeatmapData } from '../utils/disagreementDetector';

const CRITERION_LABELS = {
  accuracy: '정확성', completeness: '완전성', consistency: '일관성',
  clarity: '명확성', relevance: '관련성', conciseness: '간결성', tone: '톤 적절성',
};

const BIAS_LABELS = { lenient: '관대', neutral: '보통', strict: '엄격' };
const BIAS_COLORS = { lenient: 'text-emerald-600 bg-emerald-50', neutral: 'text-slate-600 bg-slate-100', strict: 'text-red-600 bg-red-50' };

// Maps a 0-2 mean score to a blue-green color for the evaluator×criterion heatmap
function scoreToColor(value) {
  if (value === null) return '#f8fafc';
  const ratio = value / 2; // 0 → 1
  const r = Math.round(239 - ratio * (239 - 16));
  const g = Math.round(68  + ratio * (196 - 68));
  const b = Math.round(68  + ratio * (87  - 68));
  return `rgb(${r},${g},${b})`;
}

function HeatmapCell({ value }) {
  const bg = scoreToColor(value);
  const textColor = value !== null && value > 1.2 ? '#1e3a5f' : '#fff';
  return (
    <td
      style={{ backgroundColor: bg, color: textColor }}
      className="text-center text-xs py-1.5 px-1 font-medium border border-white transition-colors"
    >
      {value !== null ? value.toFixed(2) : '—'}
    </td>
  );
}

export default function EvaluatorAnalysis({ data }) {
  const biasData = useMemo(() => calculateEvaluatorBias(data), [data]);
  const heatmap = useMemo(() => generateHeatmapData(data, 'evaluator', 'mean'), [data]);

  // Stack bar chart data: each evaluator → { evaluatorId, s0, s1, s2 }
  const stackData = useMemo(() =>
    biasData.map(ev => {
      const total = Object.values(ev.scoreDistribution).reduce((a, b) => a + b, 0);
      return {
        id: ev.evaluatorId.replace('eval_', 'E'),
        s0: parseFloat(((ev.scoreDistribution[0] ?? 0) / total * 100).toFixed(1)),
        s1: parseFloat(((ev.scoreDistribution[1] ?? 0) / total * 100).toFixed(1)),
        s2: parseFloat(((ev.scoreDistribution[2] ?? 0) / total * 100).toFixed(1)),
      };
    }).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true })),
  [biasData]);

  return (
    <div className="space-y-6">
      {/* Stacked bar chart */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-4">평가자별 점수 분포 (%)</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={stackData} margin={{ left: 0, right: 16 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="id" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} />
            <Tooltip formatter={(v, name) => [`${v}%`, `${name.replace('s', '')}점`]} />
            <Legend formatter={v => `${v.replace('s', '')}점`} />
            <Bar dataKey="s0" name="s0" stackId="a" fill="#f87171" />
            <Bar dataKey="s1" name="s1" stackId="a" fill="#fbbf24" />
            <Bar dataKey="s2" name="s2" stackId="a" fill="#34d399" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Bias table + Heatmap */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Bias table */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-4">평가자 편향 요약</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">평가자</th>
                  <th className="pb-2 font-medium text-right">평균 점수</th>
                  <th className="pb-2 font-medium text-right">전체 평균 대비</th>
                  <th className="pb-2 font-medium pl-3">편향</th>
                </tr>
              </thead>
              <tbody>
                {biasData.map(ev => (
                  <tr key={ev.evaluatorId} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-mono text-xs text-slate-600">{ev.evaluatorId}</td>
                    <td className="py-2 text-right font-semibold text-slate-800">
                      {ev.avgScore.toFixed(3)}
                    </td>
                    <td className={`py-2 text-right text-xs font-medium ${ev.deviationFromMean > 0 ? 'text-emerald-600' : ev.deviationFromMean < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                      {ev.deviationFromMean > 0 ? '+' : ''}{ev.deviationFromMean.toFixed(3)}
                    </td>
                    <td className="py-2 pl-3">
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${BIAS_COLORS[ev.biasLabel]}`}>
                        {BIAS_LABELS[ev.biasLabel] ?? ev.biasLabel}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Evaluator × Criterion heatmap */}
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-700 mb-4">평가자 × 항목 히트맵 (평균 점수)</h2>
          <div className="overflow-x-auto">
            <table className="text-xs w-full border-collapse">
              <thead>
                <tr>
                  <th className="text-left text-slate-400 font-medium pr-2 pb-1" />
                  {heatmap.columns.map(c => (
                    <th key={c} className="text-slate-500 font-medium pb-1 px-1 text-center">
                      {(CRITERION_LABELS[c] ?? c).slice(0, 4)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heatmap.rows.map((rowKey, ri) => (
                  <tr key={rowKey}>
                    <td className="text-slate-500 font-mono pr-2 py-1 text-right whitespace-nowrap">
                      {rowKey.replace('eval_', 'E')}
                    </td>
                    {heatmap.values[ri].map((val, ci) => (
                      <HeatmapCell key={ci} value={val} />
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Color scale legend */}
          <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
            <span>낮음 (0)</span>
            <div className="flex-1 h-2 rounded"
              style={{ background: 'linear-gradient(to right, rgb(239,68,68), rgb(250,204,21), rgb(16,196,87))' }} />
            <span>높음 (2)</span>
          </div>
        </div>
      </div>
    </div>
  );
}
