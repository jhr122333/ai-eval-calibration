import { useMemo, useState } from 'react';
import {
  calculateContentChangeSummary,
  generateContentCriterionChangeHeatmap,
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
  return `${(value * 100).toFixed(0)}%`;
}

function changeRateToColor(value) {
  if (value === null) return '#f8fafc';
  const ratio = Math.min(Math.max(value, 0), 1);
  const r = Math.round(16 + ratio * (239 - 16));
  const g = Math.round(196 - ratio * (196 - 68));
  const b = Math.round(87 - ratio * (87 - 68));
  return `rgb(${r},${g},${b})`;
}

function HeatmapCell({ value, onClick, selected }) {
  return (
    <td
      style={{ backgroundColor: changeRateToColor(value), color: value !== null && value < 0.28 ? '#0f172a' : '#fff' }}
      className={`text-center text-xs py-1.5 px-1 font-semibold border cursor-pointer transition-all ${selected ? 'border-blue-500 ring-1 ring-blue-500' : 'border-white'}`}
      onClick={onClick}
      title={value !== null ? `변경률 ${percent(value)}` : '—'}
    >
      {value !== null ? percent(value) : '—'}
    </td>
  );
}

export default function ContentAnalysis({ data }) {
  const [selected, setSelected] = useState(null);

  const contentSummary = useMemo(() => calculateContentChangeSummary(data), [data]);
  const heatmap = useMemo(() => generateContentCriterionChangeHeatmap(data), [data]);

  const detailScores = useMemo(() => {
    if (!selected) return [];
    return data
      .filter((row) => row.contentId === selected.contentId && row.criterion === selected.criterion)
      .sort((a, b) => a.primaryEvaluatorId.localeCompare(b.primaryEvaluatorId, undefined, { numeric: true }));
  }, [data, selected]);

  function handleCellClick(contentId, criterion) {
    setSelected((prev) =>
      prev?.contentId === contentId && prev?.criterion === criterion ? null : { contentId, criterion }
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-base font-semibold text-slate-700 mb-1">콘텐츠 × 항목 변경률</h2>
        <p className="text-xs text-slate-400 mb-4">셀을 클릭하면 해당 콘텐츠와 항목에서 어떤 수정이 있었는지 확인할 수 있습니다.</p>
        <div className="overflow-auto">
          <table className="text-xs border-collapse">
            <thead>
              <tr>
                <th className="text-left text-slate-400 font-medium pr-3 pb-1 whitespace-nowrap">콘텐츠</th>
                {heatmap.columns.map((criterion) => (
                  <th key={criterion} className="text-slate-500 font-medium pb-1 px-2 text-center whitespace-nowrap">
                    {(CRITERION_LABELS[criterion] ?? criterion).slice(0, 5)}
                  </th>
                ))}
                <th className="text-slate-400 font-medium pb-1 px-2 text-right whitespace-nowrap">전체 변경률</th>
              </tr>
            </thead>
            <tbody>
              {heatmap.rows.map((contentId, rowIndex) => {
                const summary = contentSummary.find((item) => item.contentId === contentId);
                return (
                  <tr key={contentId} className="hover:brightness-95">
                    <td className="text-slate-500 font-mono pr-3 py-1 whitespace-nowrap">{contentId}</td>
                    {heatmap.values[rowIndex].map((value, columnIndex) => (
                      <HeatmapCell
                        key={`${contentId}-${heatmap.columns[columnIndex]}`}
                        value={value}
                        selected={selected?.contentId === contentId && selected?.criterion === heatmap.columns[columnIndex]}
                        onClick={() => handleCellClick(contentId, heatmap.columns[columnIndex])}
                      />
                    ))}
                    <td className="text-right px-2 font-semibold text-slate-600">
                      {summary ? percent(summary.changeRate) : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center gap-2 mt-3 text-xs text-slate-500">
          <span>변경 적음</span>
          <div className="flex-1 h-2 rounded" style={{ background: 'linear-gradient(to right, rgb(16,196,87), rgb(250,204,0), rgb(239,68,68))' }} />
          <span>변경 많음</span>
        </div>
      </div>

      {selected ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-slate-700">
              {selected.contentId} / {CRITERION_LABELS[selected.criterion] ?? selected.criterion}
            </h2>
            <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 text-sm">
              ✕ 닫기
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">1차 평가자</th>
                  <th className="pb-2 font-medium">검수자</th>
                  <th className="pb-2 font-medium text-right">1차</th>
                  <th className="pb-2 font-medium text-right">2차</th>
                  <th className="pb-2 font-medium">변경</th>
                  <th className="pb-2 font-medium">사유</th>
                </tr>
              </thead>
              <tbody>
                {detailScores.map((row) => {
                  const isChanged = row.primaryScore !== row.secondaryScore;
                  const isUpward = row.secondaryScore > row.primaryScore;

                  return (
                    <tr key={`${row.contentId}-${row.primaryEvaluatorId}-${row.criterion}`} className="border-b border-slate-50 hover:bg-slate-50">
                      <td className="py-3 font-mono text-xs text-slate-600">{row.primaryEvaluatorId}</td>
                      <td className="py-3 font-mono text-xs text-slate-600">{row.reviewerId}</td>
                      <td className="py-3 text-right font-semibold text-slate-500">{row.primaryScore}</td>
                      <td className="py-3 text-right font-semibold text-slate-900">{row.secondaryScore}</td>
                      <td className="py-3">
                        {isChanged ? (
                          <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${isUpward ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'}`}>
                            {isUpward ? '상향 수정' : '하향 수정'}
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-600">
                            유지
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-slate-600">{row.secondaryReason || row.primaryReason || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
