export interface MatchingConfig {
  weights: {
    distance: number;
    capability: number;
    availability: number;
    acceptanceRate: number;
    rating: number;
  };
  defaultRadius: number;
  maxRadius: number;
  radiusExpansionFactor: number;
  maxExpansionAttempts: number;
  offerTimeoutSeconds: number;
  maxOffersPerIncident: number;
}

export interface SLATier {
  name: string;
  responseTimeMinutes: number;
  arrivalTimeMinutes: number;
  pricingMultiplier: number;
  priority: number;
}

export interface SLAConfig {
  tiers: SLATier[];
  defaultTier: string;
}

export interface GeofenceConfig {
  geofenceId: string;
  name: string;
  description?: string;
  polygon: {
    coordinates: Array<[number, number]>; // [lon, lat] pairs
  };
  region: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PricingConfig {
  baseRates: {
    tire: number;
    engine: number;
    tow: number;
  };
  perMileRate: number;
  currency: string;
}

export interface SystemConfig {
  configKey: string;
  version: number;
  value: MatchingConfig | SLAConfig | GeofenceConfig | PricingConfig | any;
  isLatest: string; // 'true' or 'false' for GSI
  updatedBy: string;
  updatedAt: string;
  description?: string;
}

export interface ConfigAuditLog {
  auditId: string;
  configKey: string;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'ROLLBACK';
  previousValue?: any;
  newValue: any;
  version: number;
  timestamp: string;
  reason?: string;
}

export interface ConfigVersion {
  configKey: string;
  version: number;
  value: any;
  createdBy: string;
  createdAt: string;
  description?: string;
}

export const CONFIG_KEYS = {
  MATCHING: 'matching',
  SLA_TIERS: 'sla-tiers',
  PRICING: 'pricing',
  GEOFENCES: 'geofences',
} as const;

export type ConfigKey = typeof CONFIG_KEYS[keyof typeof CONFIG_KEYS];

// Default configurations
export const DEFAULT_MATCHING_CONFIG: MatchingConfig = {
  weights: {
    distance: 0.30,
    capability: 0.25,
    availability: 0.20,
    acceptanceRate: 0.15,
    rating: 0.10,
  },
  defaultRadius: 50,
  maxRadius: 200,
  radiusExpansionFactor: 0.25,
  maxExpansionAttempts: 3,
  offerTimeoutSeconds: 120,
  maxOffersPerIncident: 3,
};

export const DEFAULT_SLA_CONFIG: SLAConfig = {
  tiers: [
    {
      name: 'Standard',
      responseTimeMinutes: 15,
      arrivalTimeMinutes: 60,
      pricingMultiplier: 1.0,
      priority: 1,
    },
    {
      name: 'Priority',
      responseTimeMinutes: 10,
      arrivalTimeMinutes: 45,
      pricingMultiplier: 1.25,
      priority: 2,
    },
    {
      name: 'Emergency',
      responseTimeMinutes: 5,
      arrivalTimeMinutes: 30,
      pricingMultiplier: 1.5,
      priority: 3,
    },
  ],
  defaultTier: 'Standard',
};

export const DEFAULT_PRICING_CONFIG: PricingConfig = {
  baseRates: {
    tire: 150,
    engine: 200,
    tow: 250,
  },
  perMileRate: 3.5,
  currency: 'USD',
};
