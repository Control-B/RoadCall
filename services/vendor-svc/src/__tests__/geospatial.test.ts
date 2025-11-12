import { calculateDistance, generateGeohash } from '@roadcall/utils';

describe('Geospatial Functions', () => {
  describe('calculateDistance', () => {
    it('should calculate distance between two points correctly', () => {
      // New York to Los Angeles (approximately 2451 miles)
      const nyLat = 40.7128;
      const nyLon = -74.006;
      const laLat = 34.0522;
      const laLon = -118.2437;

      const distance = calculateDistance(nyLat, nyLon, laLat, laLon);

      // Allow 1% margin of error
      expect(distance).toBeGreaterThan(2400);
      expect(distance).toBeLessThan(2500);
    });

    it('should return 0 for same location', () => {
      const lat = 40.7128;
      const lon = -74.006;

      const distance = calculateDistance(lat, lon, lat, lon);

      expect(distance).toBe(0);
    });

    it('should calculate short distances accurately', () => {
      // Two points approximately 10 miles apart
      const lat1 = 40.7128;
      const lon1 = -74.006;
      const lat2 = 40.8128;
      const lon2 = -74.006;

      const distance = calculateDistance(lat1, lon1, lat2, lon2);

      // Should be around 6-7 miles
      expect(distance).toBeGreaterThan(5);
      expect(distance).toBeLessThan(10);
    });
  });

  describe('generateGeohash', () => {
    it('should generate geohash of correct length', () => {
      const lat = 40.7128;
      const lon = -74.006;

      const geohash = generateGeohash(lat, lon, 6);

      expect(geohash).toHaveLength(6);
      expect(typeof geohash).toBe('string');
    });

    it('should generate same geohash for same location', () => {
      const lat = 40.7128;
      const lon = -74.006;

      const geohash1 = generateGeohash(lat, lon, 6);
      const geohash2 = generateGeohash(lat, lon, 6);

      expect(geohash1).toBe(geohash2);
    });

    it('should generate different geohashes for different locations', () => {
      const geohash1 = generateGeohash(40.7128, -74.006, 6);
      const geohash2 = generateGeohash(34.0522, -118.2437, 6);

      expect(geohash1).not.toBe(geohash2);
    });
  });
});
