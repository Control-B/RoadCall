'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import { Incident } from '@/types'
import { getStatusColor, getStatusLabel, getIncidentTypeLabel } from '@/lib/utils'
import { MapPin, Clock, Navigation } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

export default function VendorJobsPage() {
  const [jobs, setJobs] = useState<Incident[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadJobs()
  }, [])

  const loadJobs = async () => {
    try {
      const data = await apiClient.get<Incident[]>('/incidents?vendorId=me&status=active')
      setJobs(data)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

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
        <h2 className="text-3xl font-bold tracking-tight">My Jobs</h2>
        <p className="text-muted-foreground">
          Active and completed service jobs
        </p>
      </div>

      {jobs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No active jobs</p>
            <p className="text-sm text-muted-foreground mt-2">
              Accepted offers will appear here
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {jobs.map((job) => (
            <Card key={job.incidentId}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center space-x-2">
                      <span>{getIncidentTypeLabel(job.type)}</span>
                    </CardTitle>
                    <CardDescription>
                      Started {format(new Date(job.createdAt), 'PPp')}
                    </CardDescription>
                  </div>
                  <Badge className={getStatusColor(job.status)}>
                    {getStatusLabel(job.status)}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3">
                  <div className="flex items-center text-sm">
                    <MapPin className="w-4 h-4 mr-2 text-muted-foreground" />
                    {job.location.address || `${job.location.lat}, ${job.location.lon}`}
                  </div>
                  <div className="flex items-center text-sm text-muted-foreground">
                    <Clock className="w-4 h-4 mr-2" />
                    Driver: {job.driverName || 'Unknown'}
                  </div>
                </div>

                <div className="flex space-x-3">
                  <Link href={`/vendor/jobs/${job.incidentId}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                      View Details
                    </Button>
                  </Link>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700">
                    <Navigation className="w-4 h-4 mr-2" />
                    Navigate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
