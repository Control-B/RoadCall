import { v4 as uuidv4 } from 'uuid';
import {
  Vendor,
  ServiceCapability,
  VendorAvailabilityStatus,
  VendorCoverageArea,
} from '@roadcall/types';
import { dynamodb } from '@roadcall/aws-clients';
import {
  logger,
  NotFoundError,
  ValidationError,
  generateGeohash,
  calculateDistance,
} from '@roadcall/utils';
import { getRedisClient } from './redis-client';

const VENDORS_TABLE = process.env.VENDORS_TABLE || '';
const VENDOR_CACHE_TTL = 300; // 5 minutes
const REDIS_GEO_KEY = 'vendors:geo';

/**
 * Get vendor by ID
 */
export async function getVendorById(vendorId: string): Promise<Vendor | null> {
  // Try cache first
  try {
    const redis = await getRedisClient();
    const cached = await redis.get(`vendor:${vendorId}`);
    if (cached) {
      logger.debug('Vendor retrieved from cache', { vendorId });
      return JSON.parse(cached);
    }
  } catch (error) {
    logger.warn('Redis cache miss', { vendorId, error: (error as Error).message });
  }

  // Get from DynamoDB
  const vendor = await dynamodb.get<Vendor>(VENDORS_TABLE, { vendorId });

  if (vendor) {
    // Cache the result
    try {
      const redis = await getRedisClient();
      await redis.setEx(`vendor:${vendorId}`, VENDOR_CACHE_TTL, JSON.stringify(vendor));
    } catch (error) {
      logger.warn('Failed to cache vendor', { vendorId, error: (error as Error).message });
    }
  }

  return vendor;
}

/**
 * Create vendor profile
 */
export async function createVendor(
  businessName: string,
  contactName: string,
  phone: string,
  email: string,
  capabilities: ServiceCapability[],
  coverageArea: VendorCoverageArea,
  operatingHours: Vendor['operatingHours'],
  pricing: Vendor['pricing'],
  certifications: string[] = [],
  insuranceExpiry: string
): Promise<Vendor> {
  const vendor: Vendor = {
    vendorId: uuidv4(),
    businessName,
    contactName,
    phone,
    email,
    capabilities,
    coverageArea,
    availability: {
      status: 'available',
      lastUpdated: new Date().toISOString(),
    },
    operatingHours,
    rating: {
      average: 0,
      count: 0,
    },
    metrics: {
      acceptanceRate: 0,
      avgResponseTime: 0,
      completionRate: 0,
      totalJobs: 0,
    },
    pricing,
    certifications,
    insuranceExpiry,
    backgroundCheckStatus: 'pending',
    createdAt: new Date().toISOString(),
  };

  // Generate geohash for coverage area center
  const geohash = generateGeohash(
    coverageArea.center.lat,
    coverageArea.center.lon,
    6
  );

  // Store in DynamoDB with geohash
  await dynamodb.put(VENDORS_TABLE, {
    ...vendor,
    geohash,
    availabilityStatus: vendor.availability.status,
    avgRating: vendor.rating.average,
  });

  // Add to Redis geospatial index
  try {
    const redis = await getRedisClient();
    await redis.geoAdd(REDIS_GEO_KEY, {
      longitude: coverageArea.center.lon,
      latitude: coverageArea.center.lat,
      member: vendor.vendorId,
    });
  } catch (error) {
    logger.warn('Failed to add vendor to Redis geo index', {
      vendorId: vendor.vendorId,
      error: (error as Error).message,
    });
  }

  logger.info('Vendor created', { vendorId: vendor.vendorId });

  return vendor;
}

/**
 * Update vendor profile
 */
export async function updateVendor(
  vendorId: string,
  updates: Partial<Omit<Vendor, 'vendorId' | 'createdAt'>>
): Promise<Vendor> {
  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    throw new NotFoundError('Vendor', vendorId);
  }

  // If coverage area changed, update geohash
  if (updates.coverageArea) {
    const geohash = generateGeohash(
      updates.coverageArea.center.lat,
      updates.coverageArea.center.lon,
      6
    );
    (updates as any).geohash = geohash;

    // Update Redis geo index
    try {
      const redis = await getRedisClient();
      await redis.geoAdd(REDIS_GEO_KEY, {
        longitude: updates.coverageArea.center.lon,
        latitude: updates.coverageArea.center.lat,
        member: vendorId,
      });
    } catch (error) {
      logger.warn('Failed to update vendor in Redis geo index', {
        vendorId,
        error: (error as Error).message,
      });
    }
  }

  await dynamodb.update(VENDORS_TABLE, { vendorId }, updates);

  // Invalidate cache
  try {
    const redis = await getRedisClient();
    await redis.del(`vendor:${vendorId}`);
  } catch (error) {
    logger.warn('Failed to invalidate vendor cache', {
      vendorId,
      error: (error as Error).message,
    });
  }

  const updatedVendor = await getVendorById(vendorId);
  if (!updatedVendor) {
    throw new Error('Vendor not found after update');
  }

  logger.info('Vendor updated', { vendorId });

  return updatedVendor;
}

/**
 * Update vendor availability status
 */
export async function updateVendorAvailability(
  vendorId: string,
  status: VendorAvailabilityStatus,
  currentIncidentId?: string
): Promise<void> {
  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    throw new NotFoundError('Vendor', vendorId);
  }

  const availability = {
    status,
    currentIncidentId,
    lastUpdated: new Date().toISOString(),
  };

  await dynamodb.update(VENDORS_TABLE, { vendorId }, {
    availability,
    availabilityStatus: status,
  });

  // Invalidate cache
  try {
    const redis = await getRedisClient();
    await redis.del(`vendor:${vendorId}`);
  } catch (error) {
    logger.warn('Failed to invalidate vendor cache', {
      vendorId,
      error: (error as Error).message,
    });
  }

  logger.info('Vendor availability updated', { vendorId, status });
}

/**
 * Search vendors by location and radius using Redis geospatial
 */
export async function searchVendorsByLocation(
  lat: number,
  lon: number,
  radiusMiles: number,
  capabilities?: ServiceCapability[],
  availabilityStatus?: VendorAvailabilityStatus
): Promise<Vendor[]> {
  // For now, use DynamoDB fallback
  // Redis geospatial will be optimized in production
  return searchVendorsByLocationFallback(lat, lon, radiusMiles, capabilities, availabilityStatus);
}

/**
 * Fallback search using DynamoDB (less efficient)
 */
async function searchVendorsByLocationFallback(
  lat: number,
  lon: number,
  radiusMiles: number,
  capabilities?: ServiceCapability[],
  availabilityStatus?: VendorAvailabilityStatus
): Promise<Vendor[]> {
  // Generate geohash prefix for approximate area
  const geohash = generateGeohash(lat, lon, 4); // Lower precision for wider search

  // Query by geohash prefix
  const vendors = await dynamodb.query<Vendor>(
    VENDORS_TABLE,
    'begins_with(geohash, :geohash)',
    { ':geohash': geohash },
    'geohash-availability-index'
  );

  // Filter by distance, capabilities, and availability
  const filtered = vendors.filter((vendor) => {
    // Check distance
    const distance = calculateDistance(
      lat,
      lon,
      vendor.coverageArea.center.lat,
      vendor.coverageArea.center.lon
    );
    if (distance > radiusMiles) {
      return false;
    }

    // Check capabilities
    if (capabilities && capabilities.length > 0) {
      const hasAllCapabilities = capabilities.every((cap) => vendor.capabilities.includes(cap));
      if (!hasAllCapabilities) {
        return false;
      }
    }

    // Check availability
    if (availabilityStatus && vendor.availability.status !== availabilityStatus) {
      return false;
    }

    return true;
  });

  logger.info('Vendors searched by location (fallback)', {
    lat,
    lon,
    radiusMiles,
    count: filtered.length,
  });

  return filtered;
}

/**
 * Update vendor rating
 */
export async function updateVendorRating(vendorId: string, rating: number): Promise<void> {
  if (rating < 1 || rating > 5) {
    throw new ValidationError('Rating must be between 1 and 5');
  }

  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    throw new NotFoundError('Vendor', vendorId);
  }

  const totalRating = vendor.rating.average * vendor.rating.count + rating;
  const newCount = vendor.rating.count + 1;
  const newAverage = totalRating / newCount;

  await dynamodb.update(VENDORS_TABLE, { vendorId }, {
    rating: {
      average: newAverage,
      count: newCount,
    },
    avgRating: newAverage,
  });

  // Invalidate cache
  try {
    const redis = await getRedisClient();
    await redis.del(`vendor:${vendorId}`);
  } catch (error) {
    logger.warn('Failed to invalidate vendor cache', {
      vendorId,
      error: (error as Error).message,
    });
  }

  logger.info('Vendor rating updated', { vendorId, rating, newAverage });
}

/**
 * Update vendor metrics
 */
export async function updateVendorMetrics(
  vendorId: string,
  metrics: Partial<Vendor['metrics']>
): Promise<void> {
  const vendor = await getVendorById(vendorId);
  if (!vendor) {
    throw new NotFoundError('Vendor', vendorId);
  }

  const updatedMetrics = {
    ...vendor.metrics,
    ...metrics,
  };

  await dynamodb.update(VENDORS_TABLE, { vendorId }, {
    metrics: updatedMetrics,
  });

  // Invalidate cache
  try {
    const redis = await getRedisClient();
    await redis.del(`vendor:${vendorId}`);
  } catch (error) {
    logger.warn('Failed to invalidate vendor cache', {
      vendorId,
      error: (error as Error).message,
    });
  }

  logger.info('Vendor metrics updated', { vendorId });
}
