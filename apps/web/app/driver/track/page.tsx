'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { MapPin, Phone, Clock, Fuel, AlertCircle } from 'lucide-react'
import Link from 'next/link'

export default function TrackPage() {
  const tracking = {
    serviceName: "Mike's Towing Service",
    servicePhone: '+1-201-555-0123',
    providerName: 'Michael Johnson',
    vehicle: 'Chevrolet Silverado - Silver',
    licensePlate: 'NJ-45X-892',
    status: 'en_route' as const,
    eta: '7 minutes',
    distance: 1.2,
    incidentLocation: 'I-95 Mile Marker 120, NJ',
  }

  return (
    <div className="space-y-4">
      {/* Map Placeholder - Mobile */}
      <div className="md:hidden w-full h-64 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg flex items-center justify-center border-2 border-blue-700 overflow-hidden">
        <div className="text-center text-white">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-80" />
          <p className="text-sm">📍 Live GPS Tracking</p>
          <p className="text-xs opacity-75 mt-1">Provider location updated in real-time</p>
        </div>
      </div>

      {/* Desktop Map Placeholder */}
      <div className="hidden md:flex w-full h-96 bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg items-center justify-center border-2 border-blue-700">
        <div className="text-center text-white">
          <MapPin className="w-16 h-16 mx-auto mb-2 opacity-80" />
          <p className="text-lg">📍 Live GPS Tracking</p>
          <p className="text-sm opacity-75 mt-1">Provider location updated in real-time</p>
        </div>
      </div>

      {/* Status Alert */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-sm text-blue-900">Provider En Route</p>
              <p className="text-sm text-blue-800 mt-1">Your service provider is heading your way. ETA is {tracking.eta}.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ETA and Status - Mobile Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">ETA</p>
            <p className="text-2xl font-bold text-blue-600">{tracking.eta}</p>
            <p className="text-xs text-gray-500 mt-2">{tracking.distance} miles away</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-gray-500 mb-1">Status</p>
            <Badge className="bg-amber-600 mb-2">En Route</Badge>
            <p className="text-xs text-gray-500">Updating every 30s</p>
          </CardContent>
        </Card>
      </div>

      {/* Service Provider Info */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-1">Service Provider</h3>
            <p className="font-bold text-lg">{tracking.serviceName}</p>
            <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
              <Fuel className="w-4 h-4" />
              <span>Operator: {tracking.providerName}</span>
            </div>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Vehicle</h3>
            <p className="text-sm font-medium">{tracking.vehicle}</p>
            <p className="text-sm text-gray-600">{tracking.licensePlate}</p>
          </div>

          <div className="border-t pt-3">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Destination</h3>
            <div className="flex items-start gap-2">
              <MapPin className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-600">{tracking.incidentLocation}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contact Provider */}
      <Button 
        size="lg"
        className="w-full bg-green-600 hover:bg-green-700 text-white"
        onClick={() => window.location.href = `tel:${tracking.servicePhone}`}
      >
        <Phone className="w-5 h-5 mr-2" />
        Call Provider
      </Button>

      {/* Live Updates Info */}
      <Card className="bg-gray-50 border-gray-200">
        <CardContent className="p-4">
          <div className="flex items-start gap-2">
            <Clock className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-gray-700">Live Tracking Active</p>
              <p className="text-xs text-gray-600 mt-1">
                Location updates every 30 seconds. Your provider can see your location too.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Back to Dashboard */}
      <Link href="/driver">
        <Button variant="outline" className="w-full">
          Back to Dashboard
        </Button>
      </Link>
    </div>
  )
}
