import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/geocode
 * Server-side geocoding for arbitrary address strings.
 *
 * Resolution order:
 *   1. If a `postcode` is provided, try postcodes.io (UK only — high accuracy).
 *   2. If that fails (or no postcode), fall back to OpenStreetMap Nominatim
 *      for full-address geocoding. Works worldwide, no API key required.
 *      Rate-limited to ~1 req/sec by Nominatim's usage policy — fine for
 *      our admin use case (one geocode per address edit).
 *   3. If both fail, return 404.
 *
 * Request body:
 *   { address?: string, postcode?: string }
 *
 * Response (200):
 *   { latitude: number, longitude: number, source: 'postcodes.io' | 'nominatim' }
 *
 * Response (404):
 *   { error: 'Could not geocode the provided address/postcode' }
 */
export async function POST(request: NextRequest) {
  try {
    const { address, postcode } = await request.json()

    if (!address && !postcode) {
      return NextResponse.json({ error: 'Address or postcode required' }, { status: 400 })
    }

    // ── 1. Try postcodes.io (UK postcodes only) ──────────────────────────
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

      // Outward-code autocomplete fallback (e.g. user typed "SE13" only)
      const outwardCode = cleaned.match(/^[A-Z]{1,2}\d[A-Z\d]?/i)?.[0]
      if (outwardCode && outwardCode.length < cleaned.length) {
        const outRes = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(outwardCode)}/autocomplete`)
        if (outRes.ok) {
          const outData = await outRes.json()
          if (outData.status === 200 && outData.result && outData.result.length > 0) {
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

    // ── 2. OpenStreetMap Nominatim (full addresses, worldwide) ───────────
    // Free, no API key. Usage policy requires a descriptive User-Agent and
    // caps us at ~1 req/sec — perfectly fine for the admin editing the
    // store's own address occasionally.
    if (address && address.trim().length >= 5) {
      try {
        // Bias results toward the UK if the address doesn't already specify
        // a country — saves the user from appending "UK" manually.
        const q = address.trim()
        const viewbox = '-8.6,60.9,1.8,49.8' // UK bounding box (W,N,E,S)
        const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}&viewbox=${encodeURIComponent(viewbox)}&bounded=0&countrycodes=gb`
        const nomRes = await fetch(url, {
          headers: {
            // Nominatim usage policy requires a valid User-Agent identifying
            // the application. We use the store's domain when available.
            'User-Agent': 'UKStore/1.0 (admin store profile editor)',
            'Accept-Language': 'en-GB,en;q=0.9',
          },
        })
        if (nomRes.ok) {
          const nomData = await nomRes.json()
          if (Array.isArray(nomData) && nomData.length > 0) {
            const hit = nomData[0]
            const lat = parseFloat(hit.lat)
            const lon = parseFloat(hit.lon)
            if (!isNaN(lat) && !isNaN(lon)) {
              return NextResponse.json({
                latitude: lat,
                longitude: lon,
                source: 'nominatim',
                displayName: hit.display_name,
              })
            }
          }
        }
      } catch {
        // Nominatim failed — fall through to the 404 below.
      }
    }

    // ── 3. All geocoding attempts failed ─────────────────────────────────
    return NextResponse.json(
      { error: 'Could not geocode the provided address/postcode' },
      { status: 404 }
    )
  } catch (err) {
    console.error('[Geocode API]', err)
    return NextResponse.json({ error: 'Geocoding failed' }, { status: 500 })
  }
}
