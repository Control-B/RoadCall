'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { useSubscription, gql } from '@apollo/client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { Incident, TrackingSession } from '@/types'
import { getStatusColor, getStatusLabel, getIncidentTypeLabel } from '@/lib/utils'
import { Clock, MapPin, User } from 'lucide-react'
import { format } from 'date-fns'
import { IncidentMap } from '@/components/map/incident-map'

const TRACKING_SUBSCRIPTION = gql`
  subscription OnIncidentTracking($incidentId: ID!) {
    onIncidentTracking(incidentId: $incidentId) {
      sessionId
      incidentId
      status
      vendorLocation {
        lat
        lon
        timestamp
      }
      vendorRoute {
        lat
        lon
        timestamp
      }
      eta {
        minutes
        distanceMiles
        arrivalTime
      }
      updatedAt
    }
  }
`

export default function IncidentDetailPage() {
  const params = useParams()
  const incidentId = params.id as string
  const [incident, setIncident] = useState<Incident | null>(null)
  const [loading, setLoading] = useState(true)

  const { data: trackingData } = useSubscription<{ onIncidentTracking: TrackingSession }>(
    TRACKING_SUBSCRIPTION,
    {
      variables: { incidentId },
      skip: !incident?.assignedVendorId,
    }
  )

  useEffect(() => {
    const loadIncident = async () => {
      try {
        const data = await apiClient.get<Incident>(`/incidents/${incidentId}`)
        setIncident(data)
      } catch (error) {
        console.error('Failed to load incident:', error)
      } finally {
        setLoading(false)
      }
    }

    loadIncident()
  }, [incidentId])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!incident) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-muted-foreground">Incident not found</p>
        </CardContent>
      </Card>
    )
  }

  const trackingSession = trackingData?.onIncidentTracking

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">
            {getIncidentTypeLabel(incident.type)}
          </h2>
          <p className="text-muted-foreground">
            Created {format(new Date(incident.createdAt), 'PPp')}
          </p>
        </div>
        <Badge className={getStatusColor(incident.status)}>
          {getStatusLabel(incident.status)}
        </Badge>
      </div>

      {trackingSession && trackingSession.vendorLocation && (
        <Card>
          <CardHeader>
            <CardTitle>Live Tracking</CardTitle>
            <CardDescription>
              {trackingSession.eta && (
                <span>
                  ETA: {trackingSession.eta.minutes} minutes ({trackingSession.eta.distanceMiles.toFixed(1)} miles)
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <IncidentMap
              driverLocation={{
                lat: incident.location.lat,
                lon: incident.location.lon,
                timestamp: new Date().toISOString(),
              }}
              vendorLocation={trackingSession.vendorLocation}
              vendorRoute={trackingSession.vendorRoute}
            />
          </CardContent>
        </Card>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Incident Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start space-x-3">
              <MapPin className="w-5 h-5 mt-0.5 text-muted-foreground" />
              <div>
                <p className="font-medium">Location</p>
                <p className="text-sm text-muted-foreground">
                  {incident.location.address || `${incident.location.lat}, ${incident.location.lon}`}
                </p>
              </div>
            </div>

            {incident.weather && (
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Weather Conditions</p>
                  <p className="text-sm text-muted-foreground">
                    {incident.weather.condition}, {incident.weather.temperature}°F
                  </p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {incident.assignedVendorName && (
          <Card>
            <CardHeader>
              <CardTitle>Assigned Vendor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start space-x-3">
                <User className="w-5 h-5 mt-0.5 text-muted-foreground" />
                <div>
                  <p className="font-medium">{incident.assignedVendorName}</p>
                  <p className="text-sm text-muted-foreground">Service Provider</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {incident.timeline.map((transition, index) => (
              <div key={index} className="flex items-start space-x-3">
                <div className="w-2 h-2 mt-2 rounded-full bg-primary" />
                <div>
                  <p className="font-medium">{getStatusLabel(transition.to)}</p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(transition.timestamp), 'PPp')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
