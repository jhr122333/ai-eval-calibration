import { useState } from 'react';
import FileUpload from './components/FileUpload';
import OverviewDashboard from './components/OverviewDashboard';
import EvaluatorAnalysis from './components/EvaluatorAnalysis';
import ContentAnalysis from './components/ContentAnalysis';
import GuidelinesTab from './components/GuidelinesTab';
import './index.css';

const TABS = [
  { id: 'overview', label: '개요' },
  { id: 'evaluators', label: '평가자 분석' },
  { id: 'contents', label: '콘텐츠 분석' },
  { id: 'guidelines', label: '평가 가이드라인' },
];

export default function App() {
  const [dataset, setDataset] = useState(null); // { data, errors, summary }
  const [activeTab, setActiveTab] = useState('overview');

  function handleDataLoaded(result) {
    setDataset(result);
    setActiveTab('overview');
  }

  function handleReset() {
    setDataset(null);
  }

  if (!dataset) {
    return <FileUpload onDataLoaded={handleDataLoaded} />;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top nav */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-14">
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-800 text-base">AI 평가 캘리브레이션</span>
            <span className="hidden md:inline text-slate-300">|</span>
            <span className="hidden md:inline text-slate-500 text-sm">
              콘텐츠 {dataset.summary.contents.length}개 &middot; 평가자 {dataset.summary.evaluators.length}명 &middot; 항목 {dataset.summary.criteria.length}개 &middot; {dataset.summary.rows.toLocaleString()}행
            </span>
          </div>
          <button
            onClick={handleReset}
            className="text-sm text-slate-400 hover:text-slate-600 border border-slate-200 rounded-lg px-3 py-1.5 transition-colors"
          >
            새 파일 불러오기
          </button>
        </div>

        {/* Tab bar */}
        <div className="max-w-7xl mx-auto px-6 flex gap-1">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors -mb-px
                ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Page content */}
      <main className="max-w-7xl mx-auto px-6 py-6">
        {dataset.errors.length > 0 && (
          <div className="mb-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-700">
            <strong>{dataset.errors.length}개 행이 건너뜀</strong> — 유효하지 않은 score 값.
          </div>
        )}

        {activeTab === 'overview' && (
          <OverviewDashboard data={dataset.data} summary={dataset.summary} />
        )}
        {activeTab === 'evaluators' && (
          <EvaluatorAnalysis data={dataset.data} />
        )}
        {activeTab === 'contents' && (
          <ContentAnalysis data={dataset.data} />
        )}
        {activeTab === 'guidelines' && (
          <GuidelinesTab />
        )}
      </main>
    </div>
  );
}
