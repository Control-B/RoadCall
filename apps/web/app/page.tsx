'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function LandingPage() {
  return (
    <div className="bg-white">
      {/* Hero Section - Stability.ai Style - Mobile Optimized */}
      <section className="relative overflow-hidden bg-black text-white pt-12 pb-12 sm:pt-16 md:pt-24 md:pb-24">
        {/* Animated gradient background */}
        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-pink-600/20"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(59,130,246,0.1),transparent_50%)]"></div>
        
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:72px_72px]"></div>
        
        <div className="container mx-auto px-4 sm:px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center space-x-2 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full px-3 sm:px-4 py-2 mb-6 sm:mb-8 text-xs sm:text-sm">
              <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
              <span className="font-medium">AI Call Center • 24/7 Dispatch</span>
            </div>

            {/* Main Headline */}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-4 sm:mb-6 md:mb-8 leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                One Call
              </span>
              <br />
              <span className="text-white text-2xl sm:text-3xl md:text-5xl lg:text-6xl">
                Instant Help
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-gray-300 mb-8 sm:mb-12 max-w-3xl mx-auto leading-relaxed px-2">
              AI call center that instantly connects stranded drivers with qualified mechanics and tow companies. 
              Just call, speak naturally, and help is on the way.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center items-center mb-12 sm:mb-16 px-2">
              <Link href="/auth/register" className="w-full sm:w-auto">
                <Button size="lg" className="w-full bg-white text-black hover:bg-gray-100 rounded-full px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg font-semibold">
                  Get Started Free
                </Button>
              </Link>
              <Link href="/contact" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full border-white/30 text-white hover:bg-white/10 rounded-full px-6 sm:px-8 py-4 sm:py-6 text-base sm:text-lg font-semibold backdrop-blur-sm">
                  Watch Demo →
                </Button>
              </Link>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 md:gap-8 max-w-4xl mx-auto px-2">
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-1 sm:mb-2">
                  24/7
                </div>
                <div className="text-xs sm:text-sm text-gray-400">AI Call Center</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent mb-1 sm:mb-2">
                  50K+
                </div>
                <div className="text-xs sm:text-sm text-gray-400">Calls</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-pink-400 to-red-400 bg-clip-text text-transparent mb-1 sm:mb-2">
                  &lt;2min
                </div>
                <div className="text-xs sm:text-sm text-gray-400">Avg Call</div>
              </div>
              <div className="text-center">
                <div className="text-3xl sm:text-4xl md:text-5xl font-bold bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent mb-1 sm:mb-2">
                  15min
                </div>
                <div className="text-xs sm:text-sm text-gray-400">Dispatch</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-16 sm:h-24 md:h-32 bg-gradient-to-t from-white to-transparent"></div>
      </section>

      {/* Trusted By Section */}
      <section className="py-8 sm:py-10 md:py-12 bg-white border-y">
        <div className="container mx-auto px-4 sm:px-6">
          <p className="text-center text-xs sm:text-sm text-gray-500 mb-6 sm:mb-8 uppercase tracking-wide">Trusted by leading trucking companies</p>
          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 md:gap-12 opacity-60">
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400">SWIFT</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400">J.B. HUNT</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400">SCHNEIDER</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400">WERNER</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400">PRIME</div>
            <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-400">KNIGHT</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="max-w-3xl mb-12 sm:mb-16 mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              AI call center that works 24/7
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 px-2">
              Drivers call one number. AI handles everything from transcription to dispatch to billing.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1423666639041-f56000c27a9a?w=800&auto=format&fit=crop&q=80" 
                  alt="Call Center Headset"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-blue-900/60 to-transparent"></div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">AI Call Center</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Drivers call one number. AI transcribes, understands the issue, and creates incidents automatically.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1569336415962-a4bd9f69cd83?w=800&auto=format&fit=crop&q=80" 
                  alt="GPS Tracking"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-green-900/60 to-transparent"></div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Real-Time Tracking</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Monitor service provider location and ETA with live GPS tracking and geofencing.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=800&auto=format&fit=crop&q=80" 
                  alt="Mobile Dispatch Notification"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-purple-900/60 to-transparent"></div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Smart Dispatch</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  AI finds the nearest qualified mechanic or tow company and sends them a job offer instantly.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800&auto=format&fit=crop&q=80" 
                  alt="Automated Billing"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-orange-900/60 to-transparent"></div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Automated Billing</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Consolidated invoicing with detailed cost breakdowns and automated payment processing.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&auto=format&fit=crop&q=80" 
                  alt="Analytics Dashboard"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-pink-900/60 to-transparent"></div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Analytics Dashboard</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  Track KPIs, response times, costs per incident, and vendor performance metrics.
                </p>
              </div>
            </Card>

            <Card className="overflow-hidden border hover:shadow-lg transition-shadow">
              <div className="h-40 sm:h-48 relative overflow-hidden">
                <img 
                  src="https://images.unsplash.com/photo-1563986768609-322da13575f3?w=800&auto=format&fit=crop&q=80" 
                  alt="Security Lock"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-indigo-900/60 to-transparent"></div>
              </div>
              <div className="p-6 sm:p-8">
                <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3">Enterprise Security</h3>
                <p className="text-sm sm:text-base text-gray-600">
                  SOC 2 compliant with end-to-end encryption, audit logs, and role-based access control.
                </p>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* AI Dispatch Deep Dive */}
      <section className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="order-2 md:order-1">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
                AI Call Center That Never Sleeps
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8">
                Drivers call one number. AI answers 24/7, understands the problem, and dispatches help automatically.
              </p>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Natural Conversation</strong>
                    <p className="text-xs sm:text-sm text-gray-600">AI speaks naturally with drivers, asking clarifying questions as needed</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Instant Transcription</strong>
                    <p className="text-xs sm:text-sm text-gray-600">Every call is transcribed and summarized with key details extracted automatically</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-blue-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Auto-Dispatch</strong>
                    <p className="text-xs sm:text-sm text-gray-600">System finds and alerts qualified providers while driver is still on the call</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="order-1 md:order-2 relative">
              <img 
                src="https://images.unsplash.com/photo-1553877522-43269d4ea984?w=1200&auto=format&fit=crop&q=80" 
                alt="AI Call Center System"
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Real-Time Tracking Deep Dive */}
      <section className="py-16 sm:py-20 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div className="order-2 md:order-1 relative">
              <img 
                src="/vehicletrack.jpg" 
                alt="GPS Tracking Map"
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
            <div className="order-1 md:order-2">
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
                Live GPS Tracking
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8">
                Complete visibility into provider location, ETA, and progress with real-time GPS updates.
              </p>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Live GPS Updates</strong>
                    <p className="text-xs sm:text-sm text-gray-600">See provider location update every 30 seconds on the map</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Accurate ETAs</strong>
                    <p className="text-xs sm:text-sm text-gray-600">Dynamic ETA calculations based on real traffic conditions</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-green-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Geofencing Alerts</strong>
                    <p className="text-xs sm:text-sm text-gray-600">Automatic notifications when provider arrives on scene</p>
                  </div>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Voice Integration Deep Dive */}
      <section className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-2 gap-8 md:gap-16 items-center">
            <div>
              <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
                Smart Provider Matching
              </h2>
              <p className="text-base sm:text-lg md:text-xl text-gray-600 mb-6 sm:mb-8">
                AI instantly finds qualified mechanics and tow companies near the breakdown location and sends job offers.
              </p>
              <ul className="space-y-3 sm:space-y-4">
                <li className="flex items-start">
                  <span className="text-purple-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Location-Based Search</strong>
                    <p className="text-xs sm:text-sm text-gray-600">Finds providers within radius of breakdown, prioritizing closest first</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Qualification Matching</strong>
                    <p className="text-xs sm:text-sm text-gray-600">Only alerts providers qualified for the specific issue (tire, engine, tow, etc.)</p>
                  </div>
                </li>
                <li className="flex items-start">
                  <span className="text-purple-600 mr-3 text-lg sm:text-xl flex-shrink-0 mt-1">✓</span>
                  <div>
                    <strong className="text-gray-900 block text-sm sm:text-base">Instant Job Offers</strong>
                    <p className="text-xs sm:text-sm text-gray-600">Providers receive push notifications and can accept with one tap, setting their ETA</p>
                  </div>
                </li>
              </ul>
            </div>
            <div className="relative">
              <img 
                src="https://images.pexels.com/photos/1252500/pexels-photo-1252500.jpeg?auto=compress&cs=tinysrgb&w=1200" 
                alt="GPS Smart Matching System"
                className="rounded-2xl shadow-2xl w-full"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="platform" className="py-16 sm:py-20 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">How it works</h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              From breakdown to resolution in minutes
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 md:gap-12 max-w-5xl mx-auto">
            <Card className="p-6 sm:p-8 text-center bg-white">
              <div className="relative mb-6">
                <img 
                  src="https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=600&auto=format&fit=crop&q=80" 
                  alt="Driver Making Phone Call"
                  className="w-full h-40 sm:h-48 object-cover rounded-xl mb-4"
                />
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-10 sm:w-12 h-10 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg">
                  1
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 mt-6 sm:mt-8">Driver Calls In</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Driver calls your roadside number. AI answers, transcribes the call, and extracts location, truck details, and issue type.
              </p>
            </Card>
            <Card className="p-6 sm:p-8 text-center bg-white">
              <div className="relative mb-6">
                <img 
                  src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=600&auto=format&fit=crop&q=80" 
                  alt="AI Matching System"
                  className="w-full h-40 sm:h-48 object-cover rounded-xl mb-4"
                />
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-10 sm:w-12 h-10 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg">
                  2
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 mt-6 sm:mt-8">AI Finds Help</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                System finds the nearest qualified mechanic or tow company and sends them a job offer with all details and location.
              </p>
            </Card>
            <Card className="p-6 sm:p-8 text-center bg-white">
              <div className="relative mb-6">
                <img 
                  src="https://images.unsplash.com/photo-1619642751034-765dfdf7c58e?w=600&auto=format&fit=crop&q=80" 
                  alt="Vehicle Mechanic Working"
                  className="w-full h-40 sm:h-48 object-cover rounded-xl mb-4"
                />
                <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 w-10 sm:w-12 h-10 sm:h-12 bg-blue-600 rounded-full flex items-center justify-center text-white text-lg sm:text-xl font-bold shadow-lg">
                  3
                </div>
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 mt-6 sm:mt-8">Provider Accepts & Arrives</h3>
              <p className="text-xs sm:text-sm text-gray-600">
                Provider accepts the job, sets ETA, and heads to location. Driver and dispatch track progress in real-time until resolved.
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 md:py-20 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2">500+</div>
              <div className="text-xs sm:text-sm md:text-base text-gray-600">Trucking Companies</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2">50K+</div>
              <div className="text-xs sm:text-sm md:text-base text-gray-600">Trucks Serviced</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2">15min</div>
              <div className="text-xs sm:text-sm md:text-base text-gray-600">Avg Response</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2">98%</div>
              <div className="text-xs sm:text-sm md:text-base text-gray-600">Uptime SLA</div>
            </div>
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section id="customers" className="py-16 sm:py-20 md:py-24 bg-gray-50">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Trusted by leading fleets
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              Real results from trucking companies nationwide
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            <Card className="overflow-hidden bg-white">
              <div className="h-40 sm:h-48 relative">
                <img 
                  src="https://images.unsplash.com/photo-1601584115197-04ecc0da31d7?w=800&auto=format&fit=crop&q=80" 
                  alt="Trucking Fleet"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white font-bold text-2xl sm:text-4xl">40%</div>
              </div>
              <div className="p-6 sm:p-8">
                <p className="text-xs sm:text-sm text-gray-600 mb-6">
                  "RoadCall reduced our average downtime by 40% and saved us $200K in the first year."
                </p>
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">TransNational Logistics</p>
                  <p className="text-xs text-gray-500">500+ truck fleet</p>
                </div>
              </div>
            </Card>

            <Card className="overflow-hidden bg-white">
              <div className="h-40 sm:h-48 relative">
                <img 
                  src="https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=800&auto=format&fit=crop&q=80" 
                  alt="Truck on Highway"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white font-bold text-2xl sm:text-4xl">15min</div>
              </div>
              <div className="p-6 sm:p-8">
                <p className="text-xs sm:text-sm text-gray-600 mb-6">
                  "Average response time dropped from 45 minutes to just 15 minutes. Game changer for our operations."
                </p>
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">Midwest Freight Co.</p>
                  <p className="text-xs text-gray-500">250+ truck fleet</p>
                </div>
              </div>
            </Card>


            <Card className="overflow-hidden bg-white">
              <div className="h-40 sm:h-48 relative">
                <img 
                  src="https://images.unsplash.com/photo-1566576721346-d4a3b4eaeb55?w=800&auto=format&fit=crop&q=80" 
                  alt="Logistics Operations"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent"></div>
                <div className="absolute bottom-4 left-4 text-white font-bold text-2xl sm:text-4xl">$300K</div>
              </div>
              <div className="p-6 sm:p-8">
                <p className="text-xs sm:text-sm text-gray-600 mb-6">
                  "Consolidated billing and real-time tracking saved us $300K annually in operational costs."
                </p>
                <div>
                  <p className="font-bold text-gray-900 text-sm sm:text-base">Coast-to-Coast Hauling</p>
                  <p className="text-xs text-gray-500">800+ truck fleet</p>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-16 sm:py-20 md:py-24 bg-white">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center mb-12 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold text-gray-900 mb-4 sm:mb-6">
              Transparent pricing
            </h2>
            <p className="text-base sm:text-lg md:text-xl text-gray-600 max-w-2xl mx-auto">
              Scale with your fleet. No hidden fees.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 max-w-5xl mx-auto">
            <Card className="p-6 sm:p-8 border-2 hover:shadow-lg transition-shadow">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Starter</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">For small fleets</p>
              <div className="mb-6">
                <span className="text-3xl sm:text-5xl font-bold text-gray-900">$299</span>
                <span className="text-gray-600 text-sm sm:text-base">/mo</span>
              </div>
              <ul className="space-y-2 sm:space-y-3 mb-8 text-xs sm:text-sm">
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Up to 50 trucks
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  AI dispatch
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Tracking
                </li>
                <li className="flex items-center">
                  <span className="text-green-600 mr-2">✓</span>
                  Basic analytics
                </li>
              </ul>
              <Link href="/auth/register" className="w-full block">
                <Button className="w-full text-sm sm:text-base" variant="outline">Get started</Button>
              </Link>
            </Card>

            <Card className="p-6 sm:p-8 border-4 border-blue-600 relative hover:shadow-xl transition-shadow">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                MOST POPULAR
              </div>
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Professional</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">For growing fleets</p>
              <div className="mb-6">
                <span className="text-3xl sm:text-5xl font-bold text-gray-900">$799</span>
                <span className="text-gray-600 text-sm sm:text-base">/mo</span>
              </div>
              <ul className="space-y-2 sm:space-y-3 mb-8 text-xs sm:text-sm">
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
              <Link href="/auth/register" className="w-full block">
                <Button className="w-full bg-blue-600 hover:bg-blue-700 text-sm sm:text-base">Get started</Button>
              </Link>
            </Card>

            <Card className="p-6 sm:p-8 border-2 hover:shadow-lg transition-shadow">
              <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Enterprise</h3>
              <p className="text-sm sm:text-base text-gray-600 mb-6">For large fleets</p>
              <div className="mb-6">
                <span className="text-3xl sm:text-5xl font-bold text-gray-900">Custom</span>
              </div>
              <ul className="space-y-2 sm:space-y-3 mb-8 text-xs sm:text-sm">
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
              <Link href="/contact" className="w-full block">
                <Button className="w-full text-sm sm:text-base" variant="outline">Contact sales</Button>
              </Link>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-20 md:py-24 bg-gradient-to-br from-blue-600 to-purple-600 text-white">
        <div className="container mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6">
            Ready to modernize your fleet?
          </h2>
          <p className="text-base sm:text-lg md:text-xl mb-8 sm:mb-10 max-w-2xl mx-auto opacity-90">
            Join hundreds of companies reducing downtime and costs with RoadCall
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <Link href="/auth/register" className="w-full sm:w-auto">
              <Button size="lg" className="w-full bg-white text-blue-600 hover:bg-gray-100 rounded-full px-6 sm:px-8 text-sm sm:text-base font-semibold">
                Start free trial
              </Button>
            </Link>
            <Link href="/contact" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full border-2 border-white text-white hover:bg-white/10 rounded-full px-6 sm:px-8 text-sm sm:text-base font-semibold">
                Talk to sales
              </Button>
            </Link>
          </div>
        </div>
      </section>

    </div>
  );
}
