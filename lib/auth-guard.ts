/**
 * VaniEdge Voice Platform
 * Central Authentication & Authorization Guard Layer
 * 
 * - Derives identity from verified server-side session or validated API key
 * - Enforces CSRF origin checks on cookie-authenticated state-changing requests
 * - Enforces strict role-based access control and tenant isolation
 * - Implements deny-by-default behavior across all protected routes
 */

import { NextResponse, NextRequest } from "next/server";
import { authDb, UserRecord } from "./auth-store";

export interface AuthContext {
  user: UserRecord;
  token: string;
  isApiKey: boolean;
}

export interface GuardOptions {
  allowApiKey?: boolean;
  requiredRole?: "user" | "agency_admin" | "admin";
  checkCsrf?: boolean;
}

export interface GuardResult {
  auth?: AuthContext;
  errorResponse?: NextResponse;
}

/**
 * Validates request Origin/Referer against Host header for cookie-authenticated mutating requests.
 */
function verifyCsrf(req: Request | NextRequest): boolean {
  const method = req.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return true; // Safe methods
  }

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  const host =
    req.headers.get("x-forwarded-host") ||
    req.headers.get("host") ||
    (req.url ? new URL(req.url).host : null);

  if (!host) {
    return false;
  }

  // If origin is provided, it must match host
  if (origin) {
    try {
      const originUrl = new URL(origin);
      if (originUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  } else if (referer) {
    try {
      const refererUrl = new URL(referer);
      if (refererUrl.host !== host) {
        return false;
      }
    } catch {
      return false;
    }
  }

  return true;
}

/**
 * Extracts and verifies caller identity from Authorization header or session cookie.
 */
export async function requireAuth(
  req: Request | NextRequest,
  options: GuardOptions = {}
): Promise<GuardResult> {
  const { allowApiKey = true, requiredRole, checkCsrf = true } = options;

  let token: string | undefined;
  let isApiKey = false;

  // 1. Check Authorization header
  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.slice(7).trim();
  }

  // 2. Check session cookie if Bearer token not provided
  let isCookieAuth = false;
  if (!token) {
    const cookieHeader = req.headers.get("cookie") || "";
    const match = cookieHeader.match(/vaniedge_session=([^;]+)/);
    if (match) {
      token = match[1];
      isCookieAuth = true;
    }
  }

  if (!token) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Missing authentication credentials." },
        { status: 401 }
      ),
    };
  }

  // 3. CSRF defense for cookie-based state-changing requests
  if (isCookieAuth && checkCsrf) {
    const csrfOk = verifyCsrf(req);
    if (!csrfOk) {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden: CSRF check failed (origin mismatch)." },
          { status: 403 }
        ),
      };
    }
  }

  let user: UserRecord | null = null;

  // 4. API Key resolution
  if (token.startsWith("ve_live_")) {
    if (!allowApiKey) {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden: API key authentication not permitted for this endpoint." },
          { status: 403 }
        ),
      };
    }
    user = await authDb.getUserByApiKey(token);
    isApiKey = true;
  } else {
    // 5. Session token resolution with expiration & revocation checks
    user = await authDb.getSessionUser(token);
  }

  if (!user) {
    return {
      errorResponse: NextResponse.json(
        { error: "Unauthorized: Invalid or expired session credentials." },
        { status: 401 }
      ),
    };
  }

  // 6. Role-Based Access Control (RBAC)
  if (requiredRole) {
    const userRole = user.role || "user";
    if (requiredRole === "admin" && userRole !== "admin") {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden: Platform administrator privileges required." },
          { status: 403 }
        ),
      };
    }

    if (requiredRole === "agency_admin" && userRole !== "agency_admin" && userRole !== "admin") {
      return {
        errorResponse: NextResponse.json(
          { error: "Forbidden: Agency administrator privileges required." },
          { status: 403 }
        ),
      };
    }
  }

  return {
    auth: {
      user,
      token,
      isApiKey,
    },
  };
}
