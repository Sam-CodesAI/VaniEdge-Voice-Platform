import test from "node:test";
import assert from "node:assert";
import { SutraClient } from "../src/client/sutradb";
import { SutraHybridEngine, LruCache } from "../src/engine/sutradb";
import { initSupabaseFromEnv, validateSupabaseConfig } from "../lib/supabase-client";

test("SutraDB Engine & In-Memory LRU Cache Test Suite", async (t) => {
  await t.test("LruCache: Capacity eviction and fast hit lookup", () => {
    const cache = new LruCache<string, number>(2);
    cache.set("a", 100);
    cache.set("b", 200);
    assert.strictEqual(cache.size(), 2);
    assert.strictEqual(cache.get("a"), 100);

    // Adding 'c' should evict 'b' since 'a' was accessed more recently
    cache.set("c", 300);
    assert.strictEqual(cache.size(), 2);
    assert.strictEqual(cache.has("b"), false);
    assert.strictEqual(cache.get("a"), 100);
    assert.strictEqual(cache.get("c"), 300);
  });

  await t.test("LruCache: Honors TTL expiry", async () => {
    const cache = new LruCache<string, string>(5, 30); // 30ms TTL
    cache.set("ephemeral", "valid");
    assert.strictEqual(cache.get("ephemeral"), "valid");

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.strictEqual(cache.get("ephemeral"), undefined);
    assert.strictEqual(cache.has("ephemeral"), false);
  });

  await t.test("SutraHybridEngine: In-memory hybrid BM25 + dense search latency under 5ms", () => {
    const engine = new SutraHybridEngine([
      {
        id: "clinic-1",
        title: "Apex Indiranagar Pediatric Clinic",
        content: "Pediatric care, vaccinations, and consultation fees ₹500.",
        category: "clinic",
      },
      {
        id: "restaurant-1",
        title: "Bhojanalaya Kitchen Thali",
        content: "Authentic North Indian Thali with Paneer Butter Masala and Dal.",
        category: "restaurant",
      },
      {
        id: "auto-1",
        title: "Apex 24/7 Roadside Towing",
        content: "Emergency towing and flat tyre jumpstart within 15 minutes.",
        category: "auto",
      },
    ]);

    // Benchmark lookup speed
    const start = performance.now();
    const results = engine.query("pediatric vaccination fee", 2);
    const elapsed = performance.now() - start;

    assert.ok(elapsed < 20, `Initial query took ${elapsed.toFixed(2)}ms`);
    assert.strictEqual(results.length, 2);
    assert.strictEqual(results[0].document.id, "clinic-1");
    assert.strictEqual(results[0].document.category, "clinic");

    // Second hit must hit in-memory LRU cache in sub-millisecond time
    const cacheStart = performance.now();
    const cachedResults = engine.query("pediatric vaccination fee", 2);
    const cacheElapsed = performance.now() - cacheStart;

    assert.ok(cacheElapsed < 5, `LRU cache lookup took ${cacheElapsed.toFixed(2)}ms (must be < 5ms)`);
    assert.strictEqual(cachedResults[0].document.id, "clinic-1");
  });

  await t.test("SutraHybridEngine: Mutations evict stale cache entries", () => {
    const engine = new SutraHybridEngine([
      {
        id: "test-1",
        title: "Initial Doc",
        content: "Original knowledge base content",
        category: "general",
      },
    ]);

    const res1 = engine.query("knowledge", 1);
    assert.strictEqual(res1.length, 1);
    assert.strictEqual(engine.getLruStats().size, 1);

    // Inserting new document must invalidate LRU cache
    engine.insert({
      id: "test-2",
      title: "Updated Doc",
      content: "Better knowledge base content with higher density",
      category: "general",
    });

    assert.strictEqual(engine.getLruStats().size, 0);

    // Deleting document must invalidate LRU cache
    const res2 = engine.query("knowledge", 2);
    assert.strictEqual(res2.length, 2);
    assert.strictEqual(engine.getLruStats().size, 1);

    engine.delete("test-2");
    assert.strictEqual(engine.getLruStats().size, 0);
  });

  await t.test("SutraHybridEngine: queryAsync falls back to local engine when remote daemon is offline", async () => {
    const fakeClient = new SutraClient({ baseUrl: "http://127.0.0.1:19999", timeoutMs: 100 });
    const engine = new SutraHybridEngine(
      [
        {
          id: "fallback-1",
          title: "Offline Resilient Entry",
          content: "This must be retrieved even if daemon is unreachable",
          category: "clinic",
        },
      ],
      { sutraClient: fakeClient }
    );

    const results = await engine.queryAsync("daemon unreachable entry", 1);
    assert.strictEqual(results.length, 1);
    assert.strictEqual(results[0].document.id, "fallback-1");
  });

  await t.test("SutraClient: Request headers and configuration", () => {
    const client = new SutraClient({
      baseUrl: "https://sutra.internal:8443/",
      apiKey: "sutra_secret_token",
      timeoutMs: 5000,
    });
    assert.ok(client);
  });

  await t.test("Cloudflare Worker Dynamic Env: initSupabaseFromEnv enables edge persistence", () => {
    const workerEnv = {
      NEXT_PUBLIC_SUPABASE_URL: "https://xyzcompany.supabase.co",
      SUPABASE_SERVICE_ROLE_KEY: "eyJhGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.valid-edge-token",
    };

    const config = validateSupabaseConfig(workerEnv);
    assert.strictEqual(config.isConfigured, true);

    const initialized = initSupabaseFromEnv(workerEnv);
    assert.strictEqual(initialized.isConfigured, true);
    assert.ok(initialized.supabase);
    assert.ok(initialized.supabasePublic);
  });
});
