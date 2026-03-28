import { useMemo, useState } from 'react';
import { calculateContentSummary, calculateDisagreement, generateHeatmapData } from '../utils/disagreementDetector';

const CRITERION_LABELS = {
  accuracy: '정확성', completeness: '완전성', consistency: '일관성',
  clarity: '명확성', relevance: '관련성', conciseness: '간결성', tone: '톤 적절성',
};

const SCORE_COLORS = ['bg-red-400', 'bg-amber-400', 'bg-emerald-400'];
const SCORE_TEXT = ['text-red-700', 'text-amber-700', 'text-emerald-700'];

// Maps stdDev 0→1 to green→yellow→red
function stdDevToColor(value, maxVal) {
  if (value === null) return '#f8fafc';
  const ratio = Math.min(value / maxVal, 1);
  if (ratio < 0.5) {
    const r = Math.round(ratio * 2 * (250 - 16) + 16);
    const g = Math.round(196 - ratio * 2 * (196 - 204));
    const b = Math.round(87 - ratio * 2 * 87);
    return `rgb(${r},${g},${b})`;
  } else {
    const r2 = (ratio - 0.5) * 2;
    const r = Math.round(250 - r2 * (250 - 239));
    const g = Math.round(204 - r2 * (204 - 68));
    const b = Math.round(0 + r2 * 68);
    return `rgb(${r},${g},${b})`;
  }
}

function HeatmapCell({ value, maxVal, onClick, selected }) {
  const bg = stdDevToColor(value, maxVal);
  return (
    <td
      style={{ backgroundColor: bg }}
      className={`text-center text-xs py-1.5 px-1 font-medium border cursor-pointer transition-all
        ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-white'}`}
      onClick={onClick}
      title={value !== null ? `표준편차: ${value.toFixed(3)}` : '—'}
    >
      {value !== null ? value.toFixed(2) : '—'}
    </td>
  );
}

export default function ContentAnalysis({ data }) {
  const [selected, setSelected] = useState(null); // { contentId, criterion }

  const contentSummary = useMemo(() => calculateContentSummary(data), [data]);
  const heatmap = useMemo(() => generateHeatmapData(data, 'content', 'stdDev'), [data]);

  // Find max stdDev for color scale
  const maxStdDev = useMemo(() => {
    let max = 0;
    heatmap.values.forEach(row => row.forEach(v => { if (v !== null && v > max) max = v; }));
    return max || 1;
  }, [heatmap]);

  // Detail panel: scores for selected content-criterion
  const detailScores = useMemo(() => {
    if (!selected) return [];
    return data
      .filter(r => r.contentId === selected.contentId && r.criterion === selected.criterion)
      .sort((a, b) => a.evaluatorId.localeCompare(b.evaluatorId, undefined, { numeric: true }));
  }, [data, selected]);

  function handleCellClick(contentId, criterion) {
    setSelected(prev =>
      prev?.contentId === contentId && prev?.criterion === criterion ? null : { contentId, criterion }
    );
  }

  return (
    <div className="space-y-6">
      {/* Heatmap */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-1">콘텐츠 × 항목 히트맵 (표준편차)</h2>
        <p className="text-xs text-slate-400 mb-4">셀을 클릭하면 평가자별 점수를 확인할 수 있습니다</p>
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-400 font-medium pr-3 pb-1 whitespace-nowrap">콘텐츠</th>
                {heatmap.columns.map(c => (
                  <th key={c} className="text-slate-500 font-medium pb-1 px-2 text-center whitespace-nowrap">
                    {(CRITERION_LABELS[c] ?? c).slice(0, 5)}
                  </th>
                ))}
                <th className="text-slate-400 font-medium pb-1 px-2 text-right whitespace-nowrap">평균 σ</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((contentId, ri) => {
                const cs = contentSummary.find(c => c.contentId === contentId);
                return (
                  <tr key={contentId} className="hover:brightness-95">
                    <td className="text-slate-500 font-mono pr-3 py-1 whitespace-nowrap">{contentId}</td>
                    {heatmap.values[ri].map((val, ci) => (
                      <HeatmapCell
                        key={ci}
                        value={val}
                        maxVal={maxStdDev}
                        selected={selected?.contentId === contentId && selected?.criterion === heatmap.columns[ci]}
                        onClick={() => handleCellClick(contentId, heatmap.columns[ci])}
                      />
                    ))}
                    <td className="text-right px-2 font-semibold text-slate-600">
                      {cs ? cs.overallStdDev.toFixed(3) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {/* Color scale */}
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <span>낮은 불일치</span>
          <div className="flex-1 h-2 rounded"
            style={{ background: 'linear-gradient(to right, rgb(16,196,87), rgb(250,204,0), rgb(239,68,68))' }} />
          <span>높은 불일치</span>
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">
              {selected.contentId} / {CRITERION_LABELS[selected.criterion] ?? selected.criterion}
            </h2>
            <button
              onClick={() => setSelected(null)}
              className="text-slate-400 hover:text-slate-600 text-sm"
            >
              ✕ 닫기
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* All evaluator scores */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">평가자별 점수</h3>
              <div className="grid grid-cols-3 gap-2">
                {detailScores.map(row => (
                  <div
                    key={row.evaluatorId}
                    className={`rounded-xl p-3 text-center border ${
                      row.score === 0 ? 'bg-red-50 border-red-200' :
                      row.score === 1 ? 'bg-amber-50 border-amber-200' :
                      'bg-emerald-50 border-emerald-200'
                    }`}
                  >
                    <div className="text-xs text-slate-500 font-mono mb-1">{row.evaluatorId.replace('eval_', 'E')}</div>
                    <div className={`text-xl font-bold ${SCORE_TEXT[row.score]}`}>{row.score}</div>
                  </div>
                ))}
              </div>

              {/* Score distribution */}
              <div className="mt-4 flex gap-4 text-sm">
                {[0, 1, 2].map(s => {
                  const count = detailScores.filter(r => r.score === s).length;
                  const pct = ((count / detailScores.length) * 100).toFixed(0);
                  return (
                    <div key={s} className="flex items-center gap-1.5">
                      <span className={`w-3 h-3 rounded-full inline-block ${SCORE_COLORS[s]}`} />
                      <span className="text-slate-600">{s}점: <strong>{count}명</strong> ({pct}%)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 0점 사유 */}
            <div>
              <h3 className="text-sm font-medium text-slate-600 mb-3">
                0점 사유 ({detailScores.filter(r => r.score === 0 && r.reason).length}건)
              </h3>
              {detailScores.filter(r => r.score === 0 && r.reason).length === 0 ? (
                <p className="text-slate-400 text-sm">선택한 항목에 0점 평가가 없습니다.</p>
              ) : (
                <ul className="space-y-2">
                  {detailScores
                    .filter(r => r.score === 0 && r.reason)
                    .map(row => (
                      <li key={row.evaluatorId} className="bg-red-50 rounded-xl p-3 text-sm">
                        <span className="text-xs font-mono text-slate-400 mr-2">{row.evaluatorId}</span>
                        <span className="text-slate-700">{row.reason}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
