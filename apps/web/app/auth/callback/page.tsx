'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAuthSession, fetchUserAttributes } from 'aws-amplify/auth'

export default function CallbackPage() {
  const router = useRouter()

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const session = await fetchAuthSession()
        if (session.tokens) {
          const attributes = await fetchUserAttributes()
          const role = attributes['custom:role']
          
          // Redirect based on role
          switch (role) {
            case 'driver':
              router.push('/driver')
              break
            case 'vendor':
              router.push('/vendor')
              break
            case 'dispatcher':
              router.push('/dispatcher')
              break
            case 'admin':
              router.push('/admin')
              break
            default:
              router.push('/driver')
          }
        }
      } catch (error) {
        console.error('Callback error:', error)
        router.push('/auth/login')
      }
    }

    handleCallback()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
        <p className="text-muted-foreground">Completing sign in...</p>
      </div>
    </div>
  )
}
