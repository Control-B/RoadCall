import {
  LocationClient,
  SearchPlaceIndexForPositionCommand,
  CalculateRouteCommand,
} from '@aws-sdk/client-location';
import { IncidentLocation, WeatherCondition } from '@roadcall/types';
import { logger, ValidationError } from '@roadcall/utils';

const locationClient = new LocationClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

const PLACE_INDEX_NAME = process.env.PLACE_INDEX_NAME || 'roadcall-places';
const ROUTE_CALCULATOR_NAME = process.env.ROUTE_CALCULATOR_NAME || 'roadcall-routes';
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || '';

/**
 * Geocode coordinates to address
 */
export async function geocodeLocation(lat: number, lon: number): Promise<string> {
  try {
    const command = new SearchPlaceIndexForPositionCommand({
      IndexName: PLACE_INDEX_NAME,
      Position: [lon, lat], // AWS Location uses [longitude, latitude]
      MaxResults: 1,
    });

    const response = await locationClient.send(command);

    if (response.Results && response.Results.length > 0) {
      const place = response.Results[0].Place;
      const addressParts = [
        place?.Street,
        place?.Municipality,
        place?.Region,
        place?.PostalCode,
        place?.Country,
      ].filter(Boolean);

      const address = addressParts.join(', ');
      logger.info('Location geocoded', { lat, lon, address });
      return address;
    }

    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  } catch (error) {
    logger.error('Geocoding failed', error as Error, { lat, lon });
    return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
  }
}

/**
 * Snap coordinates to nearest road
 */
export async function snapToRoad(lat: number, lon: number): Promise<{ lat: number; lon: number }> {
  try {
    // Use route calculation with same start and end point to snap to road
    const command = new CalculateRouteCommand({
      CalculatorName: ROUTE_CALCULATOR_NAME,
      DeparturePosition: [lon, lat],
      DestinationPosition: [lon, lat],
      TravelMode: 'Car',
    });

    const response = await locationClient.send(command);

    if (response.Legs && response.Legs.length > 0) {
      const startPosition = response.Legs[0].StartPosition;
      if (startPosition) {
        const snapped = {
          lon: startPosition[0],
          lat: startPosition[1],
        };
        logger.info('Location snapped to road', { original: { lat, lon }, snapped });
        return snapped;
      }
    }

    // If snapping fails, return original coordinates
    return { lat, lon };
  } catch (error) {
    logger.warn('Road snapping failed, using original coordinates', {
      lat,
      lon,
      error: (error as Error).message,
    });
    return { lat, lon };
  }
}

/**
 * Get weather conditions for location
 */
export async function getWeatherConditions(
  lat: number,
  lon: number
): Promise<WeatherCondition | undefined> {
  if (!WEATHER_API_KEY) {
    logger.warn('Weather API key not configured');
    return undefined;
  }

  try {
    // Using OpenWeatherMap API as an example
    const url = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=imperial`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}`);
    }

    const data = (await response.json()) as any;

    const weather: WeatherCondition = {
      condition: data.weather?.[0]?.main || 'Unknown',
      temperature: Math.round(data.main?.temp || 0),
      visibility: Math.round((data.visibility || 10000) / 1609.34), // Convert meters to miles
    };

    logger.info('Weather conditions retrieved', { lat, lon, weather });
    return weather;
  } catch (error) {
    logger.error('Failed to get weather conditions', error as Error, { lat, lon });
    return undefined;
  }
}

/**
 * Enrich incident location with address, road snapping, and weather
 */
export async function enrichIncidentLocation(
  lat: number,
  lon: number
): Promise<{
  location: IncidentLocation;
  weather?: WeatherCondition;
}> {
  // Validate coordinates
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new ValidationError('Invalid GPS coordinates');
  }

  // Run geocoding, road snapping, and weather in parallel
  const [address, roadSnapped, weather] = await Promise.all([
    geocodeLocation(lat, lon),
    snapToRoad(lat, lon),
    getWeatherConditions(lat, lon),
  ]);

  const location: IncidentLocation = {
    lat,
    lon,
    address,
    roadSnapped,
  };

  logger.info('Incident location enriched', { location, weather });

  return { location, weather };
}

/**
 * Check if point is within geofence
 */
export function isPointInGeofence(
  point: { lat: number; lon: number },
  geofence: { lat: number; lon: number }[],
  radiusMeters?: number
): boolean {
  if (radiusMeters) {
    // Simple radius check
    const center = geofence[0];
    const distance = calculateDistanceMeters(point.lat, point.lon, center.lat, center.lon);
    return distance <= radiusMeters;
  }

  // Point-in-polygon algorithm (ray casting)
  let inside = false;
  for (let i = 0, j = geofence.length - 1; i < geofence.length; j = i++) {
    const xi = geofence[i].lat;
    const yi = geofence[i].lon;
    const xj = geofence[j].lat;
    const yj = geofence[j].lon;

    const intersect =
      yi > point.lon !== yj > point.lon &&
      point.lat < ((xj - xi) * (point.lon - yi)) / (yj - yi) + xi;

    if (intersect) {
      inside = !inside;
    }
  }

  return inside;
}

/**
 * Calculate distance between two points in meters
 */
function calculateDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}
