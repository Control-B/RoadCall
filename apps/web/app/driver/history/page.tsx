'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Clock, MapPin, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default function HistoryPage() {
  const incidents = [
    {
      id: '1',
      type: 'Tire Blowout',
      vendor: "Mike's Towing Service",
      date: new Date(),
      cost: '$85',
      status: 'closed' as const,
      location: 'I-95 Mile Marker 120, NJ',
      rating: 4.8,
      duration: '45 min',
    },
    {
      id: '2',
      type: 'Engine Overheating',
      vendor: 'Quick Fix Mechanics',
      date: new Date(Date.now() - 86400000),
      cost: '$150',
      status: 'closed' as const,
      location: 'I-80 Exit 45, NJ',
      rating: 4.6,
      duration: '1h 20min',
    },
    {
      id: '3',
      type: 'Jump Start',
      vendor: 'Road Rescue Assistance',
      date: new Date(Date.now() - 172800000),
      cost: '$45',
      status: 'closed' as const,
      location: 'Route 1, Princeton, NJ',
      rating: 4.9,
      duration: '20 min',
    },
    {
      id: '4',
      type: 'Lockout Service',
      vendor: 'Elite Auto Care',
      date: new Date(Date.now() - 259200000),
      cost: '$75',
      status: 'closed' as const,
      location: 'NYC, NY',
      rating: 4.7,
      duration: '30 min',
    },
    {
      id: '5',
      type: 'Fuel Delivery',
      vendor: "Mike's Towing Service",
      date: new Date(Date.now() - 345600000),
      cost: '$35 + fuel',
      status: 'closed' as const,
      location: 'I-95 Mile Marker 100, NJ',
      rating: 4.8,
      duration: '25 min',
    },
  ]

  return (
    <div className="space-y-4">
      {/* Search Header */}
      <div className="md:hidden sticky top-16 z-30 bg-black p-4 border-b border-gray-800">
        <h1 className="text-white text-2xl font-bold mb-3">History</h1>
        <Input 
          placeholder="Search incidents..."
          className="bg-gray-900 border-gray-700 text-white placeholder-gray-500"
        />
      </div>

      {/* Desktop Header */}
      <div className="hidden md:block mb-6">
        <h1 className="text-3xl font-bold mb-4">Incident History</h1>
        <p className="text-gray-600 mb-4">View your past service requests and incidents</p>
        <Input 
          placeholder="Search incidents..."
          className="max-w-sm"
        />
      </div>

      {/* Stats Bar - Mobile */}
      <div className="md:hidden grid grid-cols-3 gap-2 px-4">
        <div className="bg-blue-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-blue-600">{incidents.length}</p>
          <p className="text-xs text-gray-600">Total</p>
        </div>
        <div className="bg-green-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-green-600">$385</p>
          <p className="text-xs text-gray-600">Spent</p>
        </div>
        <div className="bg-purple-50 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-purple-600">4.8</p>
          <p className="text-xs text-gray-600">Avg Rating</p>
        </div>
      </div>

      {/* Incidents Timeline */}
      <div className="space-y-3">
        {incidents.map((incident, index) => (
          <Card key={incident.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardContent className="p-0">
              {/* Timeline connector line - visible on desktop */}
              {index < incidents.length - 1 && (
                <div className="hidden md:block absolute left-8 top-full h-8 border-l-2 border-gray-200"></div>
              )}

              <div className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm md:text-base">{incident.type}</h3>
                    <p className="text-xs text-gray-500 mt-1">{incident.vendor}</p>
                  </div>
                  <div className="text-right">
                    <Badge className="bg-green-600 mb-1 block">{incident.status === 'closed' ? 'Completed' : 'Closed'}</Badge>
                    <p className="text-xs font-semibold text-gray-900">{incident.cost}</p>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{format(incident.date, 'MMM d, h:mm a')}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600">
                    <Clock className="w-4 h-4" />
                    <span>{incident.duration}</span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-600 col-span-2">
                    <MapPin className="w-4 h-4" />
                    <span>{incident.location}</span>
                  </div>
                </div>

                {/* Rating Row */}
                <div className="flex items-center justify-between pt-3 border-t">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-semibold">{incident.rating}</span>
                        <span className="text-yellow-400">★</span>
                      </div>
                      <p className="text-xs text-gray-500">Your rating</p>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 md:hidden" />
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="hidden md:inline-flex"
                  >
                    View Details
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      {incidents.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <Clock className="w-12 h-12 mx-auto text-gray-400 mb-3 opacity-50" />
            <h3 className="font-semibold text-gray-900 mb-1">No incidents yet</h3>
            <p className="text-sm text-gray-600 mb-4">
              Your past service requests will appear here
            </p>
            <Link href="/driver/find-help">
              <Button className="bg-blue-600 hover:bg-blue-700">
                Request Service Now
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Help Section */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="p-4">
          <p className="text-sm font-semibold text-blue-900 mb-2">💡 Did you know?</p>
          <p className="text-sm text-blue-800">
            You can use your incident history to track spending, review provider ratings, and plan future maintenance.
          </p>
        </CardContent>
      </Card>

      {/* Spacing for mobile nav */}
      <div className="md:hidden h-20"></div>
    </div>
  )
}
