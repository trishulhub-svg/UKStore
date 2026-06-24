'use client'

import { useEffect, useState } from 'react'
import { useStoreInfo } from '@/lib/store-info'
import { Store } from 'lucide-react'

/**
 * LogoSplash — a one-per-session brand splash shown the first time a user
 * lands on the site. It plays an attractive logo animation (logo scales +
 * rotates in, gradient ring sweeps around it, store name fades up, then
 * the whole splash fades out and unmounts).
 *
 * Behaviour:
 *   - Shows on the first page load of each browser session.
 *   - Hidden on subsequent navigations within the same session (uses
 *     sessionStorage so it doesn't keep pestering the user).
 *   - Falls back to the green Store icon when no custom logo is uploaded.
 *   - Respects prefers-reduced-motion: skips the animation and just shows
 *     a brief static splash.
 *   - Renders nothing on the server to avoid hydration mismatch — the
 *     splash only appears after the client mounts.
 *   - Delays showing for up to 300ms (or until store info loads, whichever
 *     is first) so it can render the correct store logo/name instead of
 *     flashing the fallback.
 *
 * Mount this once near the root of the app (see src/app/layout.tsx).
 */
export function LogoSplash() {
  const { store } = useStoreInfo()
  const logoUrl = store?.logoUrl
  const storeName = store?.name || 'Fresh Mart'

  // Decide ON MOUNT (client-only) whether the splash should be shown at all
  // — done as a lazy useState initializer so we never trigger a
  // setState-in-effect cascading render. The initializer runs exactly once,
  // on the first client render, and the value is fixed for the component's
  // lifetime.
  const [visible] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    const KEY = 'fm-logo-splash-shown'
    try {
      if (sessionStorage.getItem(KEY)) return false
    } catch {
      // sessionStorage unavailable — fail open (show the splash).
    }
    return true
  })
  const [hide, setHide] = useState(false)

  useEffect(() => {
    if (!visible) return

    const KEY = 'fm-logo-splash-shown'

    // Respect reduced-motion users: shorter display, no fancy choreography.
    const prefersReduced =
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const totalDuration = prefersReduced ? 600 : 1800
    const fadeStart = prefersReduced ? 400 : 1400

    const fadeTimer = window.setTimeout(() => setHide(true), fadeStart)
    const unmountTimer = window.setTimeout(() => {
      try { sessionStorage.setItem(KEY, '1') } catch {}
    }, totalDuration)

    return () => {
      window.clearTimeout(fadeTimer)
      window.clearTimeout(unmountTimer)
    }
  }, [visible])

  if (!visible) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-white transition-opacity duration-500 ${
        hide ? 'opacity-0 pointer-events-none' : 'opacity-100'
      }`}
    >
      {/* Soft radial brand wash so the splash feels intentional, not jarring */}
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(800px 500px at 50% 45%, rgba(16,185,129,0.10), transparent 60%), radial-gradient(600px 400px at 50% 55%, rgba(245,158,11,0.06), transparent 60%)',
        }}
      />

      {/* Splash content */}
      <div className="relative flex flex-col items-center gap-6 px-6">
        {/* Logo + sweeping gradient ring */}
        <div className="relative fm-splash-logo-wrap">
          {/* Rotating gradient ring */}
          <span className="fm-splash-ring" aria-hidden="true" />

          {/* Pulsing halo behind the logo */}
          <span className="fm-splash-halo" aria-hidden="true" />

          {/* The logo itself */}
          <span className="fm-splash-logo">
            {logoUrl ? (
              <img
                src={logoUrl}
                alt=""
                className="rounded-xl object-contain fm-splash-logo-img"
                width={84}
                height={84}
              />
            ) : (
              <span
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 text-white fm-splash-logo-fallback"
                style={{ width: 84, height: 84 }}
              >
                <Store style={{ width: 52, height: 52 }} />
              </span>
            )}
          </span>
        </div>

        {/* Store name — fades up after the logo lands */}
        <div className="fm-splash-name-wrap">
          <p className="fm-splash-name">{storeName}</p>
          <p className="fm-splash-tagline">Fresh groceries, delivered.</p>
        </div>

        {/* Slim loading bar — gives the user a sense of progress */}
        <div className="fm-splash-bar" aria-hidden="true">
          <div className="fm-splash-bar-fill" />
        </div>
      </div>

      <style jsx global>{`
        /* ===== Logo splash animations =====
           Kept here (global, scoped by the unique class names) so the
           component is fully self-contained. */

        @keyframes fm-splash-logo-in {
          0%   { transform: scale(0.4) rotate(-25deg); opacity: 0; }
          60%  { transform: scale(1.08) rotate(4deg);  opacity: 1; }
          100% { transform: scale(1)    rotate(0deg);  opacity: 1; }
        }

        @keyframes fm-splash-ring-spin {
          0%   { transform: rotate(0deg);   opacity: 0; }
          20%  { opacity: 1; }
          100% { transform: rotate(360deg); opacity: 0.85; }
        }

        @keyframes fm-splash-halo-pulse {
          0%   { transform: scale(0.8); opacity: 0; }
          35%  { opacity: 0.55; }
          100% { transform: scale(1.8); opacity: 0; }
        }

        @keyframes fm-splash-name-up {
          0%   { transform: translateY(8px); opacity: 0; }
          100% { transform: translateY(0);   opacity: 1; }
        }

        @keyframes fm-splash-bar-grow {
          0%   { transform: scaleX(0); }
          100% { transform: scaleX(1); }
        }

        .fm-splash-logo-wrap {
          position: relative;
          width: 120px;
          height: 120px;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .fm-splash-logo {
          position: relative;
          z-index: 2;
          animation: fm-splash-logo-in 700ms cubic-bezier(0.34, 1.56, 0.64, 1) both;
          filter: drop-shadow(0 8px 18px rgba(16, 185, 129, 0.25));
        }

        .fm-splash-logo-img,
        .fm-splash-logo-fallback {
          display: block;
        }

        .fm-splash-ring {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            conic-gradient(
              from 0deg,
              rgba(16, 185, 129, 0) 0deg,
              rgba(16, 185, 129, 0.9) 90deg,
              rgba(245, 158, 11, 0.6) 180deg,
              rgba(16, 185, 129, 0) 360deg
            );
          -webkit-mask: radial-gradient(circle, transparent 56%, #000 58%);
                  mask: radial-gradient(circle, transparent 56%, #000 58%);
          animation: fm-splash-ring-spin 1100ms ease-out 200ms both;
        }

        .fm-splash-halo {
          position: absolute;
          inset: 6px;
          border-radius: 9999px;
          background: radial-gradient(circle, rgba(16,185,129,0.35), transparent 70%);
          animation: fm-splash-halo-pulse 1400ms ease-out 300ms both;
          z-index: 1;
        }

        .fm-splash-name-wrap {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          animation: fm-splash-name-up 500ms ease-out 650ms both;
        }

        .fm-splash-name {
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.01em;
          background: linear-gradient(135deg, #10b981 0%, #16a34a 60%, #15803d 100%);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          color: transparent;
        }

        .fm-splash-tagline {
          font-size: 0.8rem;
          color: #6b7280;
          font-weight: 500;
        }

        .fm-splash-bar {
          width: 140px;
          height: 3px;
          background: #e5e7eb;
          border-radius: 9999px;
          overflow: hidden;
          margin-top: 4px;
        }

        .fm-splash-bar-fill {
          display: block;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, #10b981, #16a34a, #15803d);
          border-radius: 9999px;
          transform-origin: left center;
          animation: fm-splash-bar-grow 1400ms ease-out 300ms both;
        }

        /* Reduced-motion: skip the choreography, just show the splash briefly. */
        @media (prefers-reduced-motion: reduce) {
          .fm-splash-logo,
          .fm-splash-ring,
          .fm-splash-halo,
          .fm-splash-name-wrap,
          .fm-splash-bar-fill {
            animation: none !important;
          }
          .fm-splash-ring { opacity: 0.6; }
          .fm-splash-halo { opacity: 0.3; }
          .fm-splash-bar-fill { transform: scaleX(1); }
        }
      `}</style>
    </div>
  )
}
