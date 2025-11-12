import { RedisClient, GeoLocation } from './redis-client';

export interface VendorProfile {
  vendorId: string;
  businessName: string;
  capabilities: string[];
  location: {
    latitude: number;
    longitude: number;
  };
  availability: {
    status: 'available' | 'busy' | 'offline';
    currentIncidentId?: string;
  };
  rating: {
    average: number;
    count: number;
  };
  metrics: {
    acceptanceRate: number;
    avgResponseTime: number;
    completionRate: number;
  };
}

export interface VendorSearchResult extends VendorProfile {
  distance?: number;
}

/**
 * Vendor cache service using Redis
 * 
 * Features:
 * - Vendor profile caching with 5-minute TTL
 * - Geospatial indexing for proximity search
 * - Availability tracking
 */
export class VendorCache {
  private readonly VENDOR_PREFIX = 'vendor:';
  private readonly GEO_INDEX_KEY = 'vendors:geo';
  private readonly AVAILABLE_SET_KEY = 'vendors:available';
  private readonly DEFAULT_TTL = 300; // 5 minutes

  constructor(private redis: RedisClient) {}

  /**
   * Cache vendor profile
   */
  async cacheVendor(vendor: VendorProfile): Promise<boolean> {
    const key = this.getVendorKey(vendor.vendorId);
    
    // Store vendor profile
    const cached = await this.redis.set(key, vendor, { ttl: this.DEFAULT_TTL });
    
    if (cached) {
      // Add to geospatial index
      await this.redis.geoAdd(this.GEO_INDEX_KEY, [{
        longitude: vendor.location.longitude,
        latitude: vendor.location.latitude,
        member: vendor.vendorId,
      }]);
      
      // Add to available set if available
      if (vendor.availability.status === 'available') {
        await this.redis.hset(
          this.AVAILABLE_SET_KEY,
          vendor.vendorId,
          JSON.stringify({
            capabilities: vendor.capabilities,
            rating: vendor.rating.average,
            acceptanceRate: vendor.metrics.acceptanceRate,
          })
        );
      } else {
        await this.redis.hdel(this.AVAILABLE_SET_KEY, vendor.vendorId);
      }
    }
    
    return cached;
  }

  /**
   * Get vendor profile from cache
   */
  async getVendor(vendorId: string): Promise<VendorProfile | null> {
    const key = this.getVendorKey(vendorId);
    return await this.redis.get<VendorProfile>(key);
  }

  /**
   * Get multiple vendor profiles
   */
  async getVendors(vendorIds: string[]): Promise<(VendorProfile | null)[]> {
    const keys = vendorIds.map(id => this.getVendorKey(id));
    return await this.redis.mget<VendorProfile>(...keys);
  }

  /**
   * Update vendor availability
   */
  async updateAvailability(
    vendorId: string,
    status: 'available' | 'busy' | 'offline',
    currentIncidentId?: string
  ): Promise<boolean> {
    const vendor = await this.getVendor(vendorId);
    if (!vendor) return false;
    
    vendor.availability = {
      status,
      currentIncidentId,
    };
    
    return await this.cacheVendor(vendor);
  }

  /**
   * Search vendors within radius
   */
  async searchVendorsNearby(
    latitude: number,
    longitude: number,
    radiusMiles: number,
    options?: {
      capabilities?: string[];
      availableOnly?: boolean;
      limit?: number;
    }
  ): Promise<VendorSearchResult[]> {
    // Search geospatial index
    const geoResults = await this.redis.geoRadius(
      this.GEO_INDEX_KEY,
      longitude,
      latitude,
      {
        radius: radiusMiles,
        unit: 'mi',
        count: options?.limit || 100,
        sort: 'ASC',
        withDist: true,
      }
    );
    
    if (geoResults.length === 0) {
      return [];
    }
    
    // Get vendor profiles
    const vendorIds = geoResults.map(r => r.member);
    const vendors = await this.getVendors(vendorIds);
    
    // Filter and enrich results
    const results: VendorSearchResult[] = [];
    
    for (let i = 0; i < vendors.length; i++) {
      const vendor = vendors[i];
      const geoResult = geoResults[i];
      
      if (!vendor) continue;
      
      // Filter by availability
      if (options?.availableOnly && vendor.availability.status !== 'available') {
        continue;
      }
      
      // Filter by capabilities
      if (options?.capabilities && options.capabilities.length > 0) {
        const hasCapability = options.capabilities.some(cap =>
          vendor.capabilities.includes(cap)
        );
        if (!hasCapability) continue;
      }
      
      results.push({
        ...vendor,
        distance: geoResult.distance,
      });
    }
    
    return results;
  }

  /**
   * Get all available vendors
   */
  async getAvailableVendors(): Promise<string[]> {
    const availableHash = await this.redis.hgetall(this.AVAILABLE_SET_KEY);
    return availableHash ? Object.keys(availableHash) : [];
  }

  /**
   * Invalidate vendor cache
   */
  async invalidateVendor(vendorId: string): Promise<boolean> {
    const key = this.getVendorKey(vendorId);
    
    // Delete from cache
    await this.redis.del(key);
    
    // Remove from geospatial index
    await this.redis.geoRem(this.GEO_INDEX_KEY, vendorId);
    
    // Remove from available set
    await this.redis.hdel(this.AVAILABLE_SET_KEY, vendorId);
    
    return true;
  }

  /**
   * Invalidate multiple vendors
   */
  async invalidateVendors(vendorIds: string[]): Promise<number> {
    const keys = vendorIds.map(id => this.getVendorKey(id));
    
    // Delete from cache
    await this.redis.del(...keys);
    
    // Remove from geospatial index
    await this.redis.geoRem(this.GEO_INDEX_KEY, ...vendorIds);
    
    // Remove from available set
    await this.redis.hdel(this.AVAILABLE_SET_KEY, ...vendorIds);
    
    return vendorIds.length;
  }

  /**
   * Cache vendor search results
   */
  async cacheSearchResults(
    searchKey: string,
    results: VendorSearchResult[],
    ttl: number = 60
  ): Promise<boolean> {
    const key = `search:${searchKey}`;
    return await this.redis.set(key, results, { ttl });
  }

  /**
   * Get cached search results
   */
  async getCachedSearchResults(searchKey: string): Promise<VendorSearchResult[] | null> {
    const key = `search:${searchKey}`;
    return await this.redis.get<VendorSearchResult[]>(key);
  }

  /**
   * Get vendor key
   */
  private getVendorKey(vendorId: string): string {
    return `${this.VENDOR_PREFIX}${vendorId}`;
  }

  /**
   * Generate search key for caching
   */
  static generateSearchKey(
    latitude: number,
    longitude: number,
    radiusMiles: number,
    capabilities?: string[]
  ): string {
    const lat = latitude.toFixed(4);
    const lon = longitude.toFixed(4);
    const caps = capabilities?.sort().join(',') || 'all';
    return `${lat}:${lon}:${radiusMiles}:${caps}`;
  }
}
