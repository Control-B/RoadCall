import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, NotFoundError } from '@roadcall/utils';
import { getVendorById } from '../vendor-service';
import { getVendorCache, isRedisAvailable } from '../cache-service';

/**
 * Lambda handler for getting vendor profile with Redis caching
 * GET /vendors/{id}
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    const vendorId = event.pathParameters?.id;
    if (!vendorId) {
      throw new NotFoundError('Vendor', 'undefined');
    }

    logger.info('Getting vendor profile', { vendorId });

    let vendor = null;
    let cacheHit = false;

    // Try to get from cache first
    if (isRedisAvailable()) {
      try {
        const cache = await getVendorCache();
        vendor = await cache.getVendor(vendorId);
        if (vendor) {
          cacheHit = true;
          logger.info('Vendor profile retrieved from cache', { vendorId });
        }
      } catch (cacheError) {
        logger.warn('Cache retrieval failed, falling back to database', cacheError as Error);
      }
    }

    // If not in cache, get from database
    if (!vendor) {
      vendor = await getVendorById(vendorId);
      if (!vendor) {
        throw new NotFoundError('Vendor', vendorId);
      }

      // Cache the vendor profile
      if (isRedisAvailable()) {
        try {
          const cache = await getVendorCache();
          await cache.cacheVendor(vendor);
          logger.info('Vendor profile cached', { vendorId });
        } catch (cacheError) {
          logger.warn('Failed to cache vendor profile', cacheError as Error);
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
        vendor,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Get vendor failed', error as Error, { requestId });

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
