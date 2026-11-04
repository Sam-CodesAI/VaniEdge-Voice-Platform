/**
 * SutraDB Zero-Dependency TypeScript Client
 * Communicates with the SutraDB ASGI server over HTTP/2 with persistent connection keep-alive,
 * configurable timeout handling, and full collection/document CRUD.
 */

export interface SutraClientConfig {
  baseUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface SutraCreateCollectionParams {
  name: string;
  dimension: number;
  metric?: "cosine" | "euclidean" | "dot";
  enable_wal?: boolean;
}

export interface SutraDocumentInput {
  id?: string;
  text?: string;
  vector?: number[];
  metadata?: Record<string, unknown>;
}

export interface SutraQueryOptions {
  text?: string;
  vector?: number[];
  filter?: Record<string, unknown>;
  top_k?: number;
  hybrid?: boolean;
  alpha?: number;
  rrf_constant?: number;
  dense_weight?: number;
  bm25_weight?: number;
  use_ann?: boolean;
}

export interface SutraQueryResultItem {
  id: string;
  score: number;
  text?: string;
  metadata?: Record<string, unknown>;
  dense_score?: number;
  bm25_score?: number;
}

export interface SutraQueryResponse {
  count: number;
  results: SutraQueryResultItem[];
  latency_ms?: number;
}

export class SutraClient {
  private readonly baseUrl: string;
  private readonly apiKey?: string;
  private readonly timeoutMs: number;

  constructor(config: SutraClientConfig = {}) {
    let resolvedUrl = config.baseUrl;
    if (!resolvedUrl && typeof process !== "undefined" && process.env?.SUTRADB_URL) {
      resolvedUrl = process.env.SUTRADB_URL;
    }
    this.baseUrl = (resolvedUrl || "http://127.0.0.1:8000").replace(/\/$/, "");
    this.apiKey =
      config.apiKey ||
      (typeof process !== "undefined" ? process.env?.SUTRADB_API_KEY : undefined);
    this.timeoutMs = config.timeoutMs ?? 3000;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;
    const controller = new AbortController();
    const timeoutTimer = setTimeout(() => controller.abort(), this.timeoutMs);

    const headers: Record<string, string> = {
      Accept: "application/json",
      Connection: "keep-alive",
      ...(options.headers as Record<string, string> | undefined),
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (!response.ok) {
        let errorDetail = `HTTP ${response.status} ${response.statusText}`;
        try {
          const errJson = await response.json();
          if (errJson && typeof errJson === "object") {
            errorDetail = (errJson as any).detail || (errJson as any).error || errorDetail;
          }
        } catch {
          // Non-JSON error body
        }
        throw new Error(`[SutraClient] Request failed (${response.status}): ${errorDetail}`);
      }

      return (await response.json()) as T;
    } finally {
      clearTimeout(timeoutTimer);
    }
  }

  public async health(): Promise<{
    status: string;
    version: string;
    collections: string[];
  }> {
    return this.request<{
      status: string;
      version: string;
      collections: string[];
    }>("/health", { method: "GET" });
  }

  public async listCollections(): Promise<{ collections: any[] }> {
    return this.request<{ collections: any[] }>("/collections", {
      method: "GET",
    });
  }

  public async createCollection(
    params: SutraCreateCollectionParams
  ): Promise<{ message: string; stats: any }> {
    return this.request<{ message: string; stats: any }>("/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  }

  public async getCollectionStats(name: string): Promise<any> {
    return this.request<any>(`/collections/${encodeURIComponent(name)}/stats`, {
      method: "GET",
    });
  }

  public async dropCollection(name: string): Promise<{ message: string }> {
    return this.request<{ message: string }>(
      `/collections/${encodeURIComponent(name)}`,
      { method: "DELETE" }
    );
  }

  public async insert(
    collectionName: string,
    documents: SutraDocumentInput[]
  ): Promise<{ inserted: number; total_count: number }> {
    return this.request<{ inserted: number; total_count: number }>(
      `/collections/${encodeURIComponent(collectionName)}/documents`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documents }),
      }
    );
  }

  public async getDocument(collectionName: string, id: string): Promise<any> {
    return this.request<any>(
      `/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(id)}`,
      { method: "GET" }
    );
  }

  public async deleteDocument(
    collectionName: string,
    id: string
  ): Promise<{ deleted: number; message: string }> {
    return this.request<{ deleted: number; message: string }>(
      `/collections/${encodeURIComponent(collectionName)}/documents/${encodeURIComponent(id)}`,
      { method: "DELETE" }
    );
  }

  public async deleteDocuments(
    collectionName: string,
    ids: string[]
  ): Promise<{ deleted: number; message: string }> {
    return this.request<{ deleted: number; message: string }>(
      `/collections/${encodeURIComponent(collectionName)}/documents`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      }
    );
  }

  public async query(
    collectionName: string,
    options: SutraQueryOptions
  ): Promise<SutraQueryResponse> {
    return this.request<SutraQueryResponse>(
      `/collections/${encodeURIComponent(collectionName)}/query`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(options),
      }
    );
  }
}
