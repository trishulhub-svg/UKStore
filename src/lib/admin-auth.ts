// ============================================================
// Admin API auth helper
// Checks that the requesting user has OWNER or MANAGER role
// ============================================================

import { getServerUser } from '@/lib/auth/server'
import { NextResponse } from 'next/server'

export async function requireAdmin() {
  const user = await getServerUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      ),
      user: null,
    }
  }

  const role = user.role.toUpperCase()
  if (role !== 'OWNER' && role !== 'MANAGER') {
    return {
      error: NextResponse.json(
        { error: 'Forbidden — owner or manager role required' },
        { status: 403 }
      ),
      user: null,
    }
  }

  return { error: null, user }
}
