'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { apiClient } from '@/lib/api-client'
import { useToast } from '@/components/ui/use-toast'
import { Offer } from '@/types'
import { Clock, DollarSign, CheckCircle, XCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'

export default function VendorOffersPage() {
  const [offers, setOffers] = useState<Offer[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    loadOffers()
    const interval = setInterval(loadOffers, 10000) // Poll every 10 seconds
    return () => clearInterval(interval)
  }, [])

  const loadOffers = async () => {
    try {
      const data = await apiClient.get<Offer[]>('/offers?status=pending')
      setOffers(data)
    } catch (error) {
      console.error('Failed to load offers:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleAccept = async (offerId: string) => {
    try {
      await apiClient.post(`/offers/${offerId}/accept`, {})
      toast({
        title: 'Offer accepted',
        description: 'You have been assigned to this incident',
      })
      loadOffers()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to accept offer. It may have expired.',
        variant: 'destructive',
      })
    }
  }

  const handleDecline = async (offerId: string) => {
    try {
      await apiClient.post(`/offers/${offerId}/decline`, {
        reason: 'Not available',
      })
      toast({
        title: 'Offer declined',
      })
      loadOffers()
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to decline offer',
        variant: 'destructive',
      })
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
        <h2 className="text-3xl font-bold tracking-tight">Pending Offers</h2>
        <p className="text-muted-foreground">
          Review and accept job offers from drivers
        </p>
      </div>

      {offers.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No pending offers</p>
            <p className="text-sm text-muted-foreground mt-2">
              New offers will appear here when drivers need assistance
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {offers.map((offer) => (
            <OfferCard
              key={offer.offerId}
              offer={offer}
              onAccept={handleAccept}
              onDecline={handleDecline}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function OfferCard({
  offer,
  onAccept,
  onDecline,
}: {
  offer: Offer
  onAccept: (id: string) => void
  onDecline: (id: string) => void
}) {
  const [timeLeft, setTimeLeft] = useState<number>(0)

  useEffect(() => {
    const updateTimeLeft = () => {
      const remaining = Math.max(0, offer.expiresAt - Date.now())
      setTimeLeft(remaining)
    }

    updateTimeLeft()
    const interval = setInterval(updateTimeLeft, 1000)
    return () => clearInterval(interval)
  }, [offer.expiresAt])

  const minutes = Math.floor(timeLeft / 60000)
  const seconds = Math.floor((timeLeft % 60000) / 1000)

  return (
    <Card className="border-2 border-orange-200 bg-orange-50/50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center space-x-2">
              <span>New Job Offer</span>
              <Badge variant="destructive">
                {minutes}:{seconds.toString().padStart(2, '0')}
              </Badge>
            </CardTitle>
            <CardDescription>
              Match Score: {(offer.matchScore * 100).toFixed(0)}%
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <div className="flex items-center text-sm">
            <DollarSign className="w-4 h-4 mr-2 text-green-600" />
            <span className="font-semibold">
              Estimated Payout: ${(offer.estimatedPayout / 100).toFixed(2)}
            </span>
          </div>
          <div className="flex items-center text-sm text-muted-foreground">
            <Clock className="w-4 h-4 mr-2" />
            Created {formatDistanceToNow(new Date(offer.createdAt), { addSuffix: true })}
          </div>
        </div>

        <div className="flex space-x-3">
          <Button
            onClick={() => onAccept(offer.offerId)}
            className="flex-1 bg-green-600 hover:bg-green-700"
            disabled={timeLeft === 0}
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Accept
          </Button>
          <Button
            onClick={() => onDecline(offer.offerId)}
            variant="outline"
            className="flex-1"
            disabled={timeLeft === 0}
          >
            <XCircle className="w-4 h-4 mr-2" />
            Decline
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
