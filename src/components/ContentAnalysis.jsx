import { useMemo, useState } from 'react';
import { calculateDisagreement, calculateContentSummary, generateHeatmapData } from '../utils/disagreementDetector';

const CRITERION_LABELS = {
  accuracy: '정확성',
  completeness: '완전성',
  consistency: '일관성',
  clarity: '명확성',
  relevance: '관련성',
  conciseness: '간결성',
  tone: '톤 적절성',
};

const SCORE_STYLE = {
  0: { bg: '#fee2e2', color: '#991b1b' },
  1: { bg: '#fef9c3', color: '#92400e' },
  2: { bg: '#dcfce7', color: '#166534' },
};

/** Map stdDev (0..1) to a green→yellow→red color */
function stdDevToColor(value) {
  if (value === null) return '#f8fafc';
  const ratio = Math.min(Math.max(value, 0), 1); // stdDev max ≈ 1 for 3-point scale
  const r = Math.round(16  + ratio * (239 - 16));
  const g = Math.round(196 - ratio * (196 - 68));
  const b = Math.round(87  - ratio * (87  - 68));
  return `rgb(${r},${g},${b})`;
}

function HeatmapCell({ value, selected, onClick }) {
  const bg = stdDevToColor(value);
  const light = value !== null && value > 0.5;
  return (
    <td
      style={{ backgroundColor: bg, color: light ? '#fff' : '#0f172a' }}
      className={`text-center text-xs py-1.5 px-1 font-semibold border cursor-pointer transition-all ${
        selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-white'
      }`}
      onClick={onClick}
      title={value !== null ? `σ = ${value.toFixed(2)}` : '—'}
    >
      {value !== null ? value.toFixed(2) : '—'}
    </td>
  );
}

export default function ContentAnalysis({ data }) {
  const [selected, setSelected] = useState(null); // { contentId, criterion }

  const heatmap       = useMemo(() => generateHeatmapData(data, 'content', 'stdDev'), [data]);
  const contentSummary = useMemo(() => calculateContentSummary(data), [data]);
  const disagreements  = useMemo(() => calculateDisagreement(data), [data]);

  // Detail panel: individual scores for selected (content, criterion)
  const detailScores = useMemo(() => {
    if (!selected) return [];
    return data
      .filter((r) => r.contentId === selected.contentId && r.criterion === selected.criterion)
      .sort((a, b) => a.evaluatorId.localeCompare(b.evaluatorId, undefined, { numeric: true }));
  }, [data, selected]);

  const detailStats = useMemo(() => {
    if (!selected) return null;
    return disagreements.find(
      (d) => d.contentId === selected.contentId && d.criterion === selected.criterion
    ) ?? null;
  }, [disagreements, selected]);

  function handleCellClick(contentId, criterion) {
    setSelected((prev) =>
      prev?.contentId === contentId && prev?.criterion === criterion ? null : { contentId, criterion }
    );
  }

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-1">콘텐츠 × 항목 불일치 히트맵</h2>
        <p className="text-xs text-slate-400 mb-4">
          셀 값 = 평가자 간 점수 표준편차(σ). 빨간 셀일수록 불일치가 큼. 클릭하면 상세 점수를 확인할 수 있습니다.
        </p>
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-400 font-medium pr-3 pb-1 whitespace-nowrap">콘텐츠</th>
                {heatmap.columns.map((c) => (
                  <th key={c} className="text-slate-500 font-medium pb-1 px-2 text-center whitespace-nowrap">
                    {(CRITERION_LABELS[c] ?? c).slice(0, 5)}
                  </th>
                ))}
                <th className="text-slate-400 font-medium pb-1 px-2 text-right whitespace-nowrap">전체 σ</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((contentId, rowIdx) => {
                const cs = contentSummary.find((s) => s.contentId === contentId);
                return (
                  <tr key={contentId} className="hover:brightness-95">
                    <td className="text-slate-500 font-mono pr-3 py-1 whitespace-nowrap">{contentId}</td>
                    {heatmap.values[rowIdx].map((val, colIdx) => (
                      <HeatmapCell
                        key={`${contentId}-${heatmap.columns[colIdx]}`}
                        value={val}
                        selected={selected?.contentId === contentId && selected?.criterion === heatmap.columns[colIdx]}
                        onClick={() => handleCellClick(contentId, heatmap.columns[colIdx])}
                      />
                    ))}
                    <td className="text-right px-2 font-semibold text-slate-600">
                      {cs ? cs.overallStdDev.toFixed(2) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <span>합의(σ 낮음)</span>
          <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right, rgb(16,196,87), rgb(250,204,0), rgb(239,68,68))' }} />
          <span>불일치(σ 높음)</span>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-semibold text-slate-800">
                {selected.contentId} / {CRITERION_LABELS[selected.criterion] ?? selected.criterion}
              </h2>
              {detailStats && (
                <p className="text-sm text-slate-500 mt-0.5">
                  평균 {detailStats.mean.toFixed(2)} · σ {detailStats.stdDev.toFixed(2)}
                  &ensp;|&ensp;
                  <span className="text-red-600">0점 {detailStats.scoreDistribution[0]}명</span>
                  &ensp;·&ensp;
                  <span className="text-amber-600">1점 {detailStats.scoreDistribution[1]}명</span>
                  &ensp;·&ensp;
                  <span className="text-emerald-600">2점 {detailStats.scoreDistribution[2]}명</span>
                </p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-sm">
              ✕ 닫기
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {detailScores.map((row) => {
              const s = SCORE_STYLE[row.score];
              return (
                <div
                  key={row.evaluatorId}
                  style={{ backgroundColor: s.bg, color: s.color }}
                  className="rounded-xl p-3 border border-white/60"
                >
                  <p className="text-xs font-mono font-semibold mb-1 opacity-70">{row.evaluatorId}</p>
                  <p className="text-2xl font-bold">{row.score}</p>
                  {row.reason ? (
                    <p className="text-xs mt-1 opacity-80 leading-snug">{row.reason}</p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
