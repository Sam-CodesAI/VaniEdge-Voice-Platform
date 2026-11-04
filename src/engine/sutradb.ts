/**
 * VaniEdge AI: SutraDB Edge Hybrid Retrieval Engine
 * Sub-5ms in-memory LRU cache for active telephony calls paired with
 * zero-dependency SutraClient ASGI HTTP/2 backend synchronization.
 */

import { SutraClient } from "../client/sutradb";

export interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  category: "clinic" | "restaurant" | "auto" | "general" | string;
  metadata?: Record<string, string | number | boolean>;
  tokens?: string[];
  vector?: number[];
}

export interface HybridSearchResult {
  document: KnowledgeDocument;
  bm25Score: number;
  vectorScore: number;
  fusedScore: number;
  matchedTerms: string[];
}

export interface QueryOptions {
  topK?: number;
  category?: "clinic" | "restaurant" | "auto" | "general" | string;
  filter?: Record<string, string | number | boolean>;
  minScore?: number;
}

/**
 * High-performance, zero-allocation LRU cache for sub-5ms local responses.
 */
export class LruCache<K, V> {
  private capacity: number;
  private cache: Map<K, { value: V; expiresAt?: number }>;
  private defaultTtlMs?: number;

  constructor(capacity: number = 500, defaultTtlMs?: number) {
    this.capacity = capacity;
    this.cache = new Map();
    this.defaultTtlMs = defaultTtlMs;
  }

  get(key: K): V | undefined {
    const item = this.cache.get(key);
    if (!item) return undefined;
    if (item.expiresAt && Date.now() > item.expiresAt) {
      this.cache.delete(key);
      return undefined;
    }
    this.cache.delete(key);
    this.cache.set(key, item);
    return item.value;
  }

  set(key: K, value: V, ttlMs?: number): void {
    if (this.cache.has(key)) {
      this.cache.delete(key);
    } else if (this.cache.size >= this.capacity) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }
    const ttl = ttlMs ?? this.defaultTtlMs;
    this.cache.set(key, {
      value,
      expiresAt: ttl ? Date.now() + ttl : undefined,
    });
  }

  has(key: K): boolean {
    return this.get(key) !== undefined;
  }

  clear(): void {
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }
}

/**
 * Tokenizes text across English, Latin, digits, and Indian scripts.
 */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s\u0900-\u0D7F]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

export function computeDenseVector(text: string, dim: number = 64): number[] {
  const tokens = tokenize(text);
  const vec = new Array(dim).fill(0);
  if (tokens.length === 0) return vec;

  for (const token of tokens) {
    for (let i = 0; i < token.length - 1; i++) {
      const bigram = token.slice(i, i + 2);
      let hash = 0;
      for (let j = 0; j < bigram.length; j++) {
        hash = (hash * 31 + bigram.charCodeAt(j)) % dim;
      }
      vec[Math.abs(hash)] += 1;
    }
  }

  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < dim; i++) vec[i] /= norm;
  }
  return vec;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return Math.max(0, Math.min(1, (dot + 1) / 2));
}

export class SutraHybridEngine {
  private docs: Map<string, KnowledgeDocument> = new Map();
  private docLengths: Map<string, number> = new Map();
  private docFreqs: Map<string, number> = new Map();
  private avgLength: number = 0;
  private totalDocs: number = 0;

  private readonly k1: number = 1.5;
  private readonly b: number = 0.75;

  // In-memory LRU cache for sub-5ms active call retrieval
  private readonly lruCache: LruCache<string, HybridSearchResult[]>;
  private readonly client: SutraClient;
  private readonly collectionName: string;

  constructor(
    initialDocuments: KnowledgeDocument[] = [],
    options: {
      lruCapacity?: number;
      sutraClient?: SutraClient;
      collectionName?: string;
    } = {}
  ) {
    this.lruCache = new LruCache<string, HybridSearchResult[]>(
      options.lruCapacity ?? 500
    );
    this.client = options.sutraClient || new SutraClient();
    this.collectionName = options.collectionName || "vaniedge_knowledge";

    for (const doc of initialDocuments) {
      this.insert(doc);
    }
  }

  public insert(doc: KnowledgeDocument): void {
    if (this.docs.has(doc.id)) {
      this.delete(doc.id);
    }

    const tokens = tokenize(`${doc.title} ${doc.content}`);
    const vector = computeDenseVector(`${doc.title} ${doc.content}`);

    this.docs.set(doc.id, { ...doc, tokens, vector });
    this.docLengths.set(doc.id, tokens.length);

    const uniqueTokens = new Set(tokens);
    for (const t of uniqueTokens) {
      this.docFreqs.set(t, (this.docFreqs.get(t) || 0) + 1);
    }

    this.totalDocs = this.docs.size;
    let sum = 0;
    for (const len of this.docLengths.values()) sum += len;
    this.avgLength = this.totalDocs > 0 ? sum / this.totalDocs : 0;

    // Evict cached query responses on mutation
    this.lruCache.clear();

    // Fire-and-forget sync to central SutraDB if available
    this.client
      .insert(this.collectionName, [
        {
          id: doc.id,
          text: `${doc.title}\n${doc.content}`,
          metadata: {
            title: doc.title,
            category: doc.category,
            ...(doc.metadata || {}),
          },
        },
      ])
      .catch(() => {
        // Silently tolerate if SutraDB daemon is running offline
      });
  }

  private buildCacheKey(queryText: string, options: QueryOptions): string {
    return `${queryText.toLowerCase().trim()}::${options.category || ""}::${options.topK ?? 3}::${options.minScore ?? 0}::${JSON.stringify(options.filter || {})}`;
  }

  public query(
    queryText: string,
    optionsOrTopK: number | QueryOptions = 3
  ): HybridSearchResult[] {
    const options: QueryOptions =
      typeof optionsOrTopK === "number" ? { topK: optionsOrTopK } : optionsOrTopK;

    // Sub-5ms fast-path: Check LRU cache
    const cacheKey = this.buildCacheKey(queryText, options);
    const cached = this.lruCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    const topK = options.topK ?? 3;
    const category = options.category;
    const filter = options.filter;
    const minScore = options.minScore ?? 0;

    const qTokens = tokenize(queryText);
    const qVector = computeDenseVector(queryText);
    if (this.totalDocs === 0 || qTokens.length === 0) return [];

    const rawResults: Array<{
      document: KnowledgeDocument;
      bm25Score: number;
      vectorScore: number;
      matchedTerms: string[];
    }> = [];

    for (const [id, doc] of this.docs.entries()) {
      if (category && doc.category !== category) {
        continue;
      }

      if (filter && doc.metadata) {
        let matches = true;
        for (const [key, val] of Object.entries(filter)) {
          if (doc.metadata[key] !== val) {
            matches = false;
            break;
          }
        }
        if (!matches) continue;
      } else if (filter && !doc.metadata) {
        continue;
      }

      const docTokens = doc.tokens || [];
      const docVector = doc.vector || [];
      const docLength = this.docLengths.get(id) || 1;

      let bm25 = 0;
      const matched: string[] = [];
      const counts = new Map<string, number>();
      for (const t of docTokens) counts.set(t, (counts.get(t) || 0) + 1);

      for (const qt of qTokens) {
        const tf = counts.get(qt) || 0;
        if (tf > 0) {
          matched.push(qt);
          const df = this.docFreqs.get(qt) || 1;
          const idf = Math.log((this.totalDocs - df + 0.5) / (df + 0.5) + 1);
          const num = tf * (this.k1 + 1);
          const den = tf + this.k1 * (1 - this.b + this.b * (docLength / (this.avgLength || 1)));
          bm25 += idf * (num / den);
        }
      }

      const vectorScore = cosineSimilarity(qVector, docVector);
      rawResults.push({
        document: doc,
        bm25Score: Math.max(0, bm25),
        vectorScore,
        matchedTerms: matched,
      });
    }

    if (rawResults.length === 0) return [];

    const maxBm25 = Math.max(1, ...rawResults.map((r) => r.bm25Score));
    const fused = rawResults
      .map((r) => {
        const normBm25 = r.bm25Score / maxBm25;
        const fusedScore = r.vectorScore * 0.6 + normBm25 * 0.4;
        return { ...r, fusedScore };
      })
      .filter((r) => r.fusedScore >= minScore);

    fused.sort((a, b) => b.fusedScore - a.fusedScore);
    const finalResults = fused.slice(0, topK);

    // Populate in-memory LRU cache
    this.lruCache.set(cacheKey, finalResults);
    return finalResults;
  }

  /**
   * Async hybrid query utilizing remote SutraDB ASGI server over HTTP/2 with
   * automatic fallback to local LRU cache / local index.
   */
  public async queryAsync(
    queryText: string,
    optionsOrTopK: number | QueryOptions = 3
  ): Promise<HybridSearchResult[]> {
    const options: QueryOptions =
      typeof optionsOrTopK === "number" ? { topK: optionsOrTopK } : optionsOrTopK;

    const cacheKey = this.buildCacheKey(queryText, options);
    const cached = this.lruCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    try {
      const remote = await this.client.query(this.collectionName, {
        text: queryText,
        top_k: options.topK ?? 3,
        hybrid: true,
      });

      if (remote && Array.isArray(remote.results) && remote.results.length > 0) {
        const results: HybridSearchResult[] = remote.results.map((r) => {
          const doc: KnowledgeDocument = {
            id: r.id,
            title: (r.metadata?.title as string) || r.id,
            content: r.text || "",
            category: (r.metadata?.category as string) || "general",
            metadata: r.metadata as Record<string, string | number | boolean>,
          };
          return {
            document: doc,
            bm25Score: r.bm25_score ?? 1.0,
            vectorScore: r.dense_score ?? 1.0,
            fusedScore: r.score,
            matchedTerms: [],
          };
        });

        this.lruCache.set(cacheKey, results);
        return results;
      }
    } catch {
      // Fallback to local index
    }

    return this.query(queryText, options);
  }

  public get(id: string): KnowledgeDocument | undefined {
    return this.docs.get(id);
  }

  public delete(id: string): boolean {
    if (!this.docs.has(id)) return false;
    this.docs.delete(id);
    this.docLengths.delete(id);

    this.docFreqs.clear();
    for (const doc of this.docs.values()) {
      const tokens = doc.tokens || [];
      const unique = new Set(tokens);
      for (const t of unique) {
        this.docFreqs.set(t, (this.docFreqs.get(t) || 0) + 1);
      }
    }

    this.totalDocs = this.docs.size;
    let sum = 0;
    for (const len of this.docLengths.values()) sum += len;
    this.avgLength = this.totalDocs > 0 ? sum / this.totalDocs : 0;
    this.lruCache.clear();

    this.client.deleteDocument(this.collectionName, id).catch(() => {});
    return true;
  }

  public clear(): void {
    this.docs.clear();
    this.docLengths.clear();
    this.docFreqs.clear();
    this.avgLength = 0;
    this.totalDocs = 0;
    this.lruCache.clear();
  }

  public exportSnapshot(): KnowledgeDocument[] {
    return Array.from(this.docs.values()).map(
      ({ id, title, content, category, metadata }) => ({
        id,
        title,
        content,
        category,
        metadata,
      })
    );
  }

  public importSnapshot(docs: KnowledgeDocument[]): void {
    this.clear();
    for (const doc of docs) {
      this.insert(doc);
    }
  }

  public size(): number {
    return this.totalDocs;
  }

  public getLruStats(): { size: number; capacity: number } {
    return {
      size: this.lruCache.size(),
      capacity: 500,
    };
  }
}
