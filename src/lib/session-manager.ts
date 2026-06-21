// ============================================================
// Session / Device-Limit Helpers
//
// Used by the login route to enforce device-login caps:
//   - OWNER (admin): 1 device maximum — new login revokes all prior sessions
//   - DRIVER / PICKER (employees): 2 devices max — 1 mobile + 1 desktop
//   - CUSTOMER: unlimited (sessions are still recorded but not capped)
// ============================================================

import { getPrisma } from '@/lib/auth/prisma'
import { hashSessionToken } from '@/lib/auth'

export type DeviceType = 'mobile' | 'desktop' | 'tablet' | 'unknown'

export interface DeviceInfo {
  deviceType: DeviceType
  deviceName: string
  userAgent: string
  ipAddress: string | null
}

/**
 * Parse a User-Agent string into a device type and human-readable name.
 *
 * Examples:
 *   - "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/..."
 *     → { deviceType: 'mobile', deviceName: 'Safari on iPhone' }
 *   - "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/..."
 *     → { deviceType: 'desktop', deviceName: 'Chrome on Windows' }
 */
export function parseUserAgent(userAgent: string | null | undefined): {
  deviceType: DeviceType
  deviceName: string
} {
  const ua = (userAgent || '').toLowerCase()
  let deviceType: DeviceType = 'unknown'
  let browser = 'Browser'
  let os = 'Device'

  // Detect device type
  if (/ipad|tablet|playbook|silk/.test(ua)) {
    deviceType = 'tablet'
  } else if (/mobile|iphone|ipod|android.*mobile|windows phone|blackberry|opera mini/.test(ua)) {
    deviceType = 'mobile'
  } else if (/windows|macintosh|linux|cros/.test(ua)) {
    deviceType = 'desktop'
  }

  // Detect browser
  if (/edg\//.test(ua)) browser = 'Edge'
  else if (/opr\/|opera/.test(ua)) browser = 'Opera'
  else if (/chrome|crios/.test(ua)) browser = 'Chrome'
  else if (/firefox|fxios/.test(ua)) browser = 'Firefox'
  else if (/safari/.test(ua)) browser = 'Safari'

  // Detect OS
  if (/windows/.test(ua)) os = 'Windows'
  else if (/mac os|macintosh/.test(ua)) os = 'macOS'
  else if (/iphone|ipad|ipod/.test(ua)) os = 'iOS'
  else if (/android/.test(ua)) os = 'Android'
  else if (/linux/.test(ua)) os = 'Linux'
  else if (/cros/.test(ua)) os = 'ChromeOS'

  const deviceName = `${browser} on ${os}`
  return { deviceType, deviceName }
}

/**
 * Get the client IP address from a Next.js request, respecting X-Forwarded-For.
 */
export function getClientIp(request: { headers: Headers }): string | null {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  const real = request.headers.get('x-real-ip')
  if (real) return real.trim()
  return null
}

// ─── Device-Limit Logic ──────────────────────────────────────

export interface DeviceLimitResult {
  allowed: boolean
  /** The list of session IDs that were revoked as part of enforcing the limit (for owner replacement or same-type replacement). */
  revokedSessionIds: string[]
  /** Reason for rejection if `allowed` is false. */
  reason?: string
  /** Existing active sessions for this user (after revocation). */
  remainingSessions: { id: string; deviceType: string }[]
}

/**
 * Enforce device-login limits for a user before creating a new session.
 *
 * Behavior:
 *   - CUSTOMER: no limit (always allowed)
 *   - OWNER: max 1 device — revoke all prior sessions
 *   - DRIVER/PICKER: max 2 devices, 1 mobile + 1 desktop
 *     - If a prior session of the same deviceType exists → revoke it (replace)
 *     - If 2 sessions exist and new deviceType differs from both → reject
 *
 * Returns `{ allowed: true }` if the new login can proceed (any necessary
 * revocations have been performed). Returns `{ allowed: false, reason }`
 * if the login must be rejected.
 *
 * Caller must still CREATE the new Session row after this returns allowed.
 */
export async function enforceDeviceLimit(
  userId: string,
  userRole: string,
  newDeviceType: DeviceType
): Promise<DeviceLimitResult> {
  const role = (userRole || '').toUpperCase()
  const prisma = await getPrisma()

  // Clean up expired sessions for this user (housekeeping)
  const now = new Date()
  try {
    await prisma.session.deleteMany({
      where: { userId, expiresAt: { lt: now } },
    })
  } catch (err) {
    console.warn('[Sessions] Failed to clean up expired sessions:', err)
  }

  // CUSTOMER: no limit
  if (role === 'CUSTOMER') {
    const remaining = await prisma.session.findMany({
      where: { userId },
      select: { id: true, deviceType: true },
    })
    return { allowed: true, revokedSessionIds: [], remainingSessions: remaining }
  }

  // Fetch all active sessions for this user
  const existingSessions = await prisma.session.findMany({
    where: { userId },
    select: { id: true, deviceType: true, createdAt: true },
    orderBy: { createdAt: 'asc' }, // oldest first
  })

  // OWNER: max 1 device — revoke all prior
  if (role === 'OWNER') {
    if (existingSessions.length === 0) {
      return { allowed: true, revokedSessionIds: [], remainingSessions: [] }
    }
    const revokedIds = existingSessions.map((s) => s.id)
    await prisma.session.deleteMany({ where: { id: { in: revokedIds } } })
    return {
      allowed: true,
      revokedSessionIds: revokedIds,
      remainingSessions: [],
    }
  }

  // DRIVER / PICKER: max 2 devices, 1 mobile + 1 desktop
  // (We treat 'tablet' as 'mobile' for limit purposes — employees typically
  // use tablets as mobile devices.)
  const normalizeType = (t: string): 'mobile' | 'desktop' => {
    if (t === 'desktop') return 'desktop'
    return 'mobile' // mobile, tablet, unknown all count as mobile
  }
  const newTypeNorm = normalizeType(newDeviceType)

  // Find existing session of the same normalized type
  const sameTypeSession = existingSessions.find(
    (s) => normalizeType(s.deviceType) === newTypeNorm
  )

  // Find sessions of the opposite type
  const oppositeTypeSessions = existingSessions.filter(
    (s) => normalizeType(s.deviceType) !== newTypeNorm
  )

  if (sameTypeSession) {
    // Replace: revoke the same-type session
    await prisma.session.delete({ where: { id: sameTypeSession.id } })
    return {
      allowed: true,
      revokedSessionIds: [sameTypeSession.id],
      remainingSessions: oppositeTypeSessions,
    }
  }

  // No same-type session. Check if there's room for a new type.
  // Max 2 sessions: 1 mobile + 1 desktop. If we have 1 opposite-type session,
  // we can add the new one (becomes 2 total). If we already have 2 opposite-type
  // sessions, that means both slots are used by the opposite type — reject.
  if (oppositeTypeSessions.length >= 2) {
    return {
      allowed: false,
      revokedSessionIds: [],
      remainingSessions: existingSessions,
      reason: `Device limit reached. Employees can be logged in on 1 mobile and 1 desktop device. You already have 2 active ${oppositeTypeSessions[0].deviceType} sessions. Please log out from one of them first.`,
    }
  }

  // There's room — proceed
  return {
    allowed: true,
    revokedSessionIds: [],
    remainingSessions: existingSessions,
  }
}

/**
 * Create a new session row in the database.
 * Returns the session ID (sid) to embed in the JWT.
 */
export async function createSession(
  userId: string,
  token: string,
  deviceInfo: DeviceInfo
): Promise<string> {
  const prisma = await getPrisma()
  const tokenHash = hashSessionToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const session = await prisma.session.create({
    data: {
      userId,
      tokenHash,
      deviceType: deviceInfo.deviceType,
      deviceName: deviceInfo.deviceName,
      userAgent: deviceInfo.userAgent,
      ipAddress: deviceInfo.ipAddress,
      expiresAt,
    },
  })

  return session.id
}

/**
 * Delete a session by its ID (revoke).
 * Returns true if a session was deleted.
 */
export async function revokeSession(sessionId: string): Promise<boolean> {
  const prisma = await getPrisma()
  const result = await prisma.session.deleteMany({ where: { id: sessionId } })
  return result.count > 0
}

/**
 * Delete all sessions for a user (revoke all).
 * Returns the number of sessions revoked.
 */
export async function revokeAllUserSessions(userId: string): Promise<number> {
  const prisma = await getPrisma()
  const result = await prisma.session.deleteMany({ where: { userId } })
  return result.count
}

/**
 * Delete a session by the token (used on logout).
 */
export async function revokeSessionByToken(token: string): Promise<void> {
  const prisma = await getPrisma()
  const tokenHash = hashSessionToken(token)
  try {
    await prisma.session.deleteMany({ where: { tokenHash } })
  } catch (err) {
    console.warn('[Sessions] Failed to delete session by token:', err)
  }
}

/**
 * List all active sessions for a user (newest first).
 */
export async function listUserSessions(userId: string) {
  const prisma = await getPrisma()
  // Clean up expired sessions first
  try {
    await prisma.session.deleteMany({
      where: { userId, expiresAt: { lt: new Date() } },
    })
  } catch {
    // Non-critical
  }
  return prisma.session.findMany({
    where: { userId },
    select: {
      id: true,
      deviceType: true,
      deviceName: true,
      ipAddress: true,
      createdAt: true,
      lastSeenAt: true,
      expiresAt: true,
      userId: true,
    },
    orderBy: { lastSeenAt: 'desc' },
  })
}
