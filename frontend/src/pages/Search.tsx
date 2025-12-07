// src/pages/Search.tsx
import React, { useEffect, useRef, useState } from 'react';
import { Search as SearchIcon, Mic, Send, Loader2, GitBranch, FileText } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { AnswerCard } from '../components/AnswerCard';
import { ResultCard } from '../components/ResultCard';
import type { Bookmark as BookmarkType, SearchResult } from '../types';
import { useNavigate } from 'react-router-dom';
import { AudioPlayer } from '../components/AudioPlayer';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');

const STORAGE_KEY = 'sbke:last_search';

type LastSearchPayload = {
  query: string;
  answer: string | null;
  sources: any[];
  results: SearchResult[];
};

export const Search: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [sources, setSources] = useState<any[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [ttsAudioUrl, setTtsAudioUrl] = useState<string | null>(null);

  const { askSimple, search, stt } = useApi();
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  // Restore last search from sessionStorage on first mount
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as LastSearchPayload;
      if (saved?.query) setQuery(saved.query);
      if (Array.isArray(saved?.results)) setSearchResults(saved.results);
      setAnswer(saved?.answer ?? null);
      setSources(Array.isArray(saved?.sources) ? saved.sources : []);
    } catch {}
  }, []);

  // Keyboard shortcut to focus the bar
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const ae = document.activeElement as HTMLElement | null;
      const isEditable =
        ae &&
        (ae.tagName === 'INPUT' ||
          ae.tagName === 'TEXTAREA' ||
          ae.isContentEditable);
      if (e.key === '/' && !isEditable) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const running = askSimple.isPending || search.isPending;

  // Cleanup media stream on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  const transcribeAudio = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      const audioFile = new File([blob], 'recording.webm', { type: 'audio/webm' });
      const result = await stt.mutateAsync(audioFile);
      setQuery(result.text);
    } catch (error) {
      console.error('Transcription error:', error);
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleMicClick = async () => {
    if (isTranscribing) return;

    if (isRecording) {
      // Stop recording
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      }
    } else {
      // Start recording
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        streamRef.current = stream;

        const mediaRecorder = new MediaRecorder(stream, {
          mimeType: 'audio/webm;codecs=opus'
        });

        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data.size > 0) {
            chunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
          chunksRef.current = [];
          transcribeAudio(blob);
        };

        mediaRecorder.start();
        setIsRecording(true);
      } catch (error) {
        console.error('Error accessing microphone:', error);
      }
    }
  };

  const persist = (payload: LastSearchPayload) => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {}
  };

  const handleSearch = async () => {
    if (!query.trim() || running) return;
    setTtsAudioUrl(null); // Clear previous audio
    try {
      const [askResult, searchResult] = await Promise.all([
        askSimple.mutateAsync({ question: query, topK: 12, tts: true }),
        search.mutateAsync({ query, topK: 10 }),
      ]);

      const results = Array.isArray(searchResult) ? searchResult : [];
      setAnswer(askResult.answer);
      setSources(askResult.sources || []);
      setSearchResults(results);

      // Set TTS audio URL if available
      if (askResult.tts_audio_url) {
        setTtsAudioUrl(askResult.tts_audio_url);
      }

      persist({
        query,
        answer: askResult.answer,
        sources: askResult.sources || [],
        results,
      });
    } catch (error) {
      console.error('Search error:', error);
    }
  };

  const handleSave = () => {
    if (!answer || !sources.length) return;
    const bookmark: BookmarkType = {
      id: Date.now().toString(),
      question: query,
      answer,
      timestamp: Date.now(),
      sourceCount: sources.length,
    };
    const existing = JSON.parse(localStorage.getItem('bookmarks') || '[]');
    const updated = [bookmark, ...existing].slice(0, 10);
    localStorage.setItem('bookmarks', JSON.stringify(updated));
  };

  const handleClear = () => {
    setAnswer(null);
    setSources([]);
    setSearchResults([]);
    setTtsAudioUrl(null);
    // also clear the saved state
    try {
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const goMindMap = () => {
    // Ensure state is persisted before navigate
    persist({ query, answer, sources, results: searchResults });
    navigate('/mindmap', { state: { query, results: searchResults, from: 'search' } });
  };

  const goStory = () => {
    // Use the top file paths (when available) to ground the story
    const paths = searchResults?.map(r => r.path).slice(0, 12) || [];
    persist({ query, answer, sources, results: searchResults });
    navigate('/story', { state: { question: query, paths, top_k: Math.min(paths.length || 12, 12), from: 'search' } });
  };

  return (
    <div className="min-h-screen py-10">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Search</h1>
          <p className="text-sm text-gray-400 mt-1">Query the knowledge base with AI assistance</p>
        </header>

        {/* Search Bar */}
        <section className="glass-panel p-5 md:p-6 mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Search Space Biology</h2>
            <div className="hidden md:flex items-center gap-2 text-xs text-gray-400">
              <span className="opacity-80">Press</span>
              <kbd className="px-2 py-1 rounded-md border border-white/15 bg-white/5 text-[11px] font-mono">/</kbd>
              <span className="opacity-80">to focus</span>
            </div>
          </div>

          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about microgravity effects, immune changes, plants in space…"
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              className="w-full h-14 md:h-16 rounded-2xl pl-12 pr-48 bg-white/4 border border-white/10 outline-none text-white placeholder-gray-400
                         focus:border-white/20 focus:ring-2 focus:ring-[rgba(16,129,199,0.25)] transition"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
              <button
                onClick={handleMicClick}
                disabled={isTranscribing}
                title={isRecording ? 'Stop recording' : isTranscribing ? 'Transcribing...' : 'Voice input'}
                className={`rounded-xl px-3 h-10 border transition
                  ${isRecording
                    ? 'border-red-500/40 bg-red-500/20 text-red-400 animate-pulse'
                    : isTranscribing
                    ? 'border-gray-500/40 bg-gray-500/10 text-gray-400 cursor-not-allowed'
                    : 'border-white/10 bg-white/5 text-gray-200 hover:bg-white/10'}`}
              >
                {isTranscribing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Mic className="w-5 h-5" />}
              </button>
              <button
                onClick={handleSearch}
                disabled={!query.trim() || running}
                className="nasa-button h-10 px-4 md:px-5 rounded-xl disabled:opacity-60 disabled:cursor-not-allowed"
                title="Search"
              >
                {running ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                <span className="hidden md:inline">{running ? 'Searching…' : 'Search'}</span>
              </button>
            </div>
          </div>

          {/* Action buttons appear when we have results */}
          {searchResults.length > 0 && (
            <div className="mt-4 flex items-center gap-2">
              <button
                onClick={goMindMap}
                className="nasa-button-secondary inline-flex items-center gap-2"
                title="Visualize MindMap"
              >
                <GitBranch className="w-4 h-4" />
                <span>MindMap</span>
              </button>
              <button
                onClick={goStory}
                className="nasa-button-secondary inline-flex items-center gap-2"
                title="Build Story"
              >
                <FileText className="w-4 h-4" />
                <span>Storytelling</span>
              </button>
            </div>
          )}
        </section>

        {/* Loading */}
        {running && (
          <div className="space-y-4 mb-6">
            <div className="glass-panel p-6">
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-white/10 rounded w-3/4"></div>
                <div className="h-4 bg-white/10 rounded w-1/2"></div>
                <div className="h-4 bg-white/10 rounded w-5/6"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="glass-panel p-4 animate-pulse">
                  <div className="h-4 bg-white/10 rounded mb-2"></div>
                  <div className="h-3 bg-white/10 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Answer */}
        {answer && (
          <div className="mb-6">
            {/* TTS Audio Player - Top */}
            {ttsAudioUrl && (
              <div className="mb-4 flex justify-center">
                <AudioPlayer audioUrl={`${API_BASE}${ttsAudioUrl}`} />
              </div>
            )}
            <AnswerCard
              answer={answer}
              sources={sources}
              onSave={handleSave}
              onClear={handleClear}
            />
          </div>
        )}

        {/* Results */}
        {searchResults.length > 0 && (
          <section className="space-y-4">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <SearchIcon className="w-5 h-5" />
              <span>Results ({searchResults.length})</span>
            </h2>
            <div className="space-y-4">
              {searchResults.map((result, index) => (
                <ResultCard key={`${result.path}-${index}`} result={result} index={index} />
              ))}
            </div>
          </section>
        )}

        {/* Errors */}
        {askSimple.error && (
          <div className="glass-panel p-6 border border-red-500/20 bg-red-500/5 mt-6">
            <div className="text-red-400">
              <h3 className="font-semibold mb-2">Search Error</h3>
              <p className="text-sm">
                {askSimple.error.message || 'Failed to get AI response. Please try again.'}
              </p>
            </div>
          </div>
        )}
        {search.error && (
          <div className="glass-panel p-6 border border-orange-500/20 bg-orange-500/5 mt-6">
            <div className="text-orange-400">
              <h3 className="font-semibold mb-2">Results Error</h3>
              <p className="text-sm">
                {search.error.message || 'Failed to load search results. Please try again.'}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
