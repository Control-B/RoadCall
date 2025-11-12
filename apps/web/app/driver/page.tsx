'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { Incident } from '@/types'
import { getStatusColor, getStatusLabel, getIncidentTypeLabel } from '@/lib/utils'
import { Clock, MapPin, Wrench } from 'lucide-react'
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
      const data = await apiClient.get<Incident[]>('/incidents?status=active')
      setIncidents(data)
    } catch (error) {
      console.error('Failed to load incidents:', error)
    } finally {
      setLoading(false)
    }
  }

  const activeIncidents = incidents.filter(
    (i) => !['closed', 'cancelled'].includes(i.status)
  )
  const completedIncidents = incidents.filter((i) =>
    ['closed', 'cancelled'].includes(i.status)
  )

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
        <h2 className="text-3xl font-bold tracking-tight">My Incidents</h2>
        <p className="text-muted-foreground">
          Track and manage your roadside assistance requests
        </p>
      </div>

      <Tabs defaultValue="active" className="space-y-4">
        <TabsList>
          <TabsTrigger value="active">
            Active ({activeIncidents.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedIncidents.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4">
          {activeIncidents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No active incidents</p>
              </CardContent>
            </Card>
          ) : (
            activeIncidents.map((incident) => (
              <IncidentCard key={incident.incidentId} incident={incident} />
            ))
          )}
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {completedIncidents.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <p className="text-muted-foreground">No completed incidents</p>
              </CardContent>
            </Card>
          ) : (
            completedIncidents.map((incident) => (
              <IncidentCard key={incident.incidentId} incident={incident} />
            ))
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function IncidentCard({ incident }: { incident: Incident }) {
  return (
    <Link href={`/driver/incidents/${incident.incidentId}`}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center space-x-2">
                <Wrench className="w-5 h-5" />
                <span>{getIncidentTypeLabel(incident.type)}</span>
              </CardTitle>
              <CardDescription>
                Created {format(new Date(incident.createdAt), 'PPp')}
              </CardDescription>
            </div>
            <Badge className={getStatusColor(incident.status)}>
              {getStatusLabel(incident.status)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <MapPin className="w-4 h-4 mr-2" />
            {incident.location.address || `${incident.location.lat}, ${incident.location.lon}`}
          </div>
          {incident.assignedVendorName && (
            <div className="flex items-center text-sm">
              <Clock className="w-4 h-4 mr-2" />
              Vendor: {incident.assignedVendorName}
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  )
}
