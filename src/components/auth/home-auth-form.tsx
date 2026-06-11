'use client'

import { useState, useCallback } from 'react'
import { Mail, Lock, Eye, EyeOff, User, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'

type AuthTab = 'login' | 'register' | 'forgot-password' | 'otp-sent'

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
  const [error, setError] = useState<string | null>(null)
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
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })

      if (authError) {
        setError(authError.message)
        return
      }

      onSuccess?.()
      window.location.reload()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── GOOGLE OAUTH ──────────────────────────────────────────
  const handleGoogleLogin = async () => {
    setError(null)
    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (authError) {
        setError(authError.message)
      }
    } catch {
      setError('An unexpected error occurred. Please try again.')
    }
  }

  // ─── REGISTER ──────────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      setTab('otp-sent')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── MAGIC LINK / OTP ─────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      setTab('otp-sent')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback`,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      setTab('otp-sent')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
      {/* Tab Switcher — Login | Register */}
      {tab !== 'otp-sent' && tab !== 'forgot-password' && (
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
            {/* Google OAuth */}
            <Button variant="outline" className="w-full h-11" onClick={handleGoogleLogin} type="button">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Continue with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or sign in with email</span>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2.5">{error}</div>
              )}

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

            <div className="text-center">
              <button type="button" onClick={() => switchTab('otp-sent')} className="text-xs text-[#16a34a] hover:underline font-medium">
                Sign in with a magic link instead
              </button>
            </div>
          </div>
        )}

        {/* ─── REGISTER TAB ──────────────────────── */}
        {tab === 'register' && (
          <div className="space-y-4">
            {/* Google OAuth */}
            <Button variant="outline" className="w-full h-11" onClick={handleGoogleLogin} type="button">
              <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign up with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-gray-500">Or register with email</span>
              </div>
            </div>

            <form onSubmit={handleRegister} className="space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2.5">{error}</div>
              )}

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

        {/* ─── OTP / MAGIC LINK ─────────────────── */}
        {tab === 'otp-sent' && (
          <div className="space-y-4">
            <div className="text-center">
              <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-3">
                <Mail className="h-6 w-6 text-[#16a34a]" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Check Your Email</h3>
              <p className="text-sm text-gray-500 mt-1">
                {email ? (
                  <>We&apos;ve sent a magic link to <strong>{email}</strong>. Click it to sign in — no password needed.</>
                ) : (
                  <>Enter your email and we&apos;ll send you a magic link to sign in instantly.</>
                )}
              </p>
            </div>

            <form onSubmit={handleSendOtp} className="space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2.5">{error}</div>
              )}

              {!email && (
                <div className="space-y-1.5">
                  <Label htmlFor="hp-otp-email" className="text-xs font-medium">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input id="hp-otp-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-10" required autoComplete="email" />
                  </div>
                </div>
              )}

              <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-10 font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : email ? 'Resend Magic Link' : 'Send Magic Link'}
              </Button>
            </form>

            <div className="text-center">
              <button type="button" onClick={() => switchTab('login')} className="text-xs text-[#16a34a] hover:underline font-medium flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> Back to Sign In
              </button>
            </div>
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
              <p className="text-sm text-gray-500 mt-1">Enter your email and we&apos;ll send you a reset link.</p>
            </div>

            <form onSubmit={handleForgotPassword} className="space-y-3">
              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2.5">{error}</div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="hp-forgot-email" className="text-xs font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input id="hp-forgot-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-10" required autoComplete="email" />
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-10 font-semibold" disabled={loading}>
                {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : 'Send Reset Link'}
              </Button>
            </form>

            <div className="text-center">
              <button type="button" onClick={() => switchTab('login')} className="text-xs text-[#16a34a] hover:underline font-medium flex items-center gap-1 mx-auto">
                <ArrowLeft className="h-3 w-3" /> Back to Sign In
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
