/**
 * VaniEdge-Pro Telephony Platform
 * Universal Production Request Body Parser
 * 
 * Safely extracts parameters from urlencoded forms (Twilio),
 * multipart form-data, and JSON payloads with graceful fallbacks.
 */

import { NextRequest } from "next/server";

export async function parseTelephonyRequestBody(req: NextRequest): Promise<Record<string, string>> {
  const bodyParams: Record<string, string> = {};
  const contentType = req.headers.get("content-type") || "";

  if (
    contentType.includes("application/x-www-form-urlencoded") ||
    contentType.includes("multipart/form-data")
  ) {
    try {
      const formData = await req.formData();
      for (const [key, value] of formData.entries()) {
        bodyParams[key] = String(value);
      }
      return bodyParams;
    } catch {
      // fallback to url search params / text if formData throws
    }
  }

  if (contentType.includes("application/json")) {
    try {
      const json = (await req.json()) as Record<string, unknown>;
      if (json && typeof json === "object") {
        for (const [k, v] of Object.entries(json)) {
          bodyParams[k] = String(v);
        }
      }
      return bodyParams;
    } catch {
      return bodyParams;
    }
  }

  // Fallback: attempt formData, then json, then text
  try {
    const formData = await req.formData();
    for (const [key, value] of formData.entries()) {
      bodyParams[key] = String(value);
    }
    if (Object.keys(bodyParams).length > 0) return bodyParams;
  } catch {
    // continue
  }

  try {
    const json = (await req.json()) as Record<string, unknown>;
    if (json && typeof json === "object") {
      for (const [k, v] of Object.entries(json)) {
        bodyParams[k] = String(v);
      }
    }
  } catch {
    // continue
  }

  return bodyParams;
}
