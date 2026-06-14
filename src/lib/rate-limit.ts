// ============================================================
// API Rate Limiting
// Simple in-memory rate limiter using a Map
// Tracks requests by IP address with configurable limits
// ============================================================

import { NextRequest, NextResponse } from 'next/server'

interface RateLimitEntry {
  count: number
  resetTime: number
}

// In-memory store: key = identifier (IP), value = rate limit entry
const rateLimitStore = new Map<string, RateLimitEntry>()

// Cleanup interval: remove expired entries every 60 seconds
const CLEANUP_INTERVAL = 60_000

let lastCleanup = Date.now()

/**
 * Clean up expired entries from the rate limit store.
 * Runs on every check, but only does full cleanup every 60s.
 */
function cleanupExpiredEntries() {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetTime) {
      rateLimitStore.delete(key)
    }
  }
}

/**
 * Check if a request is within rate limits.
 *
 * @param identifier - Usually the IP address
 * @param limit - Maximum number of requests allowed in the window
 * @param windowMs - Time window in milliseconds
 * @returns { allowed: boolean, remaining: number, resetTime: number }
 */
export function checkRateLimit(
  identifier: string,
  limit: number = 100,
  windowMs: number = 60_000
): { allowed: boolean; remaining: number; resetTime: number } {
  cleanupExpiredEntries()

  const now = Date.now()
  const entry = rateLimitStore.get(identifier)

  // No existing entry or expired window — start fresh
  if (!entry || now > entry.resetTime) {
    const resetTime = now + windowMs
    rateLimitStore.set(identifier, { count: 1, resetTime })
    return { allowed: true, remaining: limit - 1, resetTime }
  }

  // Within the current window — increment count
  if (entry.count >= limit) {
    return { allowed: false, remaining: 0, resetTime: entry.resetTime }
  }

  entry.count += 1
  return { allowed: true, remaining: limit - entry.count, resetTime: entry.resetTime }
}

/**
 * Extract the client IP from a Next.js request.
 * Handles proxied requests (X-Forwarded-For, X-Real-IP).
 */
export function getClientIp(request: NextRequest): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    return forwarded.split(',')[0].trim()
  }

  const realIp = request.headers.get('x-real-ip')
  if (realIp) {
    return realIp.trim()
  }

  // Fallback — in development this may be ::1 or 127.0.0.1
  return 'unknown'
}

/**
 * Pre-configured rate limit presets.
 */
export const RATE_LIMIT_PRESETS = {
  /** General API routes: 100 requests per minute */
  general: { limit: 100, windowMs: 60_000 },
  /** Auth endpoints: 10 requests per minute */
  auth: { limit: 10, windowMs: 60_000 },
  /** Checkout endpoint: 5 requests per minute */
  checkout: { limit: 5, windowMs: 60_000 },
} as const

/**
 * Higher-order function that wraps an API route handler with rate limiting.
 *
 * @example
 * ```ts
 * export const POST = withRateLimit(async (request) => {
 *   return NextResponse.json({ ok: true })
 * }, { limit: 10, windowMs: 60_000 })
 * ```
 *
 * Or use a preset:
 * ```ts
 * export const POST = withRateLimit(handler, RATE_LIMIT_PRESETS.auth)
 * ```
 */
export function withRateLimit(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options?: { limit?: number; windowMs?: number }
) {
  const limit = options?.limit ?? RATE_LIMIT_PRESETS.general.limit
  const windowMs = options?.windowMs ?? RATE_LIMIT_PRESETS.general.windowMs

  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    const ip = getClientIp(request)
    const result = checkRateLimit(ip, limit, windowMs)

    if (!result.allowed) {
      const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000)
      return NextResponse.json(
        {
          error: 'Too many requests. Please try again later.',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter,
        },
        {
          status: 429,
          headers: {
            'Retry-After': String(retryAfter),
            'X-RateLimit-Limit': String(limit),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
          },
        }
      )
    }

    const response = await handler(request, context)

    // Add rate limit headers to successful responses
    if (response instanceof NextResponse) {
      response.headers.set('X-RateLimit-Limit', String(limit))
      response.headers.set('X-RateLimit-Remaining', String(result.remaining))
      response.headers.set('X-RateLimit-Reset', String(Math.ceil(result.resetTime / 1000)))
    }

    return response
  }
}
