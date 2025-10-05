// src/types/index.ts

export interface PingResponse {
    status: string;
    index_loaded: boolean;
    vectors: number;
  }
  
  export interface Source {
    title: string;
    year: number;
    page: number;
    path: string;
    facets: {
      organism?: string;
      stressor?: string;
      platform?: string;
    };
    score?: number;
  }
  
  export interface SearchResult {
    title: string;
    year: number;   // keep as number in the UI
    page: number;   // keep as number in the UI
    snippet: string;
    path: string;
    facets: {
      organism?: string;
      stressor?: string;
      platform?: string;
    };
    score?: number;
  }
  
  export interface AskSimpleResponse {
    answer: string;
    sources: Source[];
    inferred_facets?: {
      organism?: string | null;
      stressor?: string | null;
      platform?: string | null;
    };
    query_guess?: {
      organism?: string | null;
      stressor?: string | null;
      platform?: string | null;
    };
    tts_audio_url?: string;
  }
  
  export interface TTSResponse {
    audio_url: string;
    file_path: string;
  }
  
  export interface STTResponse {
    text: string;
  }
  
  /** Library (browse) endpoint types */
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
  
  export interface LibraryResponse {
    total: number;
    page: number;
    page_size: number;
    results: SearchResult[];
  }
  