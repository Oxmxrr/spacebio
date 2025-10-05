// src/components/AnswerCard.tsx
import React, { useMemo, useState } from 'react';
import { Copy, Bookmark, Trash2, ExternalLink } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { AskSimpleResponse } from '../types';

type Source = AskSimpleResponse['sources'][number];

interface AnswerCardProps {
  answer: string;
  sources: Source[];
  onSave?: () => void;
  onClear?: () => void;
}

export const AnswerCard: React.FC<AnswerCardProps> = ({ answer, sources, onSave, onClear }) => {
  const [showSources, setShowSources] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(answer);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {}
  };

  const formatPath = (path: string) => path.split('/').pop() || path;

  // Parse bracket citations [1], [2] to filter sources; fallback to top 4 by score
  const filteredSources = useMemo(() => {
    if (!Array.isArray(sources) || sources.length === 0) return [];
    const citedSet: number[] = [];
    const rx = /\[(\d+)\]/g;
    let m: RegExpExecArray | null;
    while ((m = rx.exec(answer)) !== null) {
      const idx = parseInt(m[1], 10);
      if (!Number.isNaN(idx) && idx >= 1 && idx <= sources.length && !citedSet.includes(idx)) {
        citedSet.push(idx);
      }
    }
    if (citedSet.length) {
      return citedSet.map((i) => sources[i - 1]).filter(Boolean);
    }
    const withScore = sources
      .map((s) => ({ s, score: typeof (s as any).score === 'number' ? (s as any).score : 0 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((x) => x.s);
    return withScore;
  }, [answer, sources]);

  return (
    <section className="glass-panel p-6 space-y-4" aria-label="Answer">
      {/* Minimal header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-xl font-semibold text-white">Answer</h3>
          <span className="text-xs border border-white/10 text-gray-300 px-2 py-0.5 rounded-full">
            {filteredSources.length} {filteredSources.length === 1 ? 'reference' : 'references'}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className={`nasa-button-secondary inline-flex items-center gap-2 ${copied ? 'bg-green-600/20 text-green-400' : ''}`}
            title="Copy answer"
          >
            <Copy className="w-4 h-4" />
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>

          {onSave && (
            <button onClick={onSave} className="nasa-button-secondary inline-flex items-center gap-2" title="Save to history">
              <Bookmark className="w-4 h-4" />
              <span>Save</span>
            </button>
          )}

          {onClear && (
            <button onClick={onClear} className="text-gray-400 hover:text-red-400 transition-colors" title="Clear">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Markdown-rendered answer */}
      <div className="leading-relaxed md-content">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            h1: ({ node, ...props }) => <h3 className="text-lg font-semibold text-white mt-2 mb-2" {...props} />,
            h2: ({ node, ...props }) => <h3 className="text-lg font-semibold text-white mt-2 mb-2" {...props} />,
            h3: ({ node, ...props }) => <h4 className="text-base font-semibold text-white mt-2 mb-2" {...props} />,
            p:  ({ node, ...props }) => <p className="text-gray-100 mb-3" {...props} />,
            ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1 mb-3" {...props} />,
            ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1 mb-3" {...props} />,
            li: ({ node, ...props }) => <li className="text-gray-100" {...props} />,
            a:  ({ node, ...props }) => <a className="text-blue-200 underline hover:opacity-80" {...props} />,
            strong: ({ node, ...props }) => <span className="font-semibold text-gray-100" {...props} />,
            em: ({ node, ...props }) => <span className="italic text-gray-100" {...props} />,
            code: (props: any) => {
              const isInline = !!props.inline;
              const { children, ...rest } = props;
              return isInline ? (
                <code className="bg-white/10 px-1.5 py-0.5 rounded text-[0.9em]" {...rest}>
                  {children}
                </code>
              ) : (
                <code className="block bg-white/10 p-3 rounded overflow-x-auto" {...rest}>
                  {children}
                </code>
              );
            },
          }}
        >
          {answer}
        </ReactMarkdown>
      </div>

      {/* References */}
      {filteredSources.length > 0 && (
        <div className="pt-4 border-t border-white/10">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-lg font-semibold text-white">References</h4>
            <button
              onClick={() => setShowSources((s) => !s)}
              className="nasa-button-secondary inline-flex items-center gap-2"
              aria-expanded={showSources}
              title="Toggle references"
            >
              <ExternalLink className="w-4 h-4" />
              <span>{showSources ? 'Hide' : 'Show'}</span>
            </button>
          </div>

          {showSources && (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {filteredSources.map((source, i) => (
                <article key={`${source.path}-${i}`} className="glass-panel p-4 space-y-2" aria-label={`Reference ${i + 1}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h5 className="font-semibold text-white text-sm truncate">{source.title}</h5>
                      <div className="flex flex-wrap items-center gap-4 text-xs text-gray-400 mt-1">
                        {source.year && <span>Year: {String(source.year)}</span>}
                        {source.page !== undefined && source.page !== null && <span>Page: {source.page}</span>}
                        <span className="text-blue-200 truncate">{formatPath(source.path)}</span>
                      </div>
                    </div>
                    <span className="text-xs text-white px-2 py-1 rounded-full bg-white/10">[{i + 1}]</span>
                  </div>

                  {/* badges from flat fields */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {'organism' in source && source.organism && (
                      <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full">
                        {String(source.organism)}
                      </span>
                    )}
                    {'stressor' in source && source.stressor && (
                      <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-1 rounded-full">
                        {String(source.stressor)}
                      </span>
                    )}
                    {'platform' in source && source.platform && (
                      <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full">
                        {String(source.platform)}
                      </span>
                    )}
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
