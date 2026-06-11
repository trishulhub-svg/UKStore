'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Store, Mail, Lock, Eye, EyeOff, User, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { createClient } from '@/lib/supabase/client'

type AuthView = 'login' | 'register' | 'forgot-password' | 'otp-sent'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
  initialView?: AuthView
  redirectTo?: string
}

export function AuthModal({ isOpen, onClose, initialView = 'login', redirectTo = '/' }: AuthModalProps) {
  const [view, setView] = useState<AuthView>(initialView)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [otpCode, setOtpCode] = useState('')

  const resetForm = useCallback(() => {
    setEmail('')
    setPassword('')
    setConfirmPassword('')
    setFullName('')
    setShowPassword(false)
    setError(null)
    setLoading(false)
    setOtpCode('')
  }, [])

  const switchView = useCallback((newView: AuthView) => {
    resetForm()
    setView(newView)
  }, [resetForm])

  const handleClose = useCallback(() => {
    resetForm()
    setView('login')
    onClose()
  }, [resetForm, onClose])

  // ─── LOGIN ──────────────────────────────────────────────────────
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

      handleClose()
      window.location.href = redirectTo
    } catch (err) {
      // Network-level errors produce "Load failed" (Safari) or "Failed to fetch" (Chrome)
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Failed to fetch') || message.includes('Load failed') || message.includes('NetworkError')) {
        setError('Unable to connect to our authentication service. Please check your internet connection and try again. If the problem persists, the service may be temporarily unavailable.')
      } else if (message.includes('Missing required environment variable')) {
        setError('Server configuration error: authentication is not set up correctly. Please contact support.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── GOOGLE OAUTH ───────────────────────────────────────────────
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

  // ─── OTP LOGIN ──────────────────────────────────────────────────
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

      setView('otp-sent')
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.verifyOtp({
        email,
        token: otpCode,
        type: 'email',
      })

      if (authError) {
        setError(authError.message)
        return
      }

      handleClose()
      window.location.href = redirectTo
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ─── REGISTER ───────────────────────────────────────────────────
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
        options: {
          data: { full_name: fullName },
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      // Show OTP sent view for email verification
      setView('otp-sent')
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (message.includes('Failed to fetch') || message.includes('Load failed') || message.includes('NetworkError')) {
        setError('Unable to connect to our authentication service. Please check your internet connection and try again.')
      } else if (message.includes('Missing required environment variable')) {
        setError('Server configuration error: authentication is not set up correctly. Please contact support.')
      } else {
        setError('An unexpected error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  // ─── FORGOT PASSWORD ────────────────────────────────────────────
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

      setError(null)
      setLoading(false)
      // Show success message
      setView('otp-sent') // Reuse the sent view
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md mx-4 animate-in fade-in zoom-in-95 duration-200">
        <Card className="shadow-2xl border-0">
          {/* Close button */}
          <button
            onClick={handleClose}
            className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* ─── LOGIN VIEW ─────────────────────────────── */}
          {view === 'login' && (
            <>
              <CardHeader className="text-center pb-2">
                <Link href="/" className="flex items-center justify-center gap-2 mb-3 hover:opacity-80 transition-opacity" onClick={handleClose}>
                  <Store className="h-7 w-7 text-[#16a34a]" />
                  <span className="font-bold text-xl text-gray-900">Fresh Mart</span>
                </Link>
                <CardTitle className="text-2xl font-bold">Welcome back</CardTitle>
                <CardDescription>Sign in to your account to continue shopping</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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
                    <span className="bg-white px-2 text-gray-500">Or continue with email</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="login-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" required autoComplete="email" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button type="button" onClick={() => switchView('forgot-password')} className="text-xs text-[#16a34a] hover:underline font-medium">
                        Forgot password?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="login-password" type={showPassword ? 'text' : 'password'} placeholder="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10 h-11" required autoComplete="current-password" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in...</> : 'Sign In'}
                  </Button>
                </form>

                {/* OTP Option */}
                <div className="text-center">
                  <button type="button" onClick={() => switchView('otp-sent')} className="text-sm text-[#16a34a] hover:underline font-medium">
                    Sign in with a magic link instead
                  </button>
                </div>
              </CardContent>
              <CardFooter className="justify-center pb-6">
                <p className="text-sm text-gray-600">
                  Don&apos;t have an account?{' '}
                  <button type="button" onClick={() => switchView('register')} className="text-[#16a34a] font-medium hover:underline">
                    Register
                  </button>
                </p>
              </CardFooter>
            </>
          )}

          {/* ─── REGISTER VIEW ──────────────────────────── */}
          {view === 'register' && (
            <>
              <CardHeader className="text-center pb-2">
                <Link href="/" className="flex items-center justify-center gap-2 mb-3 hover:opacity-80 transition-opacity" onClick={handleClose}>
                  <Store className="h-7 w-7 text-[#16a34a]" />
                  <span className="font-bold text-xl text-gray-900">Fresh Mart</span>
                </Link>
                <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
                <CardDescription>Register to start ordering fresh groceries</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
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

                <form onSubmit={handleRegister} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="reg-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="reg-name" type="text" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} className="pl-9 h-11" required autoComplete="name" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="reg-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" required autoComplete="email" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="reg-password" type={showPassword ? 'text' : 'password'} placeholder="Minimum 8 characters" value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 pr-10 h-11" required autoComplete="new-password" minLength={8} />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="reg-confirm">Confirm Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="reg-confirm" type={showPassword ? 'text' : 'password'} placeholder="Repeat your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pl-9 h-11" required autoComplete="new-password" minLength={8} />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating Account...</> : 'Create Account'}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="justify-center pb-6">
                <p className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <button type="button" onClick={() => switchView('login')} className="text-[#16a34a] font-medium hover:underline">
                    Sign In
                  </button>
                </p>
              </CardFooter>
            </>
          )}

          {/* ─── OTP / MAGIC LINK VIEW ─────────────────── */}
          {view === 'otp-sent' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-[#16a34a]" />
                </div>
                <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
                <CardDescription className="mt-2">
                  {email ? (
                    <>We&apos;ve sent a magic link to <strong>{email}</strong>. Click the link to sign in — no password needed.</>
                  ) : (
                    <>Enter your email below and we&apos;ll send you a magic link to sign in instantly.</>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSendOtp} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
                  )}

                  {!email && (
                    <div className="space-y-2">
                      <Label htmlFor="otp-email">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <Input id="otp-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" required autoComplete="email" />
                      </div>
                    </div>
                  )}

                  <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : email ? 'Resend Magic Link' : 'Send Magic Link'}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="justify-center pb-6">
                <button type="button" onClick={() => switchView('login')} className="text-sm text-[#16a34a] font-medium hover:underline flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </CardFooter>
            </>
          )}

          {/* ─── FORGOT PASSWORD VIEW ──────────────────── */}
          {view === 'forgot-password' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-4">
                  <Lock className="h-6 w-6 text-[#16a34a]" />
                </div>
                <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
                <CardDescription>Enter your email and we&apos;ll send you a password reset link.</CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-4 py-3">{error}</div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="forgot-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <Input id="forgot-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" required autoComplete="email" />
                    </div>
                  </div>

                  <Button type="submit" className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold" disabled={loading}>
                    {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending...</> : 'Send Reset Link'}
                  </Button>
                </form>
              </CardContent>
              <CardFooter className="justify-center pb-6">
                <button type="button" onClick={() => switchView('login')} className="text-sm text-[#16a34a] font-medium hover:underline flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
