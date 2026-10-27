import { NextRequest, NextResponse } from "next/server";
import { SutraHybridEngine } from "@/src/engine/sutradb";
import { supabase, isSupabaseConfigured } from "@/lib/supabase-client";
import { DEFAULT_KNOWLEDGE_PRESETS } from "@/lib/sutradb-engine";
import { requireAuth } from "@/lib/auth-guard";
import { checkRateLimit, getClientIp } from "@/lib/rate-limit";
import { isTenantOwnedByUser } from "@/lib/tenant-store";
import { z } from "zod";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  query: z.string().min(1).max(1000),
  category: z.string().max(50).optional(),
  tenantId: z.string().max(50).optional(),
  filter: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  topK: z.number().int().min(1).max(20).default(3),
  minScore: z.number().min(0).max(1).default(0),
});

const InsertDocSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(10000),
  category: z.string().max(50).default("general"),
  metadata: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  tenantId: z.string().max(50).optional(),
});

export async function POST(request: NextRequest) {
  try {
    // 1. Rate limiting
    const clientIp = getClientIp(request);
    const rateCheck = checkRateLimit(clientIp, "rag_query", 60, 60 * 1000);
    if (!rateCheck.success) {
      return NextResponse.json(
        { error: "Too many query requests. Please slow down." },
        { status: 429, headers: { "Retry-After": Math.ceil(rateCheck.resetMs / 1000).toString() } }
      );
    }

    // 2. Strict Authentication
    const { auth, errorResponse } = await requireAuth(request);
    if (errorResponse) {
      return errorResponse;
    }

    // 3. Schema validation
    const rawBody = (await request.json()) as unknown;
    const parseResult = QuerySchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { query, category, filter, topK, minScore, tenantId } = parseResult.data;

    // 4. Strict Tenant Isolation: verify caller has access to the requested tenant
    const userRole = auth!.user.role || "user";
    const hasAccess = await isTenantOwnedByUser(tenantId, auth!.user.id, userRole);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: Cannot query documents belonging to another tenant" },
        { status: 403 }
      );
    }

    const effectiveTenantId = tenantId || auth!.user.id;

    const engine = new SutraHybridEngine();

    // Seed preset documents as fallback
    for (const preset of DEFAULT_KNOWLEDGE_PRESETS) {
      engine.insert({
        id: preset.id,
        title: preset.title,
        content: preset.content,
        category: preset.category,
      });
    }

    // Connect to Supabase if configured and pull live tenant knowledge rows
    if (isSupabaseConfigured) {
      try {
        let queryBuilder = supabase.from("sutradb_knowledge").select("*");
        if (effectiveTenantId) {
          queryBuilder = queryBuilder.eq("tenant_id", effectiveTenantId);
        }

        const { data: dbDocs } = await queryBuilder;
        if (dbDocs && Array.isArray(dbDocs)) {
          for (const row of dbDocs) {
            engine.insert({
              id: row.id,
              title: row.title,
              content: row.content,
              category: row.category,
              metadata: row.metadata,
            });
          }
        }
      } catch {
        // Fallback to presets
      }
    }

    const start = performance.now();
    const results = engine.query(query, {
      category,
      filter,
      topK,
      minScore,
    });
    const latencyMs = +(performance.now() - start).toFixed(2);

    return NextResponse.json({
      query,
      count: results.length,
      latencyMs,
      results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  // 1. Enforce authentication & CSRF
  const { auth, errorResponse } = await requireAuth(request, { checkCsrf: true });
  if (errorResponse) {
    return errorResponse;
  }

  try {
    const rawBody = (await request.json()) as unknown;
    const parseResult = InsertDocSchema.safeParse(rawBody);

    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parseResult.error.format() },
        { status: 400 }
      );
    }

    const { title, content, category, metadata, tenantId: bodyTenantId } = parseResult.data;

    // Strict Tenant Isolation: verify caller has access to the target tenant
    const userRole = auth!.user.role || "user";
    const hasAccess = await isTenantOwnedByUser(bodyTenantId, auth!.user.id, userRole);
    if (!hasAccess) {
      return NextResponse.json(
        { error: "Forbidden: Cannot ingest documents into another tenant's knowledge store" },
        { status: 403 }
      );
    }

    const effectiveTenantId = bodyTenantId || auth!.user.id;

    const doc = {
      tenant_id: effectiveTenantId,
      title,
      content,
      category,
      metadata,
    };

    const start = performance.now();
    let data = doc;

    if (isSupabaseConfigured) {
      const { data: inserted, error } = await supabase
        .from("sutradb_knowledge")
        .insert([doc])
        .select()
        .single();
      if (!error && inserted) {
        data = inserted;
      }
    }

    const latencyMs = +(performance.now() - start).toFixed(2);

    return NextResponse.json(
      {
        success: true,
        document: data,
        latencyMs,
      },
      { status: 201 }
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  // 1. Enforce authentication
  const { auth, errorResponse } = await requireAuth(request);
  if (errorResponse) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const requestedTenantId = searchParams.get("tenantId") || undefined;

  const isSuperAdmin = auth!.user.role === "admin";
  if (requestedTenantId && !isSuperAdmin && requestedTenantId !== auth!.user.id) {
    return NextResponse.json(
      { error: "Forbidden: Cannot list documents belonging to another tenant" },
      { status: 403 }
    );
  }

  const effectiveTenantId = isSuperAdmin ? requestedTenantId : auth!.user.id;

  if (isSupabaseConfigured) {
    try {
      let queryBuilder = supabase
        .from("sutradb_knowledge")
        .select("*")
        .order("created_at", { ascending: false });

      if (effectiveTenantId) {
        queryBuilder = queryBuilder.eq("tenant_id", effectiveTenantId);
      }

      const { data, error } = await queryBuilder;
      if (!error && data) {
        return NextResponse.json({
          totalDocuments: data.length,
          documents: data,
        });
      }
    } catch {
      // Fallback
    }
  }

  // Fallback to presets if Supabase not configured
  return NextResponse.json({
    totalDocuments: DEFAULT_KNOWLEDGE_PRESETS.length,
    documents: DEFAULT_KNOWLEDGE_PRESETS,
  });
}
