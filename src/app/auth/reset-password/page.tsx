import { Suspense } from 'react'
import { ResetPasswordClient } from '@/components/auth/reset-password-client'

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordClient />
    </Suspense>
  )
}
