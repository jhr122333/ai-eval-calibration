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
