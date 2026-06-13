'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Store, Mail, Lock, Eye, EyeOff, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'
import { authRegister } from '@/lib/auth-client'

export function RegisterClient() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | TechnicalError | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    // Client-side validation
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
      const { error: authError, user } = await authRegister(email, password, fullName)

      if (authError) {
        setError(authError)
        return
      }

      // If registration succeeded and we have a user, we're automatically logged in
      if (user) {
        // Redirect to home since we're auto-logged in
        router.push('/')
        router.refresh()
        return
      }

      setSuccess(true)
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

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 rounded-full bg-[#16a34a]/10 flex items-center justify-center mb-4">
              <Mail className="h-6 w-6 text-[#16a34a]" />
            </div>
            <CardTitle className="text-2xl font-bold">Account Created!</CardTitle>
            <CardDescription className="mt-2">
              Your account has been created successfully. You can now sign in with your credentials.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/auth/login">
              <Button variant="outline" className="mt-2">
                Go to Login
              </Button>
            </Link>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-12">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <Link href="/" className="flex items-center justify-center gap-2 mb-4 hover:opacity-80 transition-opacity">
            <Store className="h-7 w-7 text-[#16a34a]" />
            <span className="font-bold text-xl text-gray-900">Fresh Mart</span>
          </Link>
          <CardTitle className="text-2xl font-bold">Create an Account</CardTitle>
          <CardDescription>Register to start ordering fresh groceries</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <ErrorAlert error={error} />

            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Smith"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9 h-11"
                  required
                  autoComplete="name"
                />
              </div>
            </div>

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
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Minimum 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9 pr-10 h-11"
                  required
                  autoComplete="new-password"
                  minLength={8}
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

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="confirmPassword"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pl-9 h-11"
                  required
                  autoComplete="new-password"
                  minLength={8}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold"
              disabled={loading}
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <p className="text-sm text-gray-600">
            Already have an account?{' '}
            <Link href="/auth/login" className="text-[#16a34a] font-medium hover:underline">
              Login
            </Link>
          </p>
        </CardFooter>
      </Card>
    </div>
  )
}
