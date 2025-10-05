import React, { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon, SlidersHorizontal, X } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import type { SearchResult } from '../types';

type Facet = 'organism' | 'stressor' | 'platform';

export const Library: React.FC = () => {
  const { stats, browse } = useApi();

  const [q, setQ] = useState<string>('');
  const [organism, setOrganism] = useState<string>('');
  const [stressor, setStressor] = useState<string>('');
  const [platform, setPlatform] = useState<string>('');
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  const [total, setTotal] = useState<number>(0);
  const [results, setResults] = useState<SearchResult[]>([]);

  const organisms = useMemo(
    () => Object.keys(stats.data?.organisms || {}),
    [stats.data]
  );
  const stressors = useMemo(
    () => Object.keys(stats.data?.stressors || {}),
    [stats.data]
  );
  const platforms = useMemo(
    () => Object.keys(stats.data?.platforms || {}),
    [stats.data]
  );

  const runBrowse = async (params?: Partial<{ q: string; organism: string; stressor: string; platform: string; page: number; page_size: number }>) => {
    const payload = {
      q,
      organism: organism || undefined,
      stressor: stressor || undefined,
      platform: platform || undefined,
      page,
      page_size: pageSize,
      ...(params || {}),
    };
    const res = await browse(payload); // <- plain function, not mutateAsync
    setResults(res.results);
    setTotal(res.total);
  };

  // initial load
  useEffect(() => {
    runBrowse({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearFacet = (f: Facet) => {
    if (f === 'organism') setOrganism('');
    if (f === 'stressor') setStressor('');
    if (f === 'platform') setPlatform('');
    setPage(1);
    runBrowse({ page: 1 });
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    runBrowse({ page: 1 });
  };

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-end justify-between gap-3">
        <form onSubmit={onSubmit} className="flex-1">
          <div className="relative">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Find research by title, text, or path…"
              className="w-full rounded-xl bg-white/5 border border-white/10 px-5 py-3.5 pr-12 text-base text-white placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/40"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 nasa-button-secondary px-3 py-2"
              title="Search"
            >
              <SearchIcon className="w-4 h-4" />
            </button>
          </div>
        </form>

        <div className="hidden md:flex items-center gap-2">
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-gray-300">
            Total: <span className="text-white font-semibold">{total}</span>
          </div>
          <div className="px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm">
            <select
              value={pageSize}
              onChange={(e) => {
                const v = Number(e.target.value);
                setPageSize(v);
                setPage(1);
                runBrowse({ page: 1, page_size: v }); // <- snake_case to backend
              }}
              className="bg-transparent outline-none"
            >
              {[10, 20, 50, 100].map((n) => (
                <option key={n} value={n} className="bg-[#0b1220]">
                  {n}/page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Facets */}
      <div className="glass-panel p-4">
        <div className="flex items-center gap-2 mb-3 text-gray-300">
          <SlidersHorizontal className="w-4 h-4" />
          <span className="font-medium">Filter by facets</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400">Organism</label>
            <div className="mt-1 flex gap-2">
              <select
                value={organism}
                onChange={(e) => {
                  setOrganism(e.target.value);
                  setPage(1);
                  runBrowse({ page: 1, organism: e.target.value || undefined });
                }}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
              >
                <option value="" className="bg-[#0b1220]">All</option>
                {organisms.map((o) => (
                  <option key={o} value={o} className="bg-[#0b1220]">{o}</option>
                ))}
              </select>
              {organism && (
                <button className="nasa-button-secondary" onClick={() => clearFacet('organism')} title="Clear organism">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400">Stressor</label>
            <div className="mt-1 flex gap-2">
              <select
                value={stressor}
                onChange={(e) => {
                  setStressor(e.target.value);
                  setPage(1);
                  runBrowse({ page: 1, stressor: e.target.value || undefined });
                }}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
              >
                <option value="" className="bg-[#0b1220]">All</option>
                {stressors.map((s) => (
                  <option key={s} value={s} className="bg-[#0b1220]">{s}</option>
                ))}
              </select>
              {stressor && (
                <button className="nasa-button-secondary" onClick={() => clearFacet('stressor')} title="Clear stressor">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          <div>
            <label className="text-xs uppercase tracking-wide text-gray-400">Platform</label>
            <div className="mt-1 flex gap-2">
              <select
                value={platform}
                onChange={(e) => {
                  setPlatform(e.target.value);
                  setPage(1);
                  runBrowse({ page: 1, platform: e.target.value || undefined });
                }}
                className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2"
              >
                <option value="" className="bg-[#0b1220]">All</option>
                {platforms.map((p) => (
                  <option key={p} value={p} className="bg-[#0b1220]">{p}</option>
                ))}
              </select>
              {platform && (
                <button className="nasa-button-secondary" onClick={() => clearFacet('platform')} title="Clear platform">
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {results.map((r: SearchResult, i: number) => (
          <article key={`${r.path}-${i}`} className="glass-panel p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h4 className="font-semibold text-white truncate">{r.title}</h4>
                <div className="text-xs text-gray-400">
                  <span>{r.year || '—'} • Page {r.page || '—'}</span>
                </div>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-blue-600/20 text-blue-300">
                {r.facets.platform || '—'}
              </span>
            </div>
            <p className="text-sm text-gray-300 leading-relaxed">
              {r.snippet}
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {r.facets.organism && (
                <span className="text-xs bg-green-600/20 text-green-400 px-2 py-0.5 rounded-full">
                  {r.facets.organism}
                </span>
              )}
              {r.facets.stressor && (
                <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-0.5 rounded-full">
                  {r.facets.stressor}
                </span>
              )}
              {r.facets.platform && (
                <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-0.5 rounded-full">
                  {r.facets.platform}
                </span>
              )}
            </div>
            <div className="pt-2 text-xs text-cyan-300 break-all">{r.path}</div>
          </article>
        ))}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-400">
          Page {page} / {totalPages}
        </div>
        <div className="flex items-center gap-2">
          <button
            className="nasa-button-secondary px-3 py-2 disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => {
              const np = Math.max(1, page - 1);
              setPage(np);
              runBrowse({ page: np });
            }}
          >
            Previous
          </button>
          <button
            className="nasa-button-secondary px-3 py-2 disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => {
              const np = Math.min(totalPages, page + 1);
              setPage(np);
              runBrowse({ page: np });
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};
