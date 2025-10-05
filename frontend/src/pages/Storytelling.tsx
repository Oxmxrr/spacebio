// src/pages/Storytelling.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BookOpen, Loader2, RefreshCw, Edit3, ArrowLeft } from 'lucide-react';
import { useApi } from '../hooks/useApi';

// ---- Local types (avoid dependency on ../types export mismatches)
type StorySeed = {
  question: string;
  paths?: string[];
  top_k?: number;
};

type OutlineItem = { heading: string; key_points: string[] };

type StorySource = {
  title: string;
  year?: number | string | null;
  page?: number | null;
  path: string;
  snippet?: string;
};

type LocalStoryResponse = {
  markdown: string;
  outline: OutlineItem[];
  sources: StorySource[];
};

const STORAGE_KEY = 'sbke:last_story_seed';

export const Storytelling: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation() as any;
  const { story } = useApi();

  // Seed can come from navigation state or from sessionStorage fallback
  const initialSeed: StorySeed | null = useMemo(() => {
    if (location?.state?.question) return location.state as StorySeed;
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY);
      return saved ? (JSON.parse(saved) as StorySeed) : null;
    } catch {
      return null;
    }
  }, [location?.state]);

  const [question, setQuestion] = useState<string>(initialSeed?.question || '');
  const [paths, setPaths] = useState<string[]>(initialSeed?.paths || []);
  const [topK, setTopK] = useState<number>(initialSeed?.top_k || 12);

  // Story controls
  const [mode, setMode] = useState<'scientific' | 'public' | 'chronological' | 'thematic'>('scientific');
  const [length, setLength] = useState<'short' | 'medium' | 'long'>('short');

  // Output
  const [result, setResult] = useState<LocalStoryResponse | null>(null);
  const building = story.isPending;

  const canBuild = !!question && ((paths?.length ?? 0) > 0 || !!topK);

  // Auto-build once when arriving from Search (or when we have a stored seed)
  useEffect(() => {
    if (!question) return;
    // remember the seed for page refresh
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ question, paths, top_k: topK }));
    } catch {}
    // auto-build only if we don't already have a result
    if (!result && !story.isPending) {
      (async () => {
        try {
          const payload = await story.mutateAsync({
            question,
            mode,
            length,
            top_k: topK,
            paths: paths && paths.length ? paths : undefined,
          });
          setResult(payload as unknown as LocalStoryResponse);
        } catch (e) {
          console.error(e);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [question, JSON.stringify(paths), topK]);

  const rebuild = async () => {
    if (!canBuild || story.isPending) return;
    try {
      const payload = await story.mutateAsync({
        question,
        mode,
        length,
        top_k: topK,
        paths: paths && paths.length ? paths : undefined,
      });
      setResult(payload as unknown as LocalStoryResponse);
    } catch (e) {
      console.error(e);
    }
  };

  const usedSourceCount = useMemo(() => {
    if (paths?.length) return Math.min(paths.length, topK);
    return topK;
  }, [paths, topK]);

  return (
    <div className="space-y-6">
      {/* Back to Search */}
      <div>
      <button
  onClick={() => window.history.length > 1 ? history.back() : navigate('/search')}
  className="flex items-center gap-2 text-sm text-gray-200 hover:text-white transition-colors px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20"
>
  <ArrowLeft className="w-4 h-4" />
  <span>Back to Search</span>
</button>

      </div>

      {/* Header */}
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-blue-300" />
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text.white tracking-tight">Storytelling</h1>
            <p className="text-sm text-gray-400">Generate coherent narratives with inline citations</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
            title="Style"
          >
            <option className="bg-[#0b1220]" value="scientific">Scientific</option>
            <option className="bg-[#0b1220]" value="public">Public</option>
            <option className="bg-[#0b1220]" value="chronological">Chronological</option>
            <option className="bg-[#0b1220]" value="thematic">Thematic</option>
          </select>
          <select
            value={length}
            onChange={(e) => setLength(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-gray-200"
            title="Length"
          >
            <option className="bg-[#0b1220]" value="short">Short</option>
            <option className="bg-[#0b1220]" value="medium">Medium</option>
            <option className="bg-[#0b1220]" value="long">Long</option>
          </select>
          <button
            onClick={rebuild}
            disabled={!canBuild || building}
            className="nasa-button-secondary inline-flex items-center gap-2 disabled:opacity-60"
            title="Rebuild"
          >
            {building ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            <span>{building ? 'Building…' : 'Rebuild'}</span>
          </button>
        </div>
      </header>

      {/* Seed (read-only) */}
      <section className="glass-panel p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div className="flex-1">
            <div className="text-xs uppercase tracking-wide text-gray-400 mb-1">Prompt</div>
            <div className="rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white flex items-center gap-2">
              <Edit3 className="w-4 h-4 text-gray-400" />
              <span className="truncate">{question || '—'}</span>
            </div>
          </div>
          <div className="shrink-0">
            <div className="text-xs text-gray-400">Context</div>
            <div className="text-sm text-gray-200">
              Using <span className="text-white font-semibold">{usedSourceCount}</span> source{usedSourceCount === 1 ? '' : 's'} from your recent search
            </div>
          </div>
        </div>
      </section>

      {/* Output */}
      {building && (
        <section className="glass-panel p-6">
          <div className="flex items-center gap-3 text-gray-200">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span>Composing your story…</span>
          </div>
        </section>
      )}

      {result && (
        <section className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Outline */}
          <aside className="glass-panel p-4 lg:col-span-1 h-max">
            <h3 className="text-sm font-semibold text-white mb-3">Outline</h3>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              {result.outline?.map((it: OutlineItem, idx: number) => (
                <li key={idx}>
                  <div className="text-gray-100 font-medium">{it.heading}</div>
                  {it.key_points?.length > 0 && (
                    <ul className="list-disc pl-5 mt-1 space-y-1">
                      {it.key_points.map((k: string, i: number) => (
                        <li key={i} className="text-gray-300">{k}</li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          </aside>

          {/* Story */}
          <article className="glass-panel p-6 lg:col-span-3">
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ node, ...props }) => <h2 className="text-xl font-semibold mt-4 mb-2" {...props} />,
                  h2: ({ node, ...props }) => <h3 className="text-lg font-semibold mt-4 mb-2" {...props} />,
                  h3: ({ node, ...props }) => <h4 className="text-base font-semibold mt-3 mb-2" {...props} />,
                  p:  ({ node, ...props }) => <p className="text-gray-100" {...props} />,
                  ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-1" {...props} />,
                  ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-1" {...props} />,
                  li: ({ node, ...props }) => <li className="text-gray-100" {...props} />,
                  a:  ({ node, ...props }) => <a className="text-blue-200 underline hover:opacity-80" {...props} />,
                  strong: ({ node, ...props }) => <span className="font-semibold text-gray-100" {...props} />,
                  em: ({ node, ...props }) => <span className="italic text-gray-100" {...props} />,
                  code: (props: any) => {
                    const isInline = !!props.inline;
                    const { children, ...rest } = props;
                    return isInline ? (
                      <code className="bg-white/10 px-1.5 py-0.5 rounded text-[0.9em]" {...rest}>{children}</code>
                    ) : (
                      <code className="block bg-white/10 p-3 rounded overflow-x-auto" {...rest}>{children}</code>
                    );
                  },
                }}
              >
                {result.markdown || '_No content returned._'}
              </ReactMarkdown>
            </div>

            {/* References */}
            {!!result.sources?.length && (
              <div className="mt-6 pt-4 border-t border-white/10">
                <h4 className="text-lg font-semibold text-white mb-2">References</h4>
                <div className="space-y-2">
                  {result.sources.map((s: StorySource, i: number) => {
                    const file = (s.path || '').split(/[\\/]/).pop() || s.path;
                    return (
                      <div key={`${s.path}-${i}`} className="text-sm text-gray-200 flex items-start gap-2">
                        <span className="text-xs text-white bg-white/10 rounded px-1.5 py-0.5">[{i + 1}]</span>
                        <div>
                          <div className="font-medium text-white">{s.title || 'Untitled'}</div>
                          <div className="text-gray-400">
                            {s.year ? <span>{s.year} • </span> : null}
                            {typeof s.page === 'number' ? <span>p{s.page} • </span> : null}
                            <span className="text-blue-200 break-all">{file}</span>
                          </div>
                          {s.snippet && (
                            <div className="text-gray-300 mt-1">
                              {s.snippet.slice(0, 200)}
                              {s.snippet.length > 200 ? '…' : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </article>
        </section>
      )}

      {!building && !result && (
        <section className="glass-panel p-6">
          <p className="text-gray-300">
            No seed found. Go back to{' '}
            <button className="text-blue-200 underline" onClick={() => navigate('/search')}>
              Search
            </button>
            , run a query, then click <span className="text-white font-semibold">Storytelling</span>.
          </p>
        </section>
      )}
    </div>
  );
};
