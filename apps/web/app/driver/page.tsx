'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Phone, MapPin, Clock } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default function DriverDashboard() {
  // Mock active incident
  const activeIncident = {
    id: '1',
    type: 'Tire Blowout',
    location: 'I-95 Mile Marker 120, New Jersey',
    eta: '12 min',
    status: 'vendor_en_route' as const,
    vendor: 'Mike\'s Towing Service',
    vendorPhone: '+1-201-555-0123',
  }

  // Mock recent incidents
  const recentIncidents = [
    {
      id: '1',
      type: 'Tire Blowout',
      vendor: 'Mike\'s Towing',
      date: new Date(),
      cost: '$85',
      status: 'vendor_en_route' as const,
    },
    {
      id: '2',
      type: 'Engine Overheating',
      vendor: 'Quick Fix Mechanics',
      date: new Date(Date.now() - 86400000),
      cost: '$150',
      status: 'closed' as const,
    },
    {
      id: '3',
      type: 'Jump Start',
      vendor: 'Road Rescue',
      date: new Date(Date.now() - 172800000),
      cost: '$45',
      status: 'closed' as const,
    },
  ]

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Emergency Help Button - PROMINENT */}
      <div className="md:hidden sticky top-16 z-40 bg-black pb-4 pt-2">
        <Button 
          size="lg"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold text-lg h-16 rounded-lg shadow-lg"
        >
          <Phone className="w-6 h-6 mr-3" />
          Call for Help Now
        </Button>
      </div>

      {/* Active Incident Card - Mobile Optimized */}
      {activeIncident && (
        <Card className="bg-gradient-to-br from-blue-600 to-blue-700 text-white border-0">
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <h3 className="text-lg font-bold">{activeIncident.type}</h3>
              <div className="flex items-center gap-2 text-sm opacity-90">
                <MapPin className="w-4 h-4 flex-shrink-0" />
                <span>{activeIncident.location}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/20 rounded-lg p-3">
                <p className="text-xs opacity-80">ETA</p>
                <p className="text-2xl font-bold">{activeIncident.eta}</p>
              </div>
              <div className="bg-white/20 rounded-lg p-3">
                <p className="text-xs opacity-80">Status</p>
                <p className="text-lg font-bold capitalize">{activeIncident.status.replace('_', ' ')}</p>
              </div>
            </div>

            <div className="bg-white/10 rounded-lg p-3">
              <p className="text-xs opacity-80 mb-1">Service Provider</p>
              <p className="font-bold mb-2">{activeIncident.vendor}</p>
              <Button 
                size="sm"
                className="w-full bg-white text-blue-600 hover:bg-gray-100 font-bold"
                onClick={() => window.location.href = `tel:${activeIncident.vendorPhone}`}
              >
                <Phone className="w-4 h-4 mr-2" />
                Call Provider
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Grid - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm opacity-90 mb-1">Total Incidents</p>
            <p className="text-2xl md:text-3xl font-bold">24</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm opacity-90 mb-1">Avg Response</p>
            <p className="text-2xl md:text-3xl font-bold">15 min</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm opacity-90 mb-1">This Month</p>
            <p className="text-2xl md:text-3xl font-bold">8</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
          <CardContent className="p-4 md:p-6">
            <p className="text-xs md:text-sm opacity-90 mb-1">Total Cost</p>
            <p className="text-2xl md:text-3xl font-bold">$1.2K</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Incidents - Mobile Optimized */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg md:text-xl">Recent Incidents</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {recentIncidents.map((incident) => (
            <Link key={incident.id} href={`/driver/incidents/${incident.id}`}>
              <div className="p-3 md:p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <h4 className="font-semibold text-sm md:text-base">{incident.type}</h4>
                    <p className="text-xs md:text-sm text-gray-500">{incident.vendor}</p>
                  </div>
                  <Badge 
                    className={incident.status === 'closed' ? 'bg-green-600' : 'bg-blue-600'}
                  >
                    {incident.status === 'closed' ? 'Done' : 'Active'}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-xs md:text-sm text-gray-600">
                  <span>{format(incident.date, 'MMM d, h:mm a')}</span>
                  <span className="font-bold">{incident.cost}</span>
                </div>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

      {/* Quick Links - Mobile Optimized */}
      <div className="grid grid-cols-2 gap-2 md:gap-3">
        <Link href="/driver/find-help" className="w-full">
          <Button variant="outline" className="w-full h-12 md:h-14">
            <MapPin className="w-4 h-4 mr-2" />
            <span className="text-sm md:text-base">Find Help</span>
          </Button>
        </Link>
        <Link href="/driver/track" className="w-full">
          <Button variant="outline" className="w-full h-12 md:h-14">
            <Clock className="w-4 h-4 mr-2" />
            <span className="text-sm md:text-base">Track Service</span>
          </Button>
        </Link>
      </div>
    </div>
  )
}
