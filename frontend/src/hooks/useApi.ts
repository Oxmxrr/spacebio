// src/hooks/useApi.ts
import { useQuery, useMutation } from '@tanstack/react-query';
import {
  PingResponse,
  SearchResult,
  AskSimpleResponse,
  TTSResponse,
  STTResponse,
  LibraryParams,
  LibraryResponse,
  MindMapParams,
  MindMapResponse,
  StoryParams,
  StoryResponse,
} from '../types';
import { useAuth } from '../contexts/AuthContext';

const API_BASE = (import.meta.env.VITE_API_BASE || 'http://localhost:8000').replace(/\/+$/, '');

// Token storage keys (same as AuthContext)
const TOKEN_KEY = 'spacebio_auth_token';

function getStoredToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

function getAuthHeaders(): Record<string, string> {
  const token = getStoredToken();
  if (token) {
    return { Authorization: `Bearer ${token}` };
  }
  return {};
}

/** Raw shapes from the backend */
type RawStatsResponse = {
  organisms: [string, number][];
  stressors: [string, number][];
  platforms: [string, number][];
  chunks: number;
};

type RawSearchItem = {
  score?: number;
  title: string;
  year: number | string | null;
  page: number | string | null;
  snippet: string;
  path: string;
  organism?: string | null;
  stressor?: string | null;
  platform?: string | null;
};

type RawSearchResponse = { results: RawSearchItem[] };

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private buildURL(endpoint: string) {
    return `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000); // 30s safety timeout
    try {
      const url = this.buildURL(endpoint);
      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...options.headers,
        },
        ...options,
        signal: controller.signal,
      });

      const text = await response.text().catch(() => '');
      if (!response.ok) {
        // Try to surface JSON error bodies when possible
        let details = text;
        try {
          const parsed = JSON.parse(text);
          details = JSON.stringify(parsed);
        } catch {}
        throw new Error(`API request failed: ${response.status} ${response.statusText}${details ? ` - ${details}` : ''}`);
      }

      // empty body?
      if (!text) return {} as T;
      return JSON.parse(text) as T;
    } finally {
      clearTimeout(timeout);
    }
  }

  async ping(): Promise<PingResponse> {
    return this.request<PingResponse>('/ping');
  }

  /** Normalize arrays -> object maps so the UI can keep using stats.organisms[key] etc. */
  async getStats(): Promise<{
    organisms: Record<string, number>;
    stressors: Record<string, number>;
    platforms: Record<string, number>;
    total_chunks: number;
  }> {
    const raw = await this.request<RawStatsResponse>('/stats');
    const toObj = (pairs: [string, number][]) => Object.fromEntries(pairs || []);
    return {
      organisms: toObj(raw.organisms),
      stressors: toObj(raw.stressors),
      platforms: toObj(raw.platforms),
      total_chunks: raw.chunks,
    };
  }

  /** Map backend items into UI SearchResult (force numbers for year/page) */
  private mapResults(raw: RawSearchItem[]): SearchResult[] {
    return (raw || []).map<SearchResult>((r) => ({
      title: r.title,
      year: Number(r.year ?? 0) || 0,
      page: Number(r.page ?? 0) || 0,
      snippet: r.snippet,
      path: r.path,
      facets: {
        organism: r.organism ?? undefined,
        stressor: r.stressor ?? undefined,
        platform: r.platform ?? undefined,
      },
      score: r.score ?? 0,
    }));
  }

  async search(query: string, topK: number = 10): Promise<SearchResult[]> {
    const params = new URLSearchParams({ q: query, top_k: topK.toString() });
    const raw = await this.request<RawSearchResponse>(`/search?${params}`);
    return this.mapResults(raw.results);
  }

  async askSimple(question: string, topK: number = 8, tts: boolean = false): Promise<AskSimpleResponse> {
    const params = tts ? '?tts=true' : '';
    return this.request<AskSimpleResponse>(`/ask-simple${params}`, {
      method: 'POST',
      body: JSON.stringify({ question, top_k: topK }),
    });
  }

  async tts(text: string, voice?: string): Promise<TTSResponse> {
    return this.request<TTSResponse>('/tts', {
      method: 'POST',
      body: JSON.stringify({ text, voice }),
    });
  }

  async stt(file: File): Promise<STTResponse> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await fetch(this.buildURL('/stt'), {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`STT request failed: ${response.status} ${response.statusText}`);
    }
    return response.json();
  }

  /** Library */
  async library(params: LibraryParams = {}): Promise<LibraryResponse> {
    const qs = new URLSearchParams();
    if (params.q) qs.set('q', params.q);
    if (params.organism) qs.set('organism', params.organism);
    if (params.stressor) qs.set('stressor', params.stressor);
    if (params.platform) qs.set('platform', params.platform);
    if (params.page) qs.set('page', String(params.page));
    if (params.page_size) qs.set('page_size', String(params.page_size));
    if (params.sort) qs.set('sort', params.sort);
    if (params.order) qs.set('order', params.order);

    const raw = await this.request<{
      total: number; page: number; page_size: number; results: RawSearchItem[];
    }>(`/library?${qs.toString()}`);

    return {
      total: raw.total,
      page: raw.page,
      page_size: raw.page_size,
      results: this.mapResults(raw.results),
    };
  }

  /** NEW: MindMap + Story */
  async mindmap(params: MindMapParams): Promise<MindMapResponse> {
    return this.request<MindMapResponse>('/mindmap', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async story(params: StoryParams): Promise<StoryResponse> {
    // Primary endpoint
    try {
      return await this.request<StoryResponse>('/story', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    } catch (e) {
      // Graceful fallback to /storytelling alias if configured server-side
      return this.request<StoryResponse>('/storytelling', {
        method: 'POST',
        body: JSON.stringify(params),
      });
    }
  }
}

const apiClient = new ApiClient(API_BASE);

export const useApi = () => {
  const ping = useQuery({
    queryKey: ['ping'],
    queryFn: () => apiClient.ping(),
    refetchInterval: 30000,
    retry: 1,
  });

  const stats = useQuery({
    queryKey: ['stats'],
    queryFn: () => apiClient.getStats(),
    refetchInterval: 60000,
  });

  const search = useMutation({
    mutationFn: ({ query, topK }: { query: string; topK?: number }) =>
      apiClient.search(query, topK),
  });

  const askSimple = useMutation({
    mutationFn: ({ question, topK, tts }: { question: string; topK?: number; tts?: boolean }) =>
      apiClient.askSimple(question, topK, tts),
  });

  const tts = useMutation({
    mutationFn: ({ text, voice }: { text: string; voice?: string }) =>
      apiClient.tts(text, voice),
  });

  const stt = useMutation({
    mutationFn: (file: File) => apiClient.stt(file),
  });

  const browse = async (params: LibraryParams) => apiClient.library(params);

  const useLibrary = (params: LibraryParams) =>
    useQuery({
      queryKey: ['library', params],
      queryFn: () => apiClient.library(params),
    });

  // NEW
  const mindmap = useMutation({
    mutationFn: (params: MindMapParams) => apiClient.mindmap(params),
  });

  const story = useMutation({
    mutationFn: (params: StoryParams) => apiClient.story(params),
  });

  return {
    // Queries
    ping,
    stats,

    // Mutations
    search,
    askSimple,
    tts,
    stt,

    // Library
    browse,
    useLibrary,

    // NEW
    mindmap,
    story,

    client: apiClient,
  };
};
