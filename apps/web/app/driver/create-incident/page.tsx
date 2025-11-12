'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'
import { Wrench, Truck as TruckIcon, Anchor } from 'lucide-react'

export default function CreateIncidentPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [selectedType, setSelectedType] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [location, setLocation] = useState<{ lat: number; lon: number } | null>(null)

  const incidentTypes = [
    { value: 'tire', label: 'Tire Issue', icon: Anchor, description: 'Flat tire, blowout, or tire damage' },
    { value: 'engine', label: 'Engine Problem', icon: Wrench, description: 'Engine failure, overheating, or mechanical issues' },
    { value: 'tow', label: 'Towing Needed', icon: TruckIcon, description: 'Vehicle needs to be towed' },
  ]

  const getCurrentLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lon: position.coords.longitude,
          })
          toast({
            title: 'Location captured',
            description: 'Your current location has been recorded',
          })
        },
        () => {
          toast({
            title: 'Location error',
            description: 'Unable to get your location. Please enable location services.',
            variant: 'destructive',
          })
        }
      )
    }
  }

  const handleSubmit = async () => {
    if (!selectedType) {
      toast({
        title: 'Select incident type',
        description: 'Please select the type of assistance you need',
        variant: 'destructive',
      })
      return
    }

    if (!location) {
      toast({
        title: 'Location required',
        description: 'Please capture your current location',
        variant: 'destructive',
      })
      return
    }

    try {
      setLoading(true)
      const incident = await apiClient.post<{ incidentId: string }>('/incidents', {
        type: selectedType,
        location,
      })

      toast({
        title: 'Incident created',
        description: 'We are finding the best vendor for you',
      })

      router.push(`/driver/incidents/${incident.incidentId}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to create incident. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Create New Incident</h2>
        <p className="text-muted-foreground">
          Tell us what kind of assistance you need
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Incident Type</CardTitle>
          <CardDescription>Select the type of roadside assistance you need</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4">
            {incidentTypes.map((type) => {
              const Icon = type.icon
              return (
                <button
                  key={type.value}
                  onClick={() => setSelectedType(type.value)}
                  className={`p-4 border-2 rounded-lg text-left transition-all hover:border-primary ${
                    selectedType === type.value
                      ? 'border-primary bg-primary/5'
                      : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-start space-x-3">
                    <Icon className="w-6 h-6 mt-1" />
                    <div>
                      <h3 className="font-semibold">{type.label}</h3>
                      <p className="text-sm text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Location</CardTitle>
          <CardDescription>We need your current location to find nearby vendors</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {location ? (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm font-medium text-green-900">Location captured</p>
              <p className="text-xs text-green-700 mt-1">
                {location.lat.toFixed(6)}, {location.lon.toFixed(6)}
              </p>
            </div>
          ) : (
            <Button onClick={getCurrentLocation} variant="outline" className="w-full">
              Capture Current Location
            </Button>
          )}
        </CardContent>
      </Card>

      <div className="flex space-x-4">
        <Button
          onClick={() => router.back()}
          variant="outline"
          className="flex-1"
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={loading || !selectedType || !location}
          className="flex-1"
        >
          {loading ? 'Creating...' : 'Create Incident'}
        </Button>
      </div>
    </div>
  )
}
