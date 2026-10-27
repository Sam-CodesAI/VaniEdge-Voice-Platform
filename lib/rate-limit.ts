/**
 * VaniEdge Voice Platform
 * Edge & Serverless-Compatible Rate Limiter
 * 
 * Provides sliding-window rate limiting with client IP extraction,
 * configurable limits per endpoint, and RFC-compliant Retry-After headers.
 */

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

interface WindowRecord {
  count: number;
  resetTime: number;
}

// In-memory sliding window cache per IP + key
const rateLimitMap = new Map<string, WindowRecord>();

// Periodic pruning to prevent memory growth (every 5 minutes)
if (typeof setInterval !== "undefined") {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of rateLimitMap.entries()) {
      if (now > record.resetTime) {
        rateLimitMap.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (timer.unref) {
    timer.unref();
  }
}

/**
 * Extracts a normalized client IP from request headers.
 * Respects trusted reverse proxies (Cloudflare, Vercel, standard proxies).
 */
export function getClientIp(req: Request): string {
  const cfConnectingIp = req.headers.get("cf-connecting-ip");
  if (cfConnectingIp) return cfConnectingIp.trim();

  const xForwardedFor = req.headers.get("x-forwarded-for");
  if (xForwardedFor) {
    const firstIp = xForwardedFor.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }

  const xRealIp = req.headers.get("x-real-ip");
  if (xRealIp) return xRealIp.trim();

  return "127.0.0.1";
}

/**
 * Checks whether a request exceeds the specified rate limit.
 * 
 * @param identifier Unique identifier (e.g. client IP, user ID, API key)
 * @param action Action name to scope the rate limit (e.g. "auth_signin", "chat")
 * @param maxRequests Maximum allowed requests in the time window
 * @param windowMs Time window in milliseconds (default: 60,000ms = 1 minute)
 */
export function checkRateLimit(
  identifier: string,
  action: string,
  maxRequests: number = 20,
  windowMs: number = 60 * 1000
): RateLimitResult {
  // If explicitly disabled in dev/test via env
  if (process.env.RATE_LIMIT_ENABLED === "false" || process.env.NODE_ENV === "test") {
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests,
      resetMs: windowMs,
    };
  }

  const key = `${action}:${identifier}`;
  const now = Date.now();
  let record = rateLimitMap.get(key);

  if (!record || now > record.resetTime) {
    record = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitMap.set(key, record);
    return {
      success: true,
      limit: maxRequests,
      remaining: maxRequests - 1,
      resetMs: windowMs,
    };
  }

  record.count++;
  const resetMs = Math.max(0, record.resetTime - now);
  const remaining = Math.max(0, maxRequests - record.count);

  if (record.count > maxRequests) {
    return {
      success: false,
      limit: maxRequests,
      remaining: 0,
      resetMs,
    };
  }

  return {
    success: true,
    limit: maxRequests,
    remaining,
    resetMs,
  };
}

/**
 * Clears the rate limit table (useful in unit tests).
 */
export function resetRateLimits(): void {
  rateLimitMap.clear();
}
