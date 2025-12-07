// src/pages/Story.tsx
import React, { useMemo, useState } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { useLocation } from 'react-router-dom';
import { AudioPlayer } from '../components/AudioPlayer';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');

export const Story: React.FC = () => {
  const { askSimple } = useApi();
  const location = useLocation() as unknown as {
    state?: { question?: string; sources?: Array<{ title: string; year?: any; page?: any; path: string }> };
  };

  // Prefer the incoming question/sources (from Search)
  const [question, setQuestion] = useState(location.state?.question || '');
  const [story, setStory] = useState<string | null>(null);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  const prefilledSources = useMemo(
    () => (location.state?.sources ? location.state.sources.slice(0, 15) : []),
    [location.state]
  );

  const handleBuild = async () => {
    if (!question.trim() || running) return;
    setRunning(true);
    setStory(null);
    setTtsAudioUrl(null);
    try {
      // Use ask-simple with TTS enabled
      const res = await askSimple.mutateAsync({ question, topK: 12, tts: true });

      const md = `# Story Draft\n\n**Prompt:** ${question}\n\n${res.answer}\n\n---\n**Key Sources**\n${
        (prefilledSources.length ? prefilledSources : (res.sources || [])).slice(0, 10)
          .map((s: any, i: number) => `- [${i + 1}] ${s.title} (${s.year ?? '—'}) — ${s.path}`)
          .join('\n')
      }`;

      setStory(md);

      // Set TTS audio URL if available
      if (res.tts_audio_url) {
        setTtsAudioUrl(res.tts_audio_url);
      }
    } catch (e) {
      console.error(e);
      setStory('Failed to build story.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="glass-panel p-5">
        <h2 className="text-lg font-semibold text-white mb-3">Story Builder</h2>
        <div className="flex gap-2">
          <input
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="e.g., Explain how microgravity affects human immunity"
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-white placeholder:text-gray-400 outline-none"
          />
          <button
            onClick={handleBuild}
            disabled={!question.trim() || running}
            className="nasa-button rounded-xl px-4 min-w-[120px] disabled:opacity-50"
          >
            {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            <span className="ml-2">{running ? 'Building…' : 'Build'}</span>
          </button>
        </div>
        {prefilledSources.length > 0 && (
          <p className="text-xs text-gray-400 mt-2">
            Using {prefilledSources.length} sources from your recent search.
          </p>
        )}
      </div>

      {story && (
        <div className="glass-panel p-5">
          {/* TTS Audio Player - Top */}
          {ttsAudioUrl && (
            <div className="pb-4 mb-4 border-b border-white/10 flex justify-center">
              <AudioPlayer audioUrl={`${API_BASE}${ttsAudioUrl}`} />
            </div>
          )}
          <div className="whitespace-pre-wrap text-gray-100">
            {story}
          </div>
        </div>
      )}
    </div>
  );
};
