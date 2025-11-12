'use client'

import { useEffect, useRef, useState } from 'react'
import maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { awsConfig } from '@/lib/aws-config'
import { LocationPoint } from '@/types'

interface IncidentMapProps {
  driverLocation: LocationPoint
  vendorLocation?: LocationPoint
  vendorRoute?: LocationPoint[]
}

export function IncidentMap({ driverLocation, vendorLocation, vendorRoute }: IncidentMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null)
  const map = useRef<maplibregl.Map | null>(null)
  const [mapLoaded, setMapLoaded] = useState(false)

  useEffect(() => {
    if (!mapContainer.current || map.current) return

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://maps.geo.${awsConfig.region}.amazonaws.com/maps/v0/maps/${awsConfig.locationMapName}/style-descriptor`,
      center: [driverLocation.lon, driverLocation.lat],
      zoom: 12,
    })

    map.current.on('load', () => {
      setMapLoaded(true)
    })

    // Add driver marker
    new maplibregl.Marker({ color: '#3b82f6' })
      .setLngLat([driverLocation.lon, driverLocation.lat])
      .setPopup(new maplibregl.Popup().setHTML('<p>Your Location</p>'))
      .addTo(map.current)

    return () => {
      map.current?.remove()
    }
  }, [driverLocation])

  useEffect(() => {
    if (!map.current || !mapLoaded || !vendorLocation) return

    // Add vendor marker
    const vendorMarker = new maplibregl.Marker({ color: '#10b981' })
      .setLngLat([vendorLocation.lon, vendorLocation.lat])
      .setPopup(new maplibregl.Popup().setHTML('<p>Vendor Location</p>'))
      .addTo(map.current)

    // Draw route if available
    if (vendorRoute && vendorRoute.length > 0) {
      const coordinates = vendorRoute.map((point) => [point.lon, point.lat])

      if (map.current.getSource('route')) {
        ;(map.current.getSource('route') as maplibregl.GeoJSONSource).setData({
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates,
          },
        })
      } else {
        map.current.addSource('route', {
          type: 'geojson',
          data: {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates,
            },
          },
        })

        map.current.addLayer({
          id: 'route',
          type: 'line',
          source: 'route',
          layout: {
            'line-join': 'round',
            'line-cap': 'round',
          },
          paint: {
            'line-color': '#10b981',
            'line-width': 4,
          },
        })
      }

      // Fit bounds to show both locations
      const bounds = new maplibregl.LngLatBounds()
      bounds.extend([driverLocation.lon, driverLocation.lat])
      bounds.extend([vendorLocation.lon, vendorLocation.lat])
      map.current.fitBounds(bounds, { padding: 50 })
    }

    return () => {
      vendorMarker.remove()
    }
  }, [vendorLocation, vendorRoute, mapLoaded, driverLocation])

  return <div ref={mapContainer} className="w-full h-[500px] rounded-lg" />
}
