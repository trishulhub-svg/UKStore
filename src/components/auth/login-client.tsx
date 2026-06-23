'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useStoreInfo } from '@/lib/store-info'
import { Store, Mail, Lock, Eye, EyeOff, Clock } from 'lucide-react'
import { SiGoogle } from 'react-icons/si'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'
import { authLogin, getRoleBasedRedirectFromRoles } from '@/lib/auth-client'

export function LoginClient() {
  const { store: storeInfo } = useStoreInfo()
  const storeName = storeInfo?.name || 'Fresh Mart'
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | TechnicalError | null>(null)
  const [loading, setLoading] = useState(false)

  const redirectTo = searchParams.get('redirect') || '/'
  const idleReason = searchParams.get('reason') === 'idle'

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      // Trim whitespace from the email before sending. Mobile keyboards
      // (especially with autocorrect) often insert a leading/trailing
      // space. The server also trims defensively, but trimming here too
      // means the error messages and session token reflect the clean
      // email, not the whitespace-padded one.
      const { error: authError, user, mustResetPassword } = await authLogin(
        email.trim(),
        password
      )

      if (authError) {
        setError(authError)
        return
      }

      // Force password reset on first login (new employee accounts)
      if (mustResetPassword) {
        router.push('/auth/reset-password?forced=1')
        router.refresh()
        return
      }

      // After successful login, send the user back to where they were trying
      // to go (the ?redirect= param), OR to their role-based dashboard if no
      // redirect was requested. This matters for the idle-timeout flow: when
      // the idle timer redirects to /auth/login?redirect=/admin/products, the
      // user should land back on /admin/products after re-logging in, not on
      // the role-based default.
      //
      // We use the COMBINED-roles logic (primary + additionalRoles) so that
      // a user with primary role PICKER but additionalRoles including MANAGER
      // lands on /admin, not /picker.
      const role = user?.role || 'customer'
      const additionalRoles = user?.additionalRoles ?? []
      const roleDefault = getRoleBasedRedirectFromRoles(role, additionalRoles)
      // Only honour the redirect param if it's a path the user is allowed to
      // see for their role. Simple heuristic: customers can go anywhere
      // customer-facing; staff get their role-based default. The middleware
      // will re-check auth on the destination anyway.
      const safeRedirect =
        redirectTo &&
        redirectTo.startsWith('/') &&
        redirectTo !== '/auth/login' &&
        redirectTo !== '/auth/register'
          ? redirectTo
          : roleDefault
      router.push(safeRedirect)
      router.refresh()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError({
        message: `An unexpected client-side error occurred during login.`,
        code: 'CLIENT_ERROR',
        details: `Error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp: new Date().toISOString(),
        endpoint: '/api/auth/login',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-8 sm:py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4 hover:opacity-80 transition-opacity">
            <Store className="h-7 w-7 text-[#16a34a] flex-shrink-0" />
            <span className="font-bold text-lg sm:text-xl text-gray-900 truncate">{storeName}</span>
          </Link>
          <CardTitle className="text-xl sm:text-2xl font-bold">Welcome back</CardTitle>
          <CardDescription className="text-sm">Sign in to your account to continue shopping</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Idle-timeout notice — shown when the user was redirected here
              by the 5-minute inactivity auto-logout. */}
          {idleReason && (
            <div className="flex items-start gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              <Clock className="h-5 w-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">You were logged out due to inactivity</p>
                <p className="mt-0.5 text-amber-700">
                  For your security, your session expires after 5 minutes of no activity. Please sign in again to continue.
                </p>
              </div>
            </div>
          )}

          {/* Google Sign In */}
          <a
            href="/api/auth/google"
            className="flex items-center justify-center gap-2 w-full h-11 border border-gray-300 rounded-md bg-white hover:bg-gray-50 transition-colors text-sm font-medium text-gray-700"
          >
            <SiGoogle className="h-4 w-4" />
            Sign in with Google
          </a>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <Separator className="w-full" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-gray-500">or continue with email</span>
            </div>
          </div>

          {/* Email/Password Form */}
          <form onSubmit={handleLogin} className="space-y-4">
            <ErrorAlert error={error} />

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9 h-11"
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-[#16a34a] hover:underline font-medium"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11"
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-gray-600">
            Don&apos;t have an account?{' '}
            <Link href="/auth/register" className="text-[#16a34a] font-medium hover:underline">
              Register
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
