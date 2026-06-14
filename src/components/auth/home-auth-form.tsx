'use client'

import { useState, useCallback } from 'react'
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'
import { authLogin, authRegister } from '@/lib/auth-client'
import { getRoleBasedRedirect } from '@/lib/auth'

type AuthTab = 'login' | 'register' | 'forgot-password' | 'success'

interface HomeAuthFormProps {
  onSuccess?: () => void
}

export function HomeAuthForm({ onSuccess }: HomeAuthFormProps) {
  const [tab, setTab] = useState<AuthTab>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | TechnicalError | null>(null)
  const [loading, setLoading] = useState(false)

  const resetForm = useCallback(() => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setShowPassword(false)
    setError(null)
    setLoading(false)
  }, [])

  const switchTab = useCallback((newTab: AuthTab) => {
    resetForm()
    setTab(newTab)
  }, [resetForm])

  // ─── LOGIN ──────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const { user: authUser, error: authError } = await authLogin(email, password)

      if (authError) {
        setError(authError)
        return
      }

      // Role-based redirect: admin users go to /admin, drivers to /driver
      const role = authUser?.role || 'customer'
      const destination = getRoleBasedRedirect(role)
      onSuccess?.()
      window.location.href = destination
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError({
        message: 'An unexpected client-side error occurred during login.',
        code: 'CLIENT_ERROR',
        details: `Error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp: new Date().toISOString(),
        endpoint: '/api/auth/login',
      })
    } finally {
      setLoading(false)
    }
  }

  // ─── REGISTER ──────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError({
        message: 'Password must be at least 8 characters long.',
        code: 'PASSWORD_TOO_SHORT',
        details: `Provided password length: ${password.length}. Minimum required: 8.`,
        timestamp: new Date().toISOString(),
      })
      return
    }
    if (password !== confirmPassword) {
      setError({
        message: 'Passwords do not match.',
        code: 'PASSWORD_MISMATCH',
        details: 'The password and confirm password fields have different values.',
        timestamp: new Date().toISOString(),
      })
      return
    }

    setLoading(true)

    try {
      const { error: authError } = await authRegister(email, password, fullName)

      if (authError) {
        setError(authError)
        return
      }

      onSuccess?.()
      window.location.reload()
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError({
        message: 'An unexpected client-side error occurred during registration.',
        code: 'CLIENT_ERROR',
        details: `Error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp: new Date().toISOString(),
        endpoint: '/api/auth/register',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Tab Switcher — Login | Register */}
      {tab !== 'success' && tab !== 'forgot-password' && (
        <div className="flex border-b border-gray-100">
          <button
            type="button"
            onClick={() => switchTab('login')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              tab === 'login'
                ? 'text-[#16a34a] border-b-2 border-[#16a34a] bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => switchTab('register')}
            className={`flex-1 py-3.5 text-sm font-semibold transition-colors ${
              tab === 'register'
                ? 'text-[#16a34a] border-b-2 border-[#16a34a] bg-green-50/50'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
            }`}
          >
            Register
          </button>
        </div>
      )}

      <div className="p-5 sm:p-6">
        {/* ─── LOGIN TAB ─────────────────────────── */}
        {tab === 'login' && (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              <ErrorAlert error={error} compact />

              <div className="space-y-1.5">
                <Label htmlFor="hp-login-email" className="text-xs font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-10" required autoComplete="email" />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="hp-login-pw" className="text-xs font-medium">Password</Label>
                  <button type="button" onClick={() => switchTab('forgot-password')} className="text-[10px] text-[#16a34a] hover:underline font-medium">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-login-pw" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10 h-10" required autoComplete="current-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-10 font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : 'Sign In'}
              </Button>
            </form>
          </div>
        )}

        {/* ─── REGISTER TAB ──────────────────────── */}
        {tab === 'register' && (
          <div className="space-y-4">
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Register with email</span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-3">
              <ErrorAlert error={error} compact />

              <div className="space-y-1.5">
                <Label htmlFor="hp-reg-name" className="text-xs font-medium">Full Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-reg-name" type="text" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9 h-10" required autoComplete="name" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hp-reg-email" className="text-xs font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-10" required autoComplete="email" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hp-reg-pw" className="text-xs font-medium">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-reg-pw" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10 h-10" required autoComplete="new-password" minLength={8} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="hp-reg-confirm" className="text-xs font-medium">Confirm Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-reg-confirm" type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-9 h-10" required autoComplete="new-password" minLength={8} />
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-10 font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Account...</> : 'Create Account'}
              </Button>
            </form>

            <p className="text-[10px] text-gray-400 text-center">
              By registering you agree to our Terms of Service and Privacy Policy.
            </p>
          </div>
        )}

        {/* ─── FORGOT PASSWORD ──────────────────── */}
        {tab === 'forgot-password' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-3">
                <Lock className="h-6 w-6 text-[#16a34a]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
              <p className="text-sm text-gray-500 mt-1">Password reset requires email service configuration. Please contact the store owner or create a new account.</p>
            </div>

            <div className="text-center">
              <button type="button" onClick={() => switchTab('login')} className="text-xs text-[#16a34a] hover:underline font-medium flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> Back to Sign In
              </button>
            </div>
          </div>
        )}

        {/* ─── SUCCESS ─────────────────────────── */}
        {tab === 'success' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-[#16a34a]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Account Created!</h3>
              <p className="text-sm text-gray-500 mt-1">Your account has been created. You can now sign in.</p>
            </div>

            <div className="text-center">
              <button type="button" onClick={() => switchTab('login')} className="text-xs text-[#16a34a] hover:underline font-medium flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> Go to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
