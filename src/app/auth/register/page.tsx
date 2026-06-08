import { Suspense } from 'react'
import { RegisterClient } from '@/components/auth/register-client'

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterClient />
    </Suspense>
  )
}
