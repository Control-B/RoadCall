'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { Incident } from '@/types'
import { getStatusColor, getStatusLabel, getIncidentTypeLabel } from '@/lib/utils'
import { Clock, User } from 'lucide-react'
import { format } from 'date-fns'
import { IncidentMap } from '@/components/map/incident-map'

export default function DispatcherDashboard() {
  const [incidents, setIncidents] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIncident, setSelectedIncident] = useState<Incident | null>(null)

  useEffect(() => {
    const loadIncidents = async () => {
      try {
        const data = await apiClient.get<Incident[]>('/incidents?status=active')
        setIncidents(data)
        if (!selectedIncident && data.length > 0) {
          setSelectedIncident(data[0])
        }
      } catch (error) {
        console.error('Failed to load incidents:', error)
      } finally {
        setLoading(false)
      }
    }

    loadIncidents()
    const interval = setInterval(loadIncidents, 5000) // Poll every 5 seconds
    return () => clearInterval(interval)
  }, [selectedIncident])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Live Incident Queue</h2>
        <p className="text-muted-foreground">
          Monitor and manage all active incidents
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Active Incidents ({incidents.length})</CardTitle>
              <CardDescription>Real-time incident monitoring</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-[600px] overflow-y-auto">
              {incidents.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No active incidents
                </p>
              ) : (
                incidents.map((incident) => (
                  <button
                    key={incident.incidentId}
                    onClick={() => setSelectedIncident(incident)}
                    className={`w-full text-left p-4 border rounded-lg transition-all ${
                      selectedIncident?.incidentId === incident.incidentId
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="font-semibold">
                        {getIncidentTypeLabel(incident.type)}
                      </span>
                      <Badge className={getStatusColor(incident.status)}>
                        {getStatusLabel(incident.status)}
                      </Badge>
                    </div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex items-center">
                        <User className="w-3 h-3 mr-2" />
                        {incident.driverName || 'Unknown Driver'}
                      </div>
                      <div className="flex items-center">
                        <Clock className="w-3 h-3 mr-2" />
                        {format(new Date(incident.createdAt), 'p')}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {selectedIncident ? (
            <>
              <Card>
                <CardHeader>
                  <CardTitle>Incident Details</CardTitle>
                  <CardDescription>
                    {getIncidentTypeLabel(selectedIncident.type)} - {selectedIncident.incidentId}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3">
                    <div>
                      <p className="text-sm font-medium">Driver</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.driverName || 'Unknown'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Location</p>
                      <p className="text-sm text-muted-foreground">
                        {selectedIncident.location.address ||
                          `${selectedIncident.location.lat}, ${selectedIncident.location.lon}`}
                      </p>
                    </div>
                    {selectedIncident.assignedVendorName && (
                      <div>
                        <p className="text-sm font-medium">Assigned Vendor</p>
                        <p className="text-sm text-muted-foreground">
                          {selectedIncident.assignedVendorName}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-medium">Status</p>
                      <Badge className={getStatusColor(selectedIncident.status)}>
                        {getStatusLabel(selectedIncident.status)}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Map View</CardTitle>
                </CardHeader>
                <CardContent>
                  <IncidentMap
                    driverLocation={{
                      lat: selectedIncident.location.lat,
                      lon: selectedIncident.location.lon,
                      timestamp: new Date().toISOString(),
                    }}
                  />
                </CardContent>
              </Card>
            </>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">
                  Select an incident to view details
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
