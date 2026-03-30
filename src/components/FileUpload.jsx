import { useRef, useState } from 'react';
import { parseFile, loadDemoData } from '../utils/parser';

export default function FileUpload({ onDataLoaded }) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFile(file) {
    setError(null);
    setLoading(true);
    try {
      const result = await parseFile(file);
      onDataLoaded(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleDemo() {
    setError(null);
    setLoading(true);
    try {
      const result = await loadDemoData();
      onDataLoaded(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  function onInputChange(e) {
    const file = e.target.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 px-4">
      {/* Header */}
      <div className="mb-10 text-center">
        <h1 className="text-3xl font-bold text-slate-800 mb-2">
          AI 평가 캘리브레이션 대시보드
        </h1>
        <p className="text-slate-500 max-w-2xl">
          1차 평가와 2차 검수 결과를 비교해서 정확도와 수정 패턴을 확인합니다.
        </p>
        <div className="mt-4 flex justify-center">
          <a
            href="https://github.com/jhr122333/ai-eval-calibration"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm hover:border-slate-300 hover:text-slate-900 transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.866-.013-1.699-2.782.605-3.37-1.344-3.37-1.344-.455-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.004.071 1.532 1.032 1.532 1.032.892 1.53 2.341 1.088 2.91.832.091-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.54 9.54 0 0 1 2.504.337c1.909-1.296 2.747-1.026 2.747-1.026.546 1.378.203 2.397.1 2.65.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.31.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.481A10.019 10.019 0 0 0 22 12.017C22 6.484 17.523 2 12 2Z" />
            </svg>
            GitHub에서 보기
          </a>
        </div>
      </div>

      {/* Upload area */}
      <div
        className={`w-full max-w-xl border-2 border-dashed rounded-2xl p-12 text-center transition-colors cursor-pointer
          ${dragging ? 'border-blue-400 bg-blue-50' : 'border-slate-300 bg-white hover:border-blue-300 hover:bg-blue-50/40'}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onClick={() => inputRef.current?.click()}
      >
        <div className="flex justify-center mb-4">
          <svg className="w-12 h-12 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.338-2.32 5.75 5.75 0 011.344 11.095H6.75z" />
          </svg>
        </div>
        <p className="text-slate-600 font-medium mb-1">
          {loading ? '파일 파싱 중...' : 'CSV 또는 Excel 파일을 여기에 드롭하세요'}
        </p>
        <p className="text-slate-400 text-sm">또는 클릭해서 파일 선택</p>
        <input ref={inputRef} type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={onInputChange} />
      </div>

      {/* Error */}
      {error && (
        <div className="mt-4 w-full max-w-xl bg-red-50 border border-red-200 rounded-xl p-4 text-red-600 text-sm">
          {error}
        </div>
      )}

      {/* Demo button */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <span className="text-slate-400 text-sm">— or —</span>
        <button
          onClick={handleDemo}
          disabled={loading}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 shadow-sm"
        >
          데모 데이터로 시작하기
        </button>
      </div>

    </div>
  );
}
