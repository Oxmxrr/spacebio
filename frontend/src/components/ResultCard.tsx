import React, { useState } from 'react';
import { FileText, Calendar, MapPin, Link as LinkIcon, Clipboard } from 'lucide-react';
import type { SearchResult } from '../types';

interface ResultCardProps {
  result: SearchResult;
  index: number;
}

const prettyFile = (path: string) => {
  const base = path.split(/[\\/]/).pop() || path;
  return base.replace(/\.[^.]+$/, '').replace(/_/g, ' ');
};

export const ResultCard: React.FC<ResultCardProps> = ({ result, index }) => {
  const [showFullSnippet, setShowFullSnippet] = useState(false);
  const [copied, setCopied] = useState<'snippet' | 'path' | null>(null);

  // neutral, professional score pill
  const tone = { text: 'text-blue-300', bg: 'bg-blue-600/20' };

  const copy = async (text: string, which: 'snippet' | 'path') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1600);
    } catch {}
  };

  const snippet = result.snippet || '';

  return (
    <article className="glass-panel p-4 space-y-3 card-hover" aria-label={`Result ${index + 1}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-white text-sm leading-tight truncate">{result.title}</h4>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-400 mt-1">
            <div className="inline-flex items-center gap-1"><Calendar className="w-3 h-3" /><span>{result.year || '—'}</span></div>
            <div className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /><span>Page {result.page || '—'}</span></div>
            <div className="inline-flex items-center gap-1">
              <MapPin className="w-3 h-3" />
              <span className="text-space-cyan">{prettyFile(result.path)}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className={`text-xs px-2 py-1 rounded-full ${tone.bg} ${tone.text}`} aria-label="Relevance score">
            {Math.round((result.score ?? 0) * 100)}%
          </span>
          <span className="text-xs text-gray-500">#{index + 1}</span>
        </div>
      </div>

      <div className="text-sm text-gray-300 leading-relaxed">
        {showFullSnippet ? (
          <div className="whitespace-pre-wrap">{snippet}</div>
        ) : (
          <div>{snippet.length > 220 ? `${snippet.slice(0, 220)}…` : snippet}</div>
        )}
        {snippet.length > 220 && (
          <button
            onClick={() => setShowFullSnippet(!showFullSnippet)}
            className="text-cyan-400 hover:text-cyan-300 text-xs mt-1 transition-colors"
            aria-expanded={showFullSnippet}
          >
            {showFullSnippet ? 'Show less' : 'Show more'}
          </button>
        )}
      </div>

      {(result.facets && Object.entries(result.facets).length > 0) && (
        <div className="flex flex-wrap gap-1">
          {result.facets.organism && (
            <span className="text-xs bg-green-600/20 text-green-400 px-2 py-1 rounded-full">
              {result.facets.organism}
            </span>
          )}
          {result.facets.stressor && (
            <span className="text-xs bg-orange-600/20 text-orange-400 px-2 py-1 rounded-full">
              {result.facets.stressor}
            </span>
          )}
          {result.facets.platform && (
            <span className="text-xs bg-blue-600/20 text-blue-400 px-2 py-1 rounded-full">
              {result.facets.platform}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between pt-2 border-top border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => copy(snippet, 'snippet')}
            className={`text-xs inline-flex items-center gap-1 transition-colors ${copied === 'snippet' ? 'text-green-400' : 'text-gray-400 hover:text-white'}`}
            title="Copy snippet"
          >
            <Clipboard className="w-3.5 h-3.5" /> {copied === 'snippet' ? 'Copied!' : 'Copy snippet'}
          </button>
          <button
            onClick={() => copy(result.path, 'path')}
            className={`text-xs inline-flex items-center gap-1 transition-colors ${copied === 'path' ? 'text-green-400' : 'text-space-cyan hover:text-space-cyan/80'}`}
            title="Copy Link"
          >
            <LinkIcon className="w-3.5 h-3.5" /> {copied === 'path' ? 'Copied!' : 'Copy Link'}
          </button>
        </div>
      </div>
    </article>
  );
};
