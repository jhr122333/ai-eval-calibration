import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/** Parse ## and ### headings from raw markdown text */
function parseHeadings(text) {
  const lines = text.split('\n');
  const headings = [];
  lines.forEach((line, i) => {
    const match = line.match(/^(#{2,3})\s+(.+)/);
    if (match) {
      const level = match[1].length; // 2 or 3
      const title = match[2].trim();
      const id = title
        .toLowerCase()
        .replace(/[^a-z0-9가-힣\s]/g, '')
        .trim()
        .replace(/\s+/g, '-');
      headings.push({ id, title, level, lineIndex: i });
    }
  });
  return headings;
}

/** Custom heading renderer — injects id for anchor scrolling */
function HeadingWithId({ level, children }) {
  const text = typeof children === 'string' ? children : children?.toString?.() ?? '';
  const id = text
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const Tag = `h${level}`;
  const styles = {
    2: 'text-xl font-bold text-slate-800 mt-8 mb-3 pb-2 border-b border-slate-200',
    3: 'text-base font-semibold text-slate-700 mt-6 mb-2',
  };

  return (
    <Tag id={id} className={styles[level] ?? 'font-semibold mt-4 mb-2'}>
      {children}
    </Tag>
  );
}

const components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold text-slate-900 mb-4 pb-3 border-b-2 border-blue-200">{children}</h1>
  ),
  h2: ({ children }) => <HeadingWithId level={2}>{children}</HeadingWithId>,
  h3: ({ children }) => <HeadingWithId level={3}>{children}</HeadingWithId>,
  p: ({ children }) => <p className="text-slate-700 leading-relaxed mb-3">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3 text-slate-700 ml-2">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal list-inside space-y-1 mb-3 text-slate-700 ml-2">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-blue-300 bg-blue-50 px-4 py-2 my-3 rounded-r-lg text-slate-700 italic">
      {children}
    </blockquote>
  ),
  code: ({ inline, children }) =>
    inline ? (
      <code className="bg-slate-100 text-slate-800 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
    ) : (
      <pre className="bg-slate-900 text-slate-100 rounded-xl p-4 overflow-x-auto text-sm font-mono my-3">
        <code>{children}</code>
      </pre>
    ),
  table: ({ children }) => (
    <div className="overflow-x-auto my-4">
      <table className="w-full text-sm border-collapse border border-slate-200 rounded-lg overflow-hidden">
        {children}
      </table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-slate-100 text-slate-700 font-medium">{children}</thead>,
  tbody: ({ children }) => <tbody>{children}</tbody>,
  tr: ({ children }) => <tr className="border-b border-slate-200 hover:bg-slate-50">{children}</tr>,
  th: ({ children }) => <th className="px-4 py-2 text-left font-semibold">{children}</th>,
  td: ({ children }) => <td className="px-4 py-2 align-top">{children}</td>,
  hr: () => <hr className="my-6 border-slate-200" />,
  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
};

export default function GuidelinesTab() {
  const [markdown, setMarkdown] = useState('');
  const [headings, setHeadings] = useState([]);
  const [activeId, setActiveId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const contentRef = useRef(null);
  const observerRef = useRef(null);

  // Load SOP markdown
  useEffect(() => {
    fetch('./evaluation_guidelines_sop.md')
      .then(res => {
        if (!res.ok) throw new Error('가이드라인 파일을 불러오지 못했습니다.');
        return res.text();
      })
      .then(text => {
        setMarkdown(text);
        setHeadings(parseHeadings(text));
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []);

  // IntersectionObserver to track active heading
  useEffect(() => {
    if (!markdown || !contentRef.current) return;

    observerRef.current?.disconnect();

    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      { rootMargin: '-60px 0px -60% 0px', threshold: 0 }
    );

    // Observe all headings after render
    const timer = setTimeout(() => {
      contentRef.current?.querySelectorAll('h2, h3').forEach(el => observer.observe(el));
    }, 100);

    observerRef.current = observer;
    return () => { observer.disconnect(); clearTimeout(timer); };
  }, [markdown]);

  function scrollTo(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-400">
        가이드라인 불러오는 중...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-red-600">{error}</div>
    );
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Sticky sidebar TOC */}
      <aside className="hidden lg:block w-56 shrink-0 sticky top-24 self-start max-h-[calc(100vh-7rem)] overflow-y-auto">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">목차</p>
          <nav className="space-y-0.5">
            {headings.map(h => (
              <button
                key={h.id}
                onClick={() => scrollTo(h.id)}
                className={`w-full text-left text-sm rounded-lg px-2 py-1.5 transition-colors leading-snug
                  ${h.level === 3 ? 'pl-5 text-xs' : ''}
                  ${activeId === h.id
                    ? 'bg-blue-50 text-blue-700 font-medium'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'}`}
              >
                {h.title}
              </button>
            ))}
          </nav>
        </div>
      </aside>

      {/* SOP content */}
      <div
        ref={contentRef}
        className="flex-1 bg-white rounded-2xl border border-slate-200 p-8 shadow-sm min-w-0"
        style={{ maxWidth: 800 }}
      >
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {markdown}
        </ReactMarkdown>
      </div>
    </div>
  );
}
