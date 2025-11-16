'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { fetchAuthSession, signOut } from 'aws-amplify/auth'
import { Button } from '@/components/ui/button'
import { MobileNav } from '@/components/mobile-nav'
import { Truck, LogOut } from 'lucide-react'

export default function DriverLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TEMPORARY: Bypass auth check for testing
    // Uncomment below to re-enable authentication
    /*
    const checkAuth = async () => {
      try {
        const session = await fetchAuthSession()
        if (!session.tokens) {
          router.push('/auth/login')
        }
        setLoading(false)
      } catch (error) {
        router.push('/auth/login')
      }
    }
    checkAuth()
    */
    
    // Skip auth check for now
    setLoading(false)
  }, [router])

  const handleSignOut = async () => {
    try {
      await signOut()
      router.push('/auth/login')
    } catch (error) {
      console.error('Sign out error:', error)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Desktop Header */}
      <header className="hidden md:block bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
              <Truck className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">RoadCall</h1>
              <p className="text-sm text-gray-400">Driver Dashboard</p>
            </div>
          </div>
          <Button 
            variant="outline" 
            onClick={handleSignOut}
            className="border-gray-700 text-gray-300 hover:text-white"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Mobile Header */}
      <header className="md:hidden bg-gradient-to-r from-blue-600 to-purple-600 sticky top-0 z-40">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center">
              <Truck className="w-5 h-5 text-blue-600" />
            </div>
            <h1 className="text-lg font-bold text-white">RoadCall</h1>
          </div>
          <Button 
            size="sm"
            variant="ghost" 
            onClick={handleSignOut}
            className="text-white hover:bg-white/20"
          >
            <LogOut className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-20 md:pb-8">
        <div className="container mx-auto px-4 py-8 md:py-8">
          {children}
        </div>
      </main>

      {/* Mobile Bottom Navigation */}
      <MobileNav />
    </div>
  )
}
