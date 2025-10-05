// src/types/index.ts

/** Ping / status */
export type PingResponse = {
  status: 'ok';
  index_loaded: boolean;
  vectors: number;
};

/** Unified source reference used across the app (AnswerCard, etc.) */
export type Source = {
  title: string;
  year?: number | string | null;
  page?: number | string | null;
  path: string;
  organism?: string | null;
  stressor?: string | null;
  platform?: string | null;
  score?: number;
};

/** Normalized search result the UI expects (numbers coerced in useApi) */
export type SearchResult = {
  title: string;
  year: number;
  page: number;
  snippet: string;
  path: string;
  facets: {
    organism?: string;
    stressor?: string;
    platform?: string;
  };
  score?: number;
};

/** Ask-simple response from backend */
export type AskSimpleResponse = {
  answer: string;
  sources: Source[];
  inferred_facets?: Record<string, string | null>;
  query_guess?: Record<string, string | null>;
  tts_audio_url?: string;
};

/** TTS / STT */
export type TTSResponse = {
  audio_url: string;
  file_path: string;
};

export type STTResponse = {
  text: string;
};

/** Library */
export type LibraryParams = {
  q?: string;
  organism?: string;
  stressor?: string;
  platform?: string;
  page?: number;
  page_size?: number;
  sort?: 'year' | 'path';
  order?: 'asc' | 'desc';
};

export type LibraryResponse = {
  total: number;
  page: number;
  page_size: number;
  results: SearchResult[];
};

/** Optional bookmark used by Search page */
export type Bookmark = {
  id: string;
  question: string;
  answer: string;
  timestamp: number;
  sourceCount: number;
};

/** NEW: MindMap types */
export type MindMapNode = {
  id: string;
  label: string;
  kind: 'organism' | 'stressor' | 'platform' | 'method' | 'gene' | 'concept' | string;
  weight: number;
};

export type MindMapEdge = {
  source: string;
  target: string;
  relation: string;
  weight: number;
};

export type MindMapSource = {
  title: string;
  year?: string | number | null;
  page?: number | string | null;
  path: string;
  snippet: string;
};

export type MindMapResponse = {
  nodes: MindMapNode[];
  edges: MindMapEdge[];
  supportByNode: Record<string, MindMapSource[]>;
};

export type MindMapParams = {
  question?: string;
  top_k?: number;
  organism?: string;
  stressor?: string;
  platform?: string;
  paths?: string[];
};

/** NEW: Story types */
export type StoryOutlineItem = { heading: string; key_points: string[] };
export type StoryResponse = { markdown: string; outline: StoryOutlineItem[]; sources: MindMapSource[] };

export type StoryParams = {
  question?: string;
  mode?: 'scientific' | 'public' | 'chronological' | 'thematic';
  length?: 'short' | 'medium' | 'long';
  top_k?: number;
  organism?: string;
  stressor?: string;
  platform?: string;
  paths?: string[];
};
