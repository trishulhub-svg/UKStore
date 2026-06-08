import { Suspense } from 'react'
import { LoginClient } from '@/components/auth/login-client'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginClient />
    </Suspense>
  )
}
