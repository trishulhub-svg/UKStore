import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/geocode
 * Server-side geocoding fallback when postcodes.io doesn't work.
 * Uses the store's Google Maps API key if configured.
 * Falls back to a basic UK postcode centroid lookup.
 */
export async function POST(request: NextRequest) {
  try {
    const { address, postcode } = await request.json()

    if (!address && !postcode) {
      return NextResponse.json({ error: 'Address or postcode required' }, { status: 400 })
    }

    // Try postcodes.io first (server-side, more reliable than client-side)
    if (postcode) {
      const cleaned = postcode.trim().replace(/\s+/g, '')
      const pcRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`)
      if (pcRes.ok) {
        const pcData = await pcRes.json()
        if (pcData.status === 200 && pcData.result) {
          return NextResponse.json({
            latitude: pcData.result.latitude,
            longitude: pcData.result.longitude,
            source: 'postcodes.io',
          })
        }
      }

      // If the full postcode lookup fails, try the outward code
      const outwardCode = cleaned.match(/^[A-Z]{1,2}\d[A-Z\d]?/i)?.[0]
      if (outwardCode && outwardCode.length < cleaned.length) {
        const outRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(outwardCode)}/autocomplete`)
        if (outRes.ok) {
          const outData = await outRes.json()
          if (outData.status === 200 && outData.result && outData.result.length > 0) {
            // Use the first matching postcode to get coordinates
            const firstMatch = outData.result[0]
            const matchRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(firstMatch)}`)
            if (matchRes.ok) {
              const matchData = await matchRes.json()
              if (matchData.status === 200 && matchData.result) {
                return NextResponse.json({
                  latitude: matchData.result.latitude,
                  longitude: matchData.result.longitude,
                  source: 'postcodes.io-outward',
                })
              }
            }
          }
        }
      }
    }

    // If postcodes.io fails entirely, return an error
    return NextResponse.json({ error: 'Could not geocode the provided address/postcode' }, { status: 404 })
  } catch (err) {
    console.error('[Geocode API]', err)
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
  }
}
