import { Suspense } from 'react'
import { ForgotPasswordClient } from '@/components/auth/forgot-password-client'

export default function ForgotPasswordPage() {
  return (
    <Suspense>
      <ForgotPasswordClient />
    </Suspense>
  )
}
