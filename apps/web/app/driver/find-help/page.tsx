'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { MapPin, Star, Phone, ArrowRight } from 'lucide-react'
import Link from 'next/link'

export default function FindHelpPage() {
  // Mock nearby service providers
  const providers = [
    {
      id: '1',
      name: "Mike's Towing Service",
      type: 'Towing',
      distance: 0.8,
      eta: '5 min',
      rating: 4.8,
      reviews: 245,
      phone: '+1-201-555-0123',
      availability: 'available' as const,
      specialties: ['Towing', 'Roadside Assist'],
    },
    {
      id: '2',
      name: 'Quick Fix Mechanics',
      type: 'Repair',
      distance: 1.2,
      eta: '8 min',
      rating: 4.6,
      reviews: 189,
      phone: '+1-201-555-0124',
      availability: 'available' as const,
      specialties: ['Engine Repair', 'Diagnostics'],
    },
    {
      id: '3',
      name: 'Road Rescue Assistance',
      type: 'General',
      distance: 1.5,
      eta: '10 min',
      rating: 4.9,
      reviews: 312,
      phone: '+1-201-555-0125',
      availability: 'busy' as const,
      specialties: ['All Services', 'Jump Start'],
    },
    {
      id: '4',
      name: 'Elite Auto Care',
      type: 'Maintenance',
      distance: 2.1,
      eta: '14 min',
      rating: 4.7,
      reviews: 156,
      phone: '+1-201-555-0126',
      availability: 'available' as const,
      specialties: ['Maintenance', 'Tire Service'],
    },
  ]

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="md:hidden sticky top-16 z-30 bg-black p-4 border-b border-gray-800">
        <h1 className="text-white text-2xl font-bold mb-3">Find Help</h1>
        <div className="relative">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-blue-400" />
          <Input 
            placeholder="Search service type..."
            className="pl-10 bg-gray-900 border-gray-700 text-white placeholder-gray-500"
          />
        </div>
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block mb-6">
        <h1 className="text-3xl font-bold mb-4">Find Help</h1>
        <p className="text-gray-600 mb-4">Find nearby service providers to assist you</p>
        <div className="relative max-w-md">
          <MapPin className="absolute left-3 top-3 w-5 h-5 text-blue-400" />
          <Input 
            placeholder="Search service type..."
            className="pl-10"
          />
        </div>
      </div>

      {/* Quick Filters - Mobile */}
      <div className="md:hidden flex gap-2 overflow-x-auto pb-2 px-4">
        {['All', 'Towing', 'Repair', 'Assist'].map((filter) => (
          <Button 
            key={filter}
            variant={filter === 'All' ? 'default' : 'outline'}
            size="sm"
            className="whitespace-nowrap"
          >
            {filter}
          </Button>
        ))}
      </div>

      {/* Providers List - Mobile Optimized */}
      <div className="space-y-3 md:space-y-4">
        {providers.map((provider) => (
          <Link key={provider.id} href={`/driver/track`}>
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm md:text-base">{provider.name}</h3>
                    <p className="text-xs text-gray-500 mt-1">{provider.type}</p>
                  </div>
                  <Badge 
                    className={provider.availability === 'available' ? 'bg-green-600' : 'bg-amber-600'}
                  >
                    {provider.availability === 'available' ? '✓ Available' : 'Busy'}
                  </Badge>
                </div>

                {/* Distance and Rating Row */}
                <div className="flex items-center justify-between mb-3 text-sm">
                  <div className="flex items-center gap-1 text-gray-600">
                    <MapPin className="w-4 h-4" />
                    <span>{provider.distance} mi • {provider.eta}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    <span className="font-semibold">{provider.rating}</span>
                    <span className="text-gray-500 text-xs">({provider.reviews})</span>
                  </div>
                </div>

                {/* Specialties */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {provider.specialties.map((specialty) => (
                    <Badge key={specialty} variant="secondary" className="text-xs">
                      {specialty}
                    </Badge>
                  ))}
                </div>

                {/* Call Button - Mobile */}
                <Button 
                  size="sm"
                  className="w-full bg-blue-600 hover:bg-blue-700 md:hidden"
                  onClick={(e) => {
                    e.preventDefault()
                    window.location.href = `tel:${provider.phone}`
                  }}
                >
                  <Phone className="w-4 h-4 mr-2" />
                  Call Now
                </Button>

                {/* Desktop Action */}
                <div className="hidden md:flex items-center justify-between">
                  <Button 
                    className="bg-blue-600 hover:bg-blue-700"
                    onClick={(e) => {
                      e.preventDefault()
                      window.location.href = `tel:${provider.phone}`
                    }}
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                  <ArrowRight className="w-5 h-5 text-gray-400" />
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Info Box - Mobile */}
      <div className="md:hidden bg-blue-50 border border-blue-200 rounded-lg p-4 mx-4">
        <p className="text-sm text-blue-900">
          <strong>💡 Tip:</strong> Calling a provider directly will start your service request. You can track their location in real-time.
        </p>
      </div>
    </div>
  )
}
