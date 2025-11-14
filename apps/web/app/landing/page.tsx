'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation - Dark & Sticky */}
      <nav className="border-b border-white/10 bg-black backdrop-blur-md sticky top-0 z-50 relative">
        {/* Same gradient background as hero */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        
        <div className="container mx-auto px-6 py-4 relative z-10">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-xl">🚛</span>
              </div>
              <span className="text-2xl font-bold text-white">RoadCall</span>
            </Link>
            <div className="hidden md:flex space-x-8 text-base">
              <Link href="#platform" className="text-gray-300 hover:text-white font-semibold transition-colors">Platform</Link>
              <Link href="#features" className="text-gray-300 hover:text-white font-semibold transition-colors">Features</Link>
              <Link href="#pricing" className="text-gray-300 hover:text-white font-semibold transition-colors">Pricing</Link>
              <Link href="#customers" className="text-gray-300 hover:text-white font-semibold transition-colors">Customers</Link>
            </div>
            <div className="flex items-center space-x-3">
              <Link href="/auth/login">
                <Button variant="ghost" size="default" className="text-base text-gray-300 hover:text-white hover:bg-white/10">Sign in</Button>
              </Link>
              <Link href="/contact">
                <Button size="default" className="bg-white text-black hover:bg-gray-100 text-base font-semibold">Contact sales</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - Stability.ai Style */}
      <section className="relative overflow-hidden bg-black text-white py-32 md:py-48">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px]"></div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-4 py-2 mb-8">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="text-sm font-medium">AI-Powered Roadside Assistance</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                Instant Help
              </span>
              <br />
              <span className="text-white">
                When You Need It Most
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
              AI-powered dispatch connecting 500+ trucking fleets with mechanics in seconds. 
              Real-time tracking, smart matching, and automated billing.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link href="/auth/register">
                <Button size="lg" className="bg-white text-black hover:bg-gray-100 rounded-full px-8 py-6 text-lg font-semibold">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/contact">
                <Button size="lg" variant="outline" className="border-white/30 text-white hover:bg-white/10 rounded-full px-8 py-6 text-lg font-semibold backdrop-blur-sm">
                  Watch Demo →
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 max-w-4xl mx-auto">
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
                  500+
                </div>
                <div className="text-sm text-gray-400">Trucking Companies</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-2">
                  50K+
                </div>
                <div className="text-sm text-gray-400">Trucks Serviced</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text text-transparent mb-2">
                  15min
                </div>
                <div className="text-sm text-gray-400">Avg Response</div>
              </div>
              <div className="text-center">
                <div className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-2">
                  98%
                </div>
                <div className="text-sm text-gray-400">Uptime SLA</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Trusted By Section */}
      <section className="py-12 bg-white border-y">
        <div className="container mx-auto px-6">
          <p className="text-center text-sm text-gray-500 mb-8 uppercase tracking-wide">Trusted by leading trucking companies</p>
          <div className="flex flex-wrap justify-center items-center gap-12 opacity-60">
            <div className="text-2xl font-bold text-gray-400">SWIFT</div>
            <div className="text-2xl font-bold text-gray-400">J.B. HUNT</div>
            <div className="text-2xl font-bold text-gray-400">SCHNEIDER</div>
            <div className="text-2xl font-bold text-gray-400">WERNER</div>
            <div className="text-2xl font-bold text-gray-400">PRIME</div>
            <div className="text-2xl font-bold text-gray-400">KNIGHT</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="max-w-3xl mb-16 mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Complete fleet incident management
            </h2>
            <p className="text-xl text-gray-600">
              AI dispatch, real-time tracking, and automated billing in one platform.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800&auto=format&fit=crop&q=80" 
                  alt="AI Technology"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">AI Dispatch</h3>
                <p className="text-gray-600">
                  Intelligent matching algorithm connects drivers with the best service provider in seconds.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=800&auto=format&fit=crop&q=80" 
                  alt="GPS Tracking"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-green-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Real-Time Tracking</h3>
                <p className="text-gray-600">
                  Monitor service provider location and ETA with live GPS tracking and geofencing.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1588196749597-9ff075ee6b5b?w=800&auto=format&fit=crop&q=80" 
                  alt="Voice Communication"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Voice Integration</h3>
                <p className="text-gray-600">
                  Drivers can call in and AI automatically creates incidents with transcription and summarization.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80" 
                  alt="Automated Billing"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Automated Billing</h3>
                <p className="text-gray-600">
                  Consolidated invoicing with detailed cost breakdowns and automated payment processing.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80" 
                  alt="Analytics Dashboard"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-pink-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Analytics Dashboard</h3>
                <p className="text-gray-600">
                  Track KPIs, response times, costs per incident, and vendor performance metrics.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80" 
                  alt="Security Lock"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/60 to-transparent"></div>
              </div>
              <div className="p-8">
                <h3 className="text-xl font-bold text-gray-900 mb-3">Enterprise Security</h3>
                <p className="text-gray-600">
                  SOC 2 compliant with end-to-end encryption, audit logs, and role-based access control.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Dispatch Deep Dive */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Instant AI Dispatch
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Smart matching connects drivers with the best service providers in seconds based on location, ratings, and availability.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Smart Matching</strong>
                    <p className="text-gray-600">AI considers distance, ratings, specialization, and real-time availability</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Instant Notifications</strong>
                    <p className="text-gray-600">Service providers receive offers immediately via mobile app</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Automatic Escalation</strong>
                    <p className="text-gray-600">If no response, system automatically expands search radius</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1531746790731-6c087fecd65a?w=1200&auto=format&fit=crop&q=80" 
                alt="AI Dispatch System"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Tracking Deep Dive */}
      <section className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div className="order-2 md:order-1 relative">
              <img 
                src="https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&auto=format&fit=crop&q=80" 
                alt="GPS Tracking Map"
                className="rounded-2xl shadow-2xl"
              />
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Live GPS Tracking
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Complete visibility into provider location, ETA, and progress with real-time GPS updates.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Live GPS Updates</strong>
                    <p className="text-gray-600">See provider location update every 30 seconds on the map</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Accurate ETAs</strong>
                    <p className="text-gray-600">Dynamic ETA calculations based on real traffic conditions</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Geofencing Alerts</strong>
                    <p className="text-gray-600">Automatic notifications when provider arrives on scene</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Integration Deep Dive */}
      <section className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-2 gap-16 items-center">
            <div>
              <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                AI Voice Integration
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Drivers call in and AI automatically transcribes, categorizes, and creates incidents with all details.
              </p>
              <ul className="space-y-4">
                <li className="flex items-start">
                  <span className="text-purple-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Speech-to-Text</strong>
                    <p className="text-gray-600">Accurate transcription of driver calls with 98% accuracy</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">AI Summarization</strong>
                    <p className="text-gray-600">Automatically extracts key details: location, issue type, urgency</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-3 text-xl">✓</span>
                  <div>
                    <strong className="text-gray-900">Instant Incident Creation</strong>
                    <p className="text-gray-600">No manual data entry - incidents created automatically from calls</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <img 
                src="https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=1200&auto=format&fit=crop&q=80" 
                alt="Voice Integration"
                className="rounded-2xl shadow-2xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="platform" className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">How it works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              From breakdown to resolution in minutes
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-12 max-w-5xl mx-auto">
            <Card className="p-8 text-center bg-white">
              <div className="relative mb-6">
                <img 
                  src="https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=600&auto=format&fit=crop&q=80" 
                  alt="Driver Reports"
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  1
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 mt-8">Driver Reports</h3>
              <p className="text-gray-600">
                Driver uses mobile app or calls dispatch. AI captures location, truck details, and issue type automatically.
              </p>
            </Card>
            <Card className="p-8 text-center bg-white">
              <div className="relative mb-6">
                <img 
                  src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=600&auto=format&fit=crop&q=80" 
                  alt="AI Matches Provider"
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  2
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 mt-8">AI Matches Provider</h3>
              <p className="text-gray-600">
                Our AI instantly finds qualified service providers nearby and sends offers based on ratings and availability.
              </p>
            </Card>
            <Card className="p-8 text-center bg-white">
              <div className="relative mb-6">
                <img 
                  src="https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=600&auto=format&fit=crop&q=80" 
                  alt="Track and Resolve"
                  className="w-full h-48 object-cover rounded-xl mb-4"
                />
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-xl font-bold shadow-lg">
                  3
                </div>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3 mt-8">Track & Resolve</h3>
              <p className="text-gray-600">
                Dispatch monitors real-time progress. Service is completed, documented, and automatically billed.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 bg-white">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">500+</div>
              <div className="text-gray-600">Trucking Companies</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">50K+</div>
              <div className="text-gray-600">Trucks Serviced</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">15min</div>
              <div className="text-gray-600">Avg Response Time</div>
            </div>
            <div>
              <div className="text-5xl font-bold text-gray-900 mb-2">98%</div>
              <div className="text-gray-600">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section id="customers" className="py-24 bg-gray-50">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Trusted by leading fleets
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Real results from trucking companies nationwide
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="overflow-hidden bg-white">
              <div className="h-48 relative">
                <img 
                  src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&auto=format&fit=crop&q=80" 
                  alt="Trucking Fleet"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white font-bold text-4xl">40%</div>
              </div>
              <div className="p-8">
                <p className="text-gray-600 mb-6">
                  "RoadCall reduced our average downtime by 40% and saved us $200K in the first year."
                </p>
                <div>
                  <p className="font-bold text-gray-900">TransNational Logistics</p>
                  <p className="text-sm text-gray-500">500+ truck fleet</p>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden bg-white">
              <div className="h-48 relative">
                <img 
                  src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&auto=format&fit=crop&q=80" 
                  alt="Truck on Highway"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white font-bold text-4xl">15min</div>
              </div>
              <div className="p-8">
                <p className="text-gray-600 mb-6">
                  "Average response time dropped from 45 minutes to just 15 minutes. Game changer for our operations."
                </p>
                <div>
                  <p className="font-bold text-gray-900">Midwest Freight Co.</p>
                  <p className="text-sm text-gray-500">250+ truck fleet</p>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden bg-white">
              <div className="h-48 relative">
                <img 
                  src="https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=800&auto=format&fit=crop&q=80" 
                  alt="Logistics Operations"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white font-bold text-4xl">$300K</div>
              </div>
              <div className="p-8">
                <p className="text-gray-600 mb-6">
                  "Consolidated billing and real-time tracking saved us $300K annually in operational costs."
                </p>
                <div>
                  <p className="font-bold text-gray-900">Coast-to-Coast Hauling</p>
                  <p className="text-sm text-gray-500">800+ truck fleet</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24 bg-white">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
              Transparent pricing
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Scale with your fleet. No hidden fees.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            <Card className="p-8 border-2 hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <p className="text-gray-600 mb-6">For small fleets</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$299</span>
                <span className="text-gray-600">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Up to 50 trucks
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  AI-powered dispatch
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Real-time tracking
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Basic analytics
                </li>
              </ul>
              <Link href="/auth/register">
                <Button className="w-full" variant="outline">Get started</Button>
              </Link>
            </Card>

            <Card className="p-8 border-4 border-blue-600 relative hover:shadow-xl transition-shadow">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                MOST POPULAR
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Professional</h3>
              <p className="text-gray-600 mb-6">For growing fleets</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">$799</span>
                <span className="text-gray-600">/mo</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Up to 200 trucks
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Everything in Starter
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Advanced analytics
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Priority support
                </li>
              </ul>
              <Link href="/auth/register">
                <Button className="w-full bg-blue-600 hover:bg-blue-700">Get started</Button>
              </Link>
            </Card>

            <Card className="p-8 border-2 hover:shadow-lg transition-shadow">
              <h3 className="text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-gray-600 mb-6">For large fleets</p>
              <div className="mb-6">
                <span className="text-5xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-3 mb-8 text-sm">
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Unlimited trucks
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Custom integration
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Dedicated support
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  SLA guarantees
                </li>
              </ul>
              <Link href="/contact">
                <Button className="w-full" variant="outline">Contact sales</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold mb-6">
            Ready to modernize your fleet?
          </h2>
          <p className="text-xl mb-10 max-w-2xl mx-auto opacity-90">
            Join hundreds of companies reducing downtime and costs with RoadCall
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/auth/register">
              <Button size="lg" className="bg-white text-blue-600 hover:bg-gray-100 rounded-full px-8">
                Start free trial
              </Button>
            </Link>
            <Link href="/contact">
              <Button size="lg" variant="outline" className="border-2 border-white text-white hover:bg-white/10 rounded-full px-8">
                Talk to sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-16">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-5 gap-8 mb-12">
            <div className="md:col-span-2">
              <div className="flex items-center space-x-2 mb-4">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-xl">🚛</span>
                </div>
                <span className="text-xl font-bold text-white">RoadCall</span>
              </div>
              <p className="text-sm mb-6 max-w-sm">
                AI-powered roadside assistance platform for trucking companies. Keep your fleet moving 24/7.
              </p>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Product</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white">Features</Link></li>
                <li><Link href="#pricing" className="hover:text-white">Pricing</Link></li>
                <li><Link href="#" className="hover:text-white">API</Link></li>
                <li><Link href="#" className="hover:text-white">Mobile App</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Company</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/about" className="hover:text-white">About</Link></li>
                <li><Link href="/blog" className="hover:text-white">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-white">Careers</Link></li>
                <li><Link href="/press" className="hover:text-white">Press</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="text-white font-semibold mb-4 text-sm">Support</h3>
              <ul className="space-y-2 text-sm">
                <li><Link href="/help" className="hover:text-white">Help Center</Link></li>
                <li><Link href="/contact" className="hover:text-white">Contact</Link></li>
                <li><Link href="/status" className="hover:text-white">Status</Link></li>
                <li><Link href="/docs" className="hover:text-white">Docs</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 pt-8 flex flex-col md:flex-row justify-between items-center text-sm">
            <div>© 2025 RoadCall, Inc. All rights reserved.</div>
            <div className="flex space-x-6 mt-4 md:mt-0">
              <Link href="/privacy" className="hover:text-white">Privacy</Link>
              <Link href="/terms" className="hover:text-white">Terms</Link>
              <Link href="/security" className="hover:text-white">Security</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
