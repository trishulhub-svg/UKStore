'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { Store, Mail, Lock, Eye, EyeOff, User, ArrowLeft, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'
import { authLogin, authRegister } from '@/lib/auth-client'

type AuthView = 'login' | 'register' | 'forgot-password' | 'success'

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
      const { error: authError } = await authLogin(email, password)

      if (authError) {
        setError(authError)
        return
      }

      handleClose()
      window.location.href = redirectTo
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

  // ─── REGISTER ───────────────────────────────────────────────────
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

      // Registration successful - user is auto-logged in
      handleClose()
      window.location.href = redirectTo
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
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Sign in with email</span>
                  </div>
                </div>

                <form onSubmit={handleLogin} className="space-y-4">
                  <ErrorAlert error={error} />

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
                <div className="relative">
                  <div className="absolute inset-0 flex items-center"><Separator className="w-full" /></div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-gray-500">Register with email</span>
                  </div>
                </div>

                <form onSubmit={handleRegister} className="space-y-4">
                  <ErrorAlert error={error} />

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
                <div className="text-center py-6 text-gray-500 text-sm">
                  <p>Password reset requires an email service to be configured.</p>
                  <p className="mt-2">Please contact the store owner or create a new account.</p>
                </div>
              </CardContent>
              <CardFooter className="justify-center pb-6">
                <button type="button" onClick={() => switchView('login')} className="text-sm text-[#16a34a] font-medium hover:underline flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Back to Sign In
                </button>
              </CardFooter>
            </>
          )}

          {/* ─── SUCCESS VIEW ──────────────────────────── */}
          {view === 'success' && (
            <>
              <CardHeader className="text-center pb-2">
                <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-[#16a34a]" />
                </div>
                <CardTitle className="text-2xl font-bold">Account Created!</CardTitle>
                <CardDescription className="mt-2">
                  Your account has been created successfully. You can now sign in.
                </CardDescription>
              </CardHeader>
              <CardFooter className="justify-center pb-6">
                <button type="button" onClick={() => switchView('login')} className="text-sm text-[#16a34a] font-medium hover:underline flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Go to Sign In
                </button>
              </CardFooter>
            </>
          )}
        </Card>
      </div>
    </div>
  )
}
