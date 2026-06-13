'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Store, Mail, ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ErrorAlert } from '@/components/ui/error-alert'
import type { TechnicalError } from '@/components/ui/error-alert'

export function ForgotPasswordClient() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | TechnicalError | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Password reset requires email service (SendGrid, etc.)
    try {
      // Simulate a brief delay for UX
      await new Promise(resolve => setTimeout(resolve, 1000))

      // In a production setup, this would send a reset email
      // For now, show a helpful message
      setSuccess(true)
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err)
      setError({
        message: 'An error occurred while requesting a password reset.',
        code: 'RESET_PASSWORD_ERROR',
        details: `Error: ${errMsg}\n${err instanceof Error ? err.stack || '' : ''}`,
        timestamp: new Date().toISOString(),
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
            <CardTitle className="text-2xl font-bold">Password Reset</CardTitle>
            <CardDescription className="mt-2">
              Password reset emails require an email service to be configured. Please contact the store owner to reset your password, or create a new account.
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Link href="/auth/login">
              <Button variant="outline" className="mt-2">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
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
          <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
          <CardDescription>Enter your email and we&apos;ll send you a reset link</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <ErrorAlert error={error} />

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
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

            <Button
              type="submit"
              className="w-full bg-[#16a34a] hover:bg-[#15803d] text-white h-11 font-semibold"
              disabled={loading}
            >
              {loading ? 'Sending...' : 'Send Reset Link'}
            </Button>
          </form>
        </CardContent>
        <CardFooter className="justify-center">
          <Link
            href="/auth/login"
            className="text-sm text-[#16a34a] font-medium hover:underline flex items-center gap-1"
          >
            <ArrowLeft className="h-3 w-3" />
            Back to Login
          </Link>
        </CardFooter>
      </Card>
    </div>
  )
}
