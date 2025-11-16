import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'
import { Logo } from '@/components/logo'
import PWARegister from '@/components/pwa-register'
import Link from 'next/link'
import { Toaster } from '@/components/ui/toaster'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'RoadCall - AI Roadside Assistance',
  description: 'AI-powered roadside assistance platform. One call, instant help from qualified mechanics and tow companies.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'RoadCall',
  },
  formatDetection: {
    telephone: false,
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes" />
        <meta name="theme-color" content="#000000" />
        <meta name="description" content="RoadCall - AI-powered roadside assistance. One call, instant help from qualified mechanics and tow companies." />
        <link rel="icon" href="/logo-triangle.svg" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={inter.className}>
        <Providers>
          <PWARegister />
          <div className="min-h-screen flex flex-col">
            <header className="px-6 py-6 border-b border-neutral-800 sticky top-0 z-40 bg-black/90 backdrop-blur-md">
              {/* Hero-like gradient layers */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 pointer-events-none"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.12),transparent_60%)] pointer-events-none"></div>
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40 pointer-events-none"></div>
              <div className="relative z-10 mx-auto max-w-7xl grid grid-cols-3 items-center">
                <div className="flex items-center">
                  <Logo />
                </div>
                <nav className="hidden md:flex justify-center items-center space-x-10 text-base">
                  <Link href="#platform" className="text-gray-300 hover:text-white transition-colors font-medium">Platform</Link>
                  <Link href="#features" className="text-gray-300 hover:text-white transition-colors font-medium">Features</Link>
                  <Link href="#pricing" className="text-gray-300 hover:text-white transition-colors font-medium">Pricing</Link>
                  <Link href="#customers" className="text-gray-300 hover:text-white transition-colors font-medium">Customers</Link>
                </nav>
                <div className="flex items-center justify-end space-x-4">
                  <Link href="/auth/login" className="text-base text-gray-300 hover:text-white font-medium">Sign in</Link>
                  <Link href="/contact" className="px-5 py-2.5 rounded-md bg-white text-black text-base font-semibold hover:bg-neutral-100">Contact sales</Link>
                </div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
            <footer className="px-6 py-20 text-sm text-neutral-300 border-t border-neutral-800 bg-black relative overflow-hidden">
              {/* Gradient layers matching hero */}
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20 pointer-events-none"></div>
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.12),transparent_60%)] pointer-events-none"></div>
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40 pointer-events-none"></div>
              <div className="max-w-7xl mx-auto relative z-10 grid gap-14 md:grid-cols-5">
                <div className="md:col-span-2 space-y-4">
                  <Logo />
                  <p className="text-sm max-w-sm text-gray-300 leading-relaxed">AI-powered roadside assistance platform for trucking companies. Keep your fleet moving 24/7.</p>
                </div>
                <div className="space-y-4">
                  <h3 className="text-neutral-200 font-semibold text-xs tracking-wide">Product</h3>
                  <ul className="space-y-2">
                    <li><Link href="#features" className="hover:text-white">Features</Link></li>
                    <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
                    <li><Link href="#" className="hover:text-white">API</Link></li>
                    <li><Link href="#" className="hover:text-white">Mobile App</Link></li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-neutral-200 font-semibold text-xs tracking-wide">Company</h3>
                  <ul className="space-y-2">
                    <li><Link href="/about" className="hover:text-white">About</Link></li>
                    <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                    <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                    <li><Link href="/press" className="hover:text-white">Press</Link></li>
                  </ul>
                </div>
                <div className="space-y-4">
                  <h3 className="text-neutral-200 font-semibold text-xs tracking-wide">Support</h3>
                  <ul className="space-y-2">
                    <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
                    <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                    <li><Link href="/status" className="hover:text-white">Status</Link></li>
                    <li><Link href="/docs" className="hover:text-white">Docs</Link></li>
                  </ul>
                </div>
              </div>
              <div className="relative z-10 mt-14 pt-10 border-t border-neutral-800 flex flex-col md:flex-row items-center justify-between text-xs text-neutral-400">
                <span>© 2025 RoadCall, Inc. All rights reserved.</span>
                <div className="flex space-x-6 mt-4 md:mt-0">
                  <Link href="/privacy" className="hover:text-neutral-200">Privacy</Link>
                  <Link href="/terms" className="hover:text-neutral-200">Terms</Link>
                  <Link href="/security" className="hover:text-neutral-200">Security</Link>
                </div>
              </div>
            </footer>
          </div>
          <Toaster />
        </Providers>
      </body>
    </html>
  )
}
