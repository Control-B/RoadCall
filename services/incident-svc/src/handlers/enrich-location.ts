import { EventBridgeEvent } from 'aws-lambda';
import { logger, SecretValue } from '@roadcall/utils';
import { secretsManager } from '@roadcall/aws-clients';

interface WeatherSecrets {
  apiKey: SecretValue;
  endpoint: string;
}

interface IncidentCreatedDetail {
  incidentId: string;
  location: {
    lat: number;
    lon: number;
  };
}

// Cache weather secrets
let weatherSecrets: WeatherSecrets | null = null;

/**
 * Get weather API secrets from Secrets Manager
 */
async function getWeatherSecrets(): Promise<WeatherSecrets> {
  if (weatherSecrets) {
    return weatherSecrets;
  }

  const stage = process.env.STAGE || 'dev';
  const secretName = `roadcall/weather/api-key-${stage}`;

  try {
    // Get secrets with caching enabled
    weatherSecrets = await secretsManager.getSecretJSON<WeatherSecrets>(secretName);

    logger.info('Weather API secrets loaded', {
      secretName,
      endpoint: weatherSecrets.endpoint,
      // Do NOT log the API key
    });

    return weatherSecrets;
  } catch (error) {
    logger.error('Failed to load weather API secrets', error as Error, {
      secretName,
    });
    throw error;
  }
}

/**
 * Fetch weather data for a location using native fetch
 */
async function getWeatherData(lat: number, lon: number): Promise<any> {
  const secrets = await getWeatherSecrets();

  try {
    // Build URL with query parameters
    const url = new URL('/current.json', secrets.endpoint);
    url.searchParams.append('key', secrets.apiKey.getValue()); // Use getValue() only when making the API call
    url.searchParams.append('q', `${lat},${lon}`);
    url.searchParams.append('aqi', 'no');

    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      throw new Error(`Weather API returned ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as any;

    return {
      condition: data.current.condition.text,
      temperature: data.current.temp_f,
      visibility: data.current.vis_miles,
      windSpeed: data.current.wind_mph,
    };
  } catch (error) {
    logger.error('Weather API request failed', error as Error, {
      lat,
      lon,
      // Do NOT log the API key or full error response
    });
    throw error;
  }
}

export const handler = async (
  event: EventBridgeEvent<'IncidentCreated', IncidentCreatedDetail>
): Promise<void> => {
  try {
    const { incidentId, location } = event.detail;

    logger.info('Enriching incident location with weather data', {
      incidentId,
      location,
    });

    // Fetch weather data
    const weatherData = await getWeatherData(location.lat, location.lon);

    logger.info('Weather data retrieved', {
      incidentId,
      weather: weatherData,
    });

    // TODO: Update incident record in DynamoDB with weather data
    // await updateIncidentWeather(incidentId, weatherData);

    logger.info('Incident location enriched successfully', {
      incidentId,
    });
  } catch (error) {
    logger.error('Failed to enrich incident location', error as Error, {
      incidentId: event.detail.incidentId,
    });
    // Don't throw - this is a non-critical enrichment
  }
};
