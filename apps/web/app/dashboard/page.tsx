'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { Incident } from '@/types'
import { getStatusColor, getStatusLabel, getIncidentTypeLabel } from '@/lib/utils'
import { Clock, MapPin, Wrench, TrendingUp, Phone, FileText, Plus } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default function DriverDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadIncidents()
  }, [])

  const loadIncidents = async () => {
    try {
      // Mock data for now - replace with actual API call
      const mockIncidents: Incident[] = [
        {
          incidentId: '1',
          driverId: 'driver-1',
          type: 'tire',
          status: 'in_progress',
          location: { lat: 40.7128, lon: -74.0060, address: 'I-95 Mile Marker 120' },
          createdAt: new Date().toISOString(),
          assignedVendorName: "Mike's Towing"
        },
        {
          incidentId: '2',
          driverId: 'driver-1',
          type: 'engine',
          status: 'closed',
          location: { lat: 40.7128, lon: -74.0060, address: 'I-80 Exit 45' },
          createdAt: new Date(Date.now() - 86400000).toISOString(),
          assignedVendorName: "Quick Fix Mechanics"
        }
      ]
      setIncidents(mockIncidents)
    } catch (error) {
      console.error('Failed to load incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeIncidents = incidents.filter(
    (i) => !['closed', 'cancelled'].includes(i.status)
  )

  // Mock analytics data
  const analytics = {
    totalIncidents: 24,
    avgResponseTime: '15 min',
    totalCost: '$1,245',
    thisMonth: 8
  }

  // Mock call transcripts/summaries
  const callSummaries = [
    {
      id: '1',
      date: new Date(),
      incidentType: 'Tire Blowout',
      summary: 'Driver called in reporting flat tire on I-95 northbound near mile marker 120. AI extracted location and urgency. Nearest tire service provider notified and accepted job with 15-minute ETA.',
      sentiment: 'frustrated',
      urgency: 'high',
      duration: '3:45'
    },
    {
      id: '2',
      date: new Date(Date.now() - 86400000),
      incidentType: 'Engine Overheating',
      summary: 'Inbound call: Engine temperature warning light activated. AI confirmed driver safely pulled over at rest stop. Qualified mechanic dispatched to diagnose cooling system issue.',
      sentiment: 'calm',
      urgency: 'medium',
      duration: '2:20'
    },
    {
      id: '3',
      date: new Date(Date.now() - 172800000),
      incidentType: 'Towing Request',
      summary: 'Call received: Vehicle won\'t start after delivery. AI identified dead battery as likely cause. Nearest tow company alerted and accepted transport to service center.',
      sentiment: 'neutral',
      urgency: 'medium',
      duration: '4:10'
    }
  ]

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Dispatch Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor AI call center activity, track incidents, and review call transcripts
          </p>
        </div>
        <Button size="lg" className="bg-green-600 hover:bg-green-700">
          <Phone className="w-5 h-5 mr-2" />
          Call Roadside Support
        </Button>
      </div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Analytics */}
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            {/* Total Calls - Blue */}
            <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Phone className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Total Calls</p>
                <p className="text-4xl font-bold mb-1">{analytics.totalIncidents}</p>
                <p className="text-xs opacity-80">↑ {analytics.thisMonth} this month</p>
              </CardContent>
            </Card>

            {/* Avg Dispatch Time - Green */}
            <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Clock className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Avg Dispatch</p>
                <p className="text-4xl font-bold mb-1">{analytics.avgResponseTime}</p>
                <p className="text-xs opacity-80">↓ 5% faster</p>
              </CardContent>
            </Card>

            {/* Total Cost - Purple */}
            <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-2xl opacity-80">💰</span>
                </div>
                <p className="text-sm opacity-90 mb-1">Total Cost</p>
                <p className="text-4xl font-bold mb-1">{analytics.totalCost}</p>
                <p className="text-xs opacity-80">Last 30 days</p>
              </CardContent>
            </Card>

            {/* Active Dispatches - Orange */}
            <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white border-0">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <Wrench className="w-8 h-8 opacity-80" />
                </div>
                <p className="text-sm opacity-90 mb-1">Active Dispatches</p>
                <p className="text-4xl font-bold mb-1">{activeIncidents.length}</p>
                <p className="text-xs opacity-80">Providers en route</p>
              </CardContent>
            </Card>
          </div>

          {/* Active Incidents */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Wrench className="w-5 h-5" />
                <span>Active Dispatches</span>
              </CardTitle>
              <CardDescription>Providers en route or working</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeIncidents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">No active incidents</p>
              ) : (
                activeIncidents.map((incident) => (
                  <Link key={incident.incidentId} href={`/driver/incidents/${incident.incidentId}`}>
                    <div className="p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <Wrench className="w-4 h-4 text-blue-600" />
                          <span className="font-semibold">{getIncidentTypeLabel(incident.type)}</span>
                        </div>
                        <Badge className={getStatusColor(incident.status)}>
                          {getStatusLabel(incident.status)}
                        </Badge>
                      </div>
                      <div className="flex items-center text-sm text-muted-foreground mb-1">
                        <MapPin className="w-3 h-3 mr-1" />
                        {incident.location.address}
                      </div>
                      {incident.assignedVendorName && (
                        <div className="flex items-center text-sm text-muted-foreground">
                          <Clock className="w-3 h-3 mr-1" />
                          Provider: {incident.assignedVendorName}
                        </div>
                      )}
                    </div>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Call Transcripts/Summaries */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Phone className="w-5 h-5" />
                <span>Recent Call Transcripts</span>
              </CardTitle>
              <CardDescription>AI-transcribed and summarized driver calls</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {callSummaries.map((call, index) => {
                const borderColors = ['border-blue-500', 'border-purple-500', 'border-green-500']
                const bgColors = ['bg-blue-50', 'bg-purple-50', 'bg-green-50']
                return (
                  <div key={call.id} className={`border-l-4 ${borderColors[index % 3]} ${bgColors[index % 3]} pl-4 py-3 rounded-r-lg`}>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-sm">{call.incidentType}</h4>
                        <p className="text-xs text-muted-foreground">
                          {format(call.date, 'MMM d, yyyy h:mm a')} • {call.duration}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Badge variant={call.urgency === 'high' ? 'destructive' : 'secondary'} className={
                          call.urgency === 'high' ? 'bg-red-500' : 'bg-amber-500 text-white'
                        }>
                          {call.urgency}
                        </Badge>
                        <Badge variant="outline" className={
                          call.sentiment === 'frustrated' ? 'border-red-400 bg-red-50 text-red-700' :
                          call.sentiment === 'calm' ? 'border-green-400 bg-green-50 text-green-700' :
                          'border-gray-400 bg-gray-50 text-gray-700'
                        }>
                          {call.sentiment === 'frustrated' ? '😟' : call.sentiment === 'calm' ? '😊' : '😐'}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed mb-2">
                      {call.summary}
                    </p>
                    <Button variant="ghost" size="sm" className="text-xs hover:bg-white/50">
                      <FileText className="w-3 h-3 mr-1" />
                      View Full Transcript
                    </Button>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card className="bg-gradient-to-br from-gray-50 to-gray-100 border-gray-200">
            <CardHeader>
              <CardTitle className="text-gray-900">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/driver/incidents">
                <Button variant="outline" className="w-full justify-start bg-white hover:bg-gray-50">
                  <FileText className="w-4 h-4 mr-2 text-blue-600" />
                  View All Call Transcripts
                </Button>
              </Link>
              <Button variant="outline" className="w-full justify-start bg-white hover:bg-gray-50">
                <Phone className="w-4 h-4 mr-2 text-green-600" />
                Call AI Dispatch Center
              </Button>
              <Link href="/test-call-center">
                <Button variant="outline" className="w-full justify-start bg-white hover:bg-gray-50">
                  <Phone className="w-4 h-4 mr-2 text-purple-600" />
                  Test Call Center
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
