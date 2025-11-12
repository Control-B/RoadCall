'use client'

import { useState } from 'react'
import { signInWithRedirect } from 'aws-amplify/auth'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Truck } from 'lucide-react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  const handleLogin = async () => {
    try {
      setLoading(true)
      await signInWithRedirect()
    } catch (error) {
      console.error('Login error:', error)
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-4 text-center">
          <div className="mx-auto w-16 h-16 bg-primary rounded-full flex items-center justify-center">
            <Truck className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-3xl">AI Roadcall Assistant</CardTitle>
          <CardDescription>
            Connect drivers with roadside service vendors in real-time
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleLogin}
            disabled={loading}
            className="w-full"
            size="lg"
          >
            {loading ? 'Signing in...' : 'Sign In with Cognito'}
          </Button>
          <p className="text-xs text-center text-muted-foreground">
            Secure authentication powered by AWS Cognito
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
