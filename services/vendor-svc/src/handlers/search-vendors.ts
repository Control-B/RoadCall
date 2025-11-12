import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError } from '@roadcall/utils';
import { searchVendors } from '../vendor-service';
import { getVendorCache, isRedisAvailable } from '../cache-service';
import { VendorCache } from '@roadcall/utils';

/**
 * Lambda handler for searching vendors with geospatial caching
 * GET /vendors/search?lat={lat}&lon={lon}&radius={miles}&capability={type}
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    // Parse query parameters
    const latitude = parseFloat(event.queryStringParameters?.lat || '');
    const longitude = parseFloat(event.queryStringParameters?.lon || '');
    const radiusMiles = parseFloat(event.queryStringParameters?.radius || '50');
    const capability = event.queryStringParameters?.capability;
    const availableOnly = event.queryStringParameters?.availableOnly === 'true';
    const limit = parseInt(event.queryStringParameters?.limit || '10');

    // Validate parameters
    if (isNaN(latitude) || isNaN(longitude)) {
      throw new ValidationError('Invalid latitude or longitude');
    }

    if (latitude < -90 || latitude > 90) {
      throw new ValidationError('Latitude must be between -90 and 90');
    }

    if (longitude < -180 || longitude > 180) {
      throw new ValidationError('Longitude must be between -180 and 180');
    }

    if (radiusMiles <= 0 || radiusMiles > 500) {
      throw new ValidationError('Radius must be between 0 and 500 miles');
    }

    logger.info('Searching vendors', {
      latitude,
      longitude,
      radiusMiles,
      capability,
      availableOnly,
      limit,
    });

    let vendors = null;
    let cacheHit = false;

    // Try to get from cache first
    if (isRedisAvailable()) {
      try {
        const cache = await getVendorCache();
        const searchKey = VendorCache.generateSearchKey(
          latitude,
          longitude,
          radiusMiles,
          capability ? [capability] : undefined
        );
        
        vendors = await cache.getCachedSearchResults(searchKey);
        
        if (vendors) {
          cacheHit = true;
          logger.info('Vendor search results retrieved from cache', { searchKey });
          
          // Apply availability filter if needed
          if (availableOnly) {
            vendors = vendors.filter(v => v.availability.status === 'available');
          }
          
          // Apply limit
          vendors = vendors.slice(0, limit);
        }
      } catch (cacheError) {
        logger.warn('Cache retrieval failed, falling back to database', cacheError as Error);
      }
    }

    // If not in cache, search using geospatial index or database
    if (!vendors) {
      // Try Redis geospatial search first
      if (isRedisAvailable()) {
        try {
          const cache = await getVendorCache();
          vendors = await cache.searchVendorsNearby(
            latitude,
            longitude,
            radiusMiles,
            {
              capabilities: capability ? [capability] : undefined,
              availableOnly,
              limit,
            }
          );
          
          if (vendors.length > 0) {
            logger.info('Vendors found using Redis geospatial search', {
              count: vendors.length,
            });
            
            // Cache the search results
            const searchKey = VendorCache.generateSearchKey(
              latitude,
              longitude,
              radiusMiles,
              capability ? [capability] : undefined
            );
            await cache.cacheSearchResults(searchKey, vendors, 60); // 1 minute TTL
          }
        } catch (geoError) {
          logger.warn('Redis geospatial search failed, falling back to database', geoError as Error);
          vendors = null;
        }
      }

      // Fallback to database search
      if (!vendors) {
        vendors = await searchVendors({
          latitude,
          longitude,
          radiusMiles,
          capability,
          availableOnly,
          limit,
        });

        logger.info('Vendors found using database search', {
          count: vendors.length,
        });

        // Cache the results and update geospatial index
        if (isRedisAvailable() && vendors.length > 0) {
          try {
            const cache = await getVendorCache();
            
            // Cache individual vendor profiles
            await Promise.all(
              vendors.map(vendor => cache.cacheVendor(vendor))
            );
            
            // Cache search results
            const searchKey = VendorCache.generateSearchKey(
              latitude,
              longitude,
              radiusMiles,
              capability ? [capability] : undefined
            );
            await cache.cacheSearchResults(searchKey, vendors, 60);
            
            logger.info('Vendor search results cached', { count: vendors.length });
          } catch (cacheError) {
            logger.warn('Failed to cache vendor search results', cacheError as Error);
          }
        }
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': cacheHit ? 'HIT' : 'MISS',
      },
      body: JSON.stringify({
        vendors,
        count: vendors.length,
        searchParams: {
          latitude,
          longitude,
          radiusMiles,
          capability,
          availableOnly,
          limit,
        },
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Vendor search failed', error as Error, { requestId });

    const statusCode = (error as any).statusCode || 500;
    const message = (error as Error).message || 'Internal server error';

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
