'use client'

import { useState, useCallback } from 'react'
import { AlertCircle, Copy, Check } from 'lucide-react'

export interface TechnicalError {
  /** Human-readable message shown prominently */
  message: string
  /** Machine-readable error code (e.g. AUTH_INVALID_CREDENTIALS) */
  code?: string
  /** HTTP status code */
  status?: number
  /** Technical details (e.g. stack trace, API response body) */
  details?: string
  /** Timestamp when the error occurred */
  timestamp?: string
  /** The endpoint or operation that failed */
  endpoint?: string
}

interface ErrorAlertProps {
  error: string | TechnicalError | null
  /** Optional className for the outer container */
  className?: string
  /** Compact mode — hides the expandable details section */
  compact?: boolean
}

/**
 * Parse a string or TechnicalError into a structured shape.
 */
function normalizeError(err: string | TechnicalError): TechnicalError {
  if (typeof err === 'string') {
    return { message: err }
  }
  return err
}

/**
 * Format a TechnicalError into a copyable plain-text block.
 */
function formatErrorForCopy(err: TechnicalError): string {
  const lines: string[] = []
  if (err.code) lines.push(`Code: ${err.code}`)
  if (err.status) lines.push(`Status: ${err.status}`)
  lines.push(`Message: ${err.message}`)
  if (err.endpoint) lines.push(`Endpoint: ${err.endpoint}`)
  if (err.timestamp) lines.push(`Time: ${err.timestamp}`)
  if (err.details) lines.push(`Details:\n${err.details}`)
  return lines.join('\n')
}

/**
 * Reusable error alert that shows technical error details with a copy button.
 * Used throughout the website for consistent, debuggable error display.
 */
export function ErrorAlert({ error, className = '', compact = false }: ErrorAlertProps) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  const err = error ? normalizeError(error) : null

  const handleCopy = useCallback(async () => {
    if (!err) return
    const text = formatErrorForCopy(err)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Fallback: create a temporary textarea
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.left = '-9999px'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [err])

  if (!err) return null

  const hasDetails = !compact && (err.code || err.status || err.details || err.endpoint || err.timestamp)
  const copyText = formatErrorForCopy(err)

  return (
    <div className={`bg-red-50 border border-red-200 rounded-md overflow-hidden ${className}`}>
      {/* Main error message row */}
      <div className="flex items-start gap-2.5 px-4 py-3">
        <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          {/* Error code badge */}
          {err.code && (
            <span className="inline-block bg-red-100 text-red-700 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded mr-2 mb-1">
              {err.code}
            </span>
          )}
          {/* Status badge */}
          {err.status && (
            <span className="inline-block bg-red-100 text-red-700 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded mr-2 mb-1">
              HTTP {err.status}
            </span>
          )}
          {/* Main message */}
          <p className="text-sm text-red-700 leading-snug">{err.message}</p>
        </div>
        {/* Copy button */}
        <button
          type="button"
          onClick={handleCopy}
          className="flex-shrink-0 p-1.5 rounded hover:bg-red-100 transition-colors text-red-400 hover:text-red-600"
          title="Copy error details"
        >
          {copied ? (
            <Check className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <Copy className="h-3.5 w-3.5" />
          )}
        </button>
      </div>

      {/* Expandable technical details */}
      {hasDetails && (
        <div className="border-t border-red-100">
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="w-full text-left px-4 py-1.5 text-[11px] text-red-500 hover:text-red-700 hover:bg-red-100/50 transition-colors font-medium"
          >
            {expanded ? 'Hide technical details' : 'Show technical details'}
          </button>
          {expanded && (
            <div className="px-4 pb-3">
              <pre className="bg-white border border-red-200 rounded p-3 text-[11px] font-mono text-red-800 whitespace-pre-wrap break-all overflow-x-auto max-h-60 overflow-y-auto">
                {copyText}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Helper to build a TechnicalError from an API error response or a caught error.
 */
export function buildTechnicalError(input: {
  message?: string
  code?: string
  status?: number
  details?: string
  endpoint?: string
  error?: unknown
}): TechnicalError {
  const timestamp = new Date().toISOString()

  let message = input.message || 'An unexpected error occurred.'
  let code = input.code
  let status = input.status
  let details = input.details || ''

  // If a raw error was passed, extract info from it
  if (input.error instanceof Error) {
    details = details
      ? `${details}\n\nError: ${input.error.message}\n${input.error.stack || ''}`
      : `Error: ${input.error.message}\n${input.error.stack || ''}`
    if (!code) code = 'UNHANDLED_EXCEPTION'
    if (!status) status = 500
  }

  return { message, code, status, details, timestamp, endpoint: input.endpoint }
}

/**
 * Helper to parse an API error response into a TechnicalError.
 */
export async function parseApiError(response: Response, endpoint: string): Promise<TechnicalError> {
  const timestamp = new Date().toISOString()
  const status = response.status

  let body: any
  try {
    body = await response.json()
  } catch {
    body = {}
  }

  // If the API already returned a structured technical error
  if (body.technicalError) {
    return {
      ...body.technicalError,
      timestamp: body.technicalError.timestamp || timestamp,
      endpoint: body.technicalError.endpoint || endpoint,
      status: body.technicalError.status || status,
    }
  }

  // Build from the simple error field
  const message = body.error || `Request failed with status ${status}`
  const code = body.code || `HTTP_${status}`
  const details = body.details || body.rawError || ''

  return { message, code, status, details, timestamp, endpoint }
}
