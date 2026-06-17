import { ImageResponse } from 'next/og'
import { getPrisma } from '@/lib/auth/prisma'

export const size = { width: 32, height: 32 }
export const contentType = 'image/png'
export const runtime = 'nodejs'

/**
 * Dynamic favicon — renders the store's uploaded logo (if any) onto a 32x32 canvas,
 * otherwise renders a green gradient with the first letter of the store name.
 *
 * Next.js App Router: a file at `app/icon.tsx` is automatically used as the favicon.
 *
 * Uses `nodejs` runtime (not `edge`) because we need Prisma access. This means
 * the favicon is generated on first request and cached by Next.js.
 */
export default async function Icon() {
  let storeName = 'F'
  let logoUrl: string | null = null

  try {
    const prisma = await getPrisma()
    const store = await prisma.store.findFirst({ where: { isActive: true } })
    if (store?.name) storeName = store.name.charAt(0).toUpperCase()
    if (store?.logoUrl) logoUrl = store.logoUrl
  } catch {
    // DB unreachable — fall back to default
  }

  if (logoUrl) {
    // For data URLs and remote URLs, render the image inside a framed container
    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'white',
            fontSize: 0,
          }}
        >
          <img
            src={logoUrl}
            alt=""
            style={{ width: 28, height: 28, objectFit: 'contain' }}
          />
        </div>
      ),
      { ...size }
    )
  }

  // Letter-mark fallback
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #10b981 0%, #16a34a 100%)',
          color: 'white',
          fontSize: 22,
          fontWeight: 800,
          fontFamily: 'system-ui, sans-serif',
          borderRadius: 6,
        }}
      >
        {storeName}
      </div>
    ),
    { ...size }
  )
}
