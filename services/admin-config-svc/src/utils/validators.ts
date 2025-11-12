import { MatchingConfig, SLAConfig, GeofenceConfig, PricingConfig } from '../types/config';

export class ConfigValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigValidationError';
  }
}

export class ConfigValidator {
  /**
   * Validate matching configuration
   */
  static validateMatchingConfig(config: MatchingConfig): void {
    // Validate weights
    if (!config.weights) {
      throw new ConfigValidationError('Weights are required');
    }

    const { distance, capability, availability, acceptanceRate, rating } = config.weights;

    // Check all weights are present
    if (
      typeof distance !== 'number' ||
      typeof capability !== 'number' ||
      typeof availability !== 'number' ||
      typeof acceptanceRate !== 'number' ||
      typeof rating !== 'number'
    ) {
      throw new ConfigValidationError('All weight values must be numbers');
    }

    // Check weights are between 0 and 1
    const weights = [distance, capability, availability, acceptanceRate, rating];
    if (weights.some((w) => w < 0 || w > 1)) {
      throw new ConfigValidationError('All weights must be between 0 and 1');
    }

    // Check weights sum to 1 (with small tolerance for floating point)
    const sum = weights.reduce((a, b) => a + b, 0);
    if (Math.abs(sum - 1.0) > 0.001) {
      throw new ConfigValidationError(`Weights must sum to 1.0 (current sum: ${sum})`);
    }

    // Validate radius settings
    if (config.defaultRadius <= 0) {
      throw new ConfigValidationError('Default radius must be positive');
    }

    if (config.maxRadius <= config.defaultRadius) {
      throw new ConfigValidationError('Max radius must be greater than default radius');
    }

    if (config.radiusExpansionFactor <= 0 || config.radiusExpansionFactor >= 1) {
      throw new ConfigValidationError('Radius expansion factor must be between 0 and 1');
    }

    if (config.maxExpansionAttempts < 1 || config.maxExpansionAttempts > 10) {
      throw new ConfigValidationError('Max expansion attempts must be between 1 and 10');
    }

    // Validate timeout settings
    if (config.offerTimeoutSeconds < 30 || config.offerTimeoutSeconds > 600) {
      throw new ConfigValidationError('Offer timeout must be between 30 and 600 seconds');
    }

    if (config.maxOffersPerIncident < 1 || config.maxOffersPerIncident > 10) {
      throw new ConfigValidationError('Max offers per incident must be between 1 and 10');
    }
  }

  /**
   * Validate SLA tiers configuration
   */
  static validateSLAConfig(config: SLAConfig): void {
    if (!config.tiers || !Array.isArray(config.tiers) || config.tiers.length === 0) {
      throw new ConfigValidationError('At least one SLA tier is required');
    }

    if (!config.defaultTier) {
      throw new ConfigValidationError('Default tier is required');
    }

    const tierNames = new Set<string>();
    const priorities = new Set<number>();

    for (const tier of config.tiers) {
      // Check required fields
      if (!tier.name || typeof tier.name !== 'string') {
        throw new ConfigValidationError('Tier name is required and must be a string');
      }

      // Check for duplicate names
      if (tierNames.has(tier.name)) {
        throw new ConfigValidationError(`Duplicate tier name: ${tier.name}`);
      }
      tierNames.add(tier.name);

      // Check for duplicate priorities
      if (priorities.has(tier.priority)) {
        throw new ConfigValidationError(`Duplicate priority: ${tier.priority}`);
      }
      priorities.add(tier.priority);

      // Validate response time
      if (tier.responseTimeMinutes <= 0 || tier.responseTimeMinutes > 120) {
        throw new ConfigValidationError(
          `Response time for ${tier.name} must be between 1 and 120 minutes`
        );
      }

      // Validate arrival time
      if (tier.arrivalTimeMinutes <= 0 || tier.arrivalTimeMinutes > 240) {
        throw new ConfigValidationError(
          `Arrival time for ${tier.name} must be between 1 and 240 minutes`
        );
      }

      // Arrival time should be greater than response time
      if (tier.arrivalTimeMinutes <= tier.responseTimeMinutes) {
        throw new ConfigValidationError(
          `Arrival time must be greater than response time for ${tier.name}`
        );
      }

      // Validate pricing multiplier
      if (tier.pricingMultiplier <= 0 || tier.pricingMultiplier > 5) {
        throw new ConfigValidationError(
          `Pricing multiplier for ${tier.name} must be between 0 and 5`
        );
      }

      // Validate priority
      if (tier.priority < 1 || tier.priority > 10) {
        throw new ConfigValidationError(
          `Priority for ${tier.name} must be between 1 and 10`
        );
      }
    }

    // Check that default tier exists
    if (!config.tiers.some((t) => t.name === config.defaultTier)) {
      throw new ConfigValidationError(`Default tier "${config.defaultTier}" not found in tiers`);
    }
  }

  /**
   * Validate geofence configuration
   */
  static validateGeofenceConfig(config: GeofenceConfig): void {
    if (!config.geofenceId || typeof config.geofenceId !== 'string') {
      throw new ConfigValidationError('Geofence ID is required');
    }

    if (!config.name || typeof config.name !== 'string') {
      throw new ConfigValidationError('Geofence name is required');
    }

    if (!config.polygon || !config.polygon.coordinates) {
      throw new ConfigValidationError('Polygon coordinates are required');
    }

    if (!Array.isArray(config.polygon.coordinates) || config.polygon.coordinates.length < 3) {
      throw new ConfigValidationError('Polygon must have at least 3 coordinate pairs');
    }

    // Validate each coordinate pair
    for (const coord of config.polygon.coordinates) {
      if (!Array.isArray(coord) || coord.length !== 2) {
        throw new ConfigValidationError('Each coordinate must be a [lon, lat] pair');
      }

      const [lon, lat] = coord;

      if (typeof lon !== 'number' || typeof lat !== 'number') {
        throw new ConfigValidationError('Longitude and latitude must be numbers');
      }

      if (lon < -180 || lon > 180) {
        throw new ConfigValidationError(`Invalid longitude: ${lon} (must be between -180 and 180)`);
      }

      if (lat < -90 || lat > 90) {
        throw new ConfigValidationError(`Invalid latitude: ${lat} (must be between -90 and 90)`);
      }
    }

    // Check if polygon is closed (first and last points should be the same)
    const first = config.polygon.coordinates[0];
    const last = config.polygon.coordinates[config.polygon.coordinates.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new ConfigValidationError('Polygon must be closed (first and last points must match)');
    }

    if (!config.region || typeof config.region !== 'string') {
      throw new ConfigValidationError('Region is required');
    }

    if (typeof config.active !== 'boolean') {
      throw new ConfigValidationError('Active flag must be a boolean');
    }
  }

  /**
   * Validate pricing configuration
   */
  static validatePricingConfig(config: PricingConfig): void {
    if (!config.baseRates) {
      throw new ConfigValidationError('Base rates are required');
    }

    const { tire, engine, tow } = config.baseRates;

    if (typeof tire !== 'number' || tire <= 0) {
      throw new ConfigValidationError('Tire base rate must be a positive number');
    }

    if (typeof engine !== 'number' || engine <= 0) {
      throw new ConfigValidationError('Engine base rate must be a positive number');
    }

    if (typeof tow !== 'number' || tow <= 0) {
      throw new ConfigValidationError('Tow base rate must be a positive number');
    }

    if (typeof config.perMileRate !== 'number' || config.perMileRate <= 0) {
      throw new ConfigValidationError('Per mile rate must be a positive number');
    }

    if (!config.currency || typeof config.currency !== 'string') {
      throw new ConfigValidationError('Currency is required');
    }

    // Validate currency code (ISO 4217)
    if (!/^[A-Z]{3}$/.test(config.currency)) {
      throw new ConfigValidationError('Currency must be a valid 3-letter ISO 4217 code');
    }
  }
}
