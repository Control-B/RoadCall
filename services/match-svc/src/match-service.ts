import { v4 as uuidv4 } from 'uuid';
import {
  Offer,
  OfferStatus,
  MatchScoreBreakdown,
  Vendor,
  Incident,
  ServiceCapability,
} from '@roadcall/types';
import { dynamodb, eventBridge, EventSources, EventTypes } from '@roadcall/aws-clients';
import {
  logger,
  NotFoundError,
  ValidationError,
  ConflictError,
  calculateDistance,
} from '@roadcall/utils';

const OFFERS_TABLE = process.env.OFFERS_TABLE || '';
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE || '';
const VENDORS_TABLE = process.env.VENDORS_TABLE || '';
const OFFER_TTL_SECONDS = 120; // 2 minutes
const MAX_RADIUS_EXPANSION_ATTEMPTS = 3;
const RADIUS_EXPANSION_FACTOR = 1.25; // 25% increase

export interface MatchConfig {
  weights: {
    distance: number;
    capability: number;
    availability: number;
    acceptanceRate: number;
    rating: number;
  };
  defaultRadiusMiles: number;
  maxRadiusMiles: number;
  topVendorCount: number;
}

const DEFAULT_MATCH_CONFIG: MatchConfig = {
  weights: {
    distance: 0.30,
    capability: 0.25,
    availability: 0.20,
    acceptanceRate: 0.15,
    rating: 0.10,
  },
  defaultRadiusMiles: 50,
  maxRadiusMiles: 150,
  topVendorCount: 3,
};

/**
 * Calculate match score for a vendor and incident
 */
export function calculateMatchScore(
  vendor: Vendor,
  incident: Incident,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): number {
  const { weights } = config;

  // Distance score (inverse, normalized to 0-1)
  const distanceMiles = calculateDistance(
    vendor.coverageArea.center.lat,
    vendor.coverageArea.center.lon,
    incident.location.lat,
    incident.location.lon
  );
  const distanceScore = Math.max(0, 1 - distanceMiles / config.maxRadiusMiles);

  // Capability score (exact match = 1, no match = 0)
  const capabilityMap: Record<string, ServiceCapability[]> = {
    tire: ['tire_repair', 'tire_replacement'],
    engine: ['engine_repair'],
    tow: ['towing'],
  };
  const requiredCapabilities = capabilityMap[incident.type] || [];
  const hasCapability = requiredCapabilities.some((cap) =>
    vendor.capabilities.includes(cap)
  );
  const capabilityScore = hasCapability ? 1 : 0;

  // Availability score
  const availabilityScore = vendor.availability.status === 'available' ? 1 : 0;

  // Historical acceptance rate (0-1)
  const acceptanceScore = vendor.metrics.acceptanceRate;

  // Rating score (normalized to 0-1)
  const ratingScore = vendor.rating.average / 5;

  // Calculate weighted score
  const totalScore =
    weights.distance * distanceScore +
    weights.capability * capabilityScore +
    weights.availability * availabilityScore +
    weights.acceptanceRate * acceptanceScore +
    weights.rating * ratingScore;

  return totalScore;
}

/**
 * Calculate score breakdown for transparency
 */
export function calculateScoreBreakdown(
  vendor: Vendor,
  incident: Incident,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): MatchScoreBreakdown {
  const distanceMiles = calculateDistance(
    vendor.coverageArea.center.lat,
    vendor.coverageArea.center.lon,
    incident.location.lat,
    incident.location.lon
  );
  const distanceScore = Math.max(0, 1 - distanceMiles / config.maxRadiusMiles);

  const capabilityMap: Record<string, ServiceCapability[]> = {
    tire: ['tire_repair', 'tire_replacement'],
    engine: ['engine_repair'],
    tow: ['towing'],
  };
  const requiredCapabilities = capabilityMap[incident.type] || [];
  const hasCapability = requiredCapabilities.some((cap) =>
    vendor.capabilities.includes(cap)
  );
  const capabilityScore = hasCapability ? 1 : 0;

  const availabilityScore = vendor.availability.status === 'available' ? 1 : 0;
  const acceptanceScore = vendor.metrics.acceptanceRate;
  const ratingScore = vendor.rating.average / 5;

  return {
    distance: distanceScore,
    capability: capabilityScore,
    availability: availabilityScore,
    acceptanceRate: acceptanceScore,
    rating: ratingScore,
  };
}

/**
 * Find and rank vendor matches for an incident
 */
export async function findVendorMatches(
  incident: Incident,
  radiusMiles: number,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): Promise<Array<{ vendor: Vendor; score: number; scoreBreakdown: MatchScoreBreakdown }>> {
  // Query vendors within radius
  const vendors = await queryVendorsByRadius(
    incident.location.lat,
    incident.location.lon,
    radiusMiles
  );

  logger.info('Vendors queried for matching', {
    incidentId: incident.incidentId,
    radiusMiles,
    vendorCount: vendors.length,
  });

  // Calculate scores and filter
  const scoredVendors = vendors
    .map((vendor) => ({
      vendor,
      score: calculateMatchScore(vendor, incident, config),
      scoreBreakdown: calculateScoreBreakdown(vendor, incident, config),
    }))
    .filter((item) => item.score > 0) // Filter out vendors with zero score
    .sort((a, b) => b.score - a.score); // Sort by score descending

  return scoredVendors;
}

/**
 * Query vendors by radius (simplified - uses DynamoDB scan for now)
 */
async function queryVendorsByRadius(
  lat: number,
  lon: number,
  radiusMiles: number
): Promise<Vendor[]> {
  // In production, this would use geospatial indexing
  // For now, scan and filter
  const allVendors = await dynamodb.scan<Vendor>(VENDORS_TABLE);

  const vendorsInRadius = allVendors.filter((vendor) => {
    const distance = calculateDistance(
      lat,
      lon,
      vendor.coverageArea.center.lat,
      vendor.coverageArea.center.lon
    );
    return distance <= radiusMiles;
  });

  return vendorsInRadius;
}

/**
 * Create offers for top vendors
 */
export async function createOffers(
  incident: Incident,
  vendors: Array<{ vendor: Vendor; score: number; scoreBreakdown: MatchScoreBreakdown }>,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): Promise<Offer[]> {
  const topVendors = vendors.slice(0, config.topVendorCount);
  const expiresAt = Math.floor(Date.now() / 1000) + OFFER_TTL_SECONDS;
  const offers: Offer[] = [];

  for (const { vendor, score, scoreBreakdown } of topVendors) {
    const offer: Offer = {
      offerId: uuidv4(),
      incidentId: incident.incidentId,
      vendorId: vendor.vendorId,
      status: 'pending',
      matchScore: score,
      scoreBreakdown,
      estimatedPayout: calculateEstimatedPayout(vendor, incident),
      expiresAt,
      createdAt: new Date().toISOString(),
    };

    // Store offer in DynamoDB with TTL
    await dynamodb.put(OFFERS_TABLE, {
      ...offer,
      ttl: expiresAt,
    });

    offers.push(offer);

    // Publish OfferCreated event
    await eventBridge.publishEvent({
      source: EventSources.MATCH_SERVICE,
      detailType: EventTypes.OFFER_CREATED,
      detail: {
        offerId: offer.offerId,
        incidentId: offer.incidentId,
        vendorId: offer.vendorId,
        matchScore: offer.matchScore,
        estimatedPayout: offer.estimatedPayout,
        expiresAt: offer.expiresAt,
      },
    });

    logger.info('Offer created', {
      offerId: offer.offerId,
      incidentId: incident.incidentId,
      vendorId: vendor.vendorId,
      matchScore: score,
    });
  }

  return offers;
}

/**
 * Calculate estimated payout for vendor
 */
function calculateEstimatedPayout(vendor: Vendor, incident: Incident): number {
  const distance = calculateDistance(
    vendor.coverageArea.center.lat,
    vendor.coverageArea.center.lon,
    incident.location.lat,
    incident.location.lon
  );

  // Get pricing for incident type
  const serviceTypeMap: Record<string, string> = {
    tire: 'tire_repair',
    engine: 'engine_repair',
    tow: 'towing',
  };
  const serviceType = serviceTypeMap[incident.type];
  const pricing = vendor.pricing[serviceType];

  if (!pricing) {
    return 0;
  }

  const basePrice = pricing.basePrice;
  const mileageCharge = distance * pricing.perMileRate;
  const totalCents = basePrice + mileageCharge;

  return Math.round(totalCents);
}

/**
 * Execute vendor matching with radius expansion
 */
export async function executeVendorMatching(
  incidentId: string,
  attempt: number = 1,
  config: MatchConfig = DEFAULT_MATCH_CONFIG
): Promise<{ offers: Offer[]; attempt: number; radiusUsed: number }> {
  // Get incident
  const incident = await dynamodb.get<Incident>(INCIDENTS_TABLE, { incidentId });
  if (!incident) {
    throw new NotFoundError('Incident', incidentId);
  }

  // Check if incident already has assigned vendor
  if (incident.assignedVendorId) {
    throw new ConflictError('Incident already has an assigned vendor');
  }

  // Calculate radius for this attempt
  const radiusMiles =
    config.defaultRadiusMiles * Math.pow(RADIUS_EXPANSION_FACTOR, attempt - 1);

  // Cap at max radius
  const cappedRadius = Math.min(radiusMiles, config.maxRadiusMiles);

  logger.info('Executing vendor matching', {
    incidentId,
    attempt,
    radiusMiles: cappedRadius,
  });

  // Find vendor matches
  const matches = await findVendorMatches(incident, cappedRadius, config);

  if (matches.length === 0) {
    // No vendors found
    if (attempt >= MAX_RADIUS_EXPANSION_ATTEMPTS) {
      // Max attempts reached, escalate
      logger.warn('No vendors found after max attempts', {
        incidentId,
        attempts: attempt,
      });

      // Publish escalation event
      await eventBridge.publishEvent({
        source: EventSources.MATCH_SERVICE,
        detailType: EventTypes.INCIDENT_ESCALATED,
        detail: {
          incidentId,
          reason: 'No vendors found after radius expansion',
          attempts: attempt,
          finalRadius: cappedRadius,
        },
      });

      return { offers: [], attempt, radiusUsed: cappedRadius };
    }

    // Try again with expanded radius
    logger.info('No vendors found, expanding radius', {
      incidentId,
      currentAttempt: attempt,
      nextAttempt: attempt + 1,
    });

    return executeVendorMatching(incidentId, attempt + 1, config);
  }

  // Create offers for top vendors
  const offers = await createOffers(incident, matches, config);

  logger.info('Vendor matching completed', {
    incidentId,
    attempt,
    radiusUsed: cappedRadius,
    offersCreated: offers.length,
  });

  return { offers, attempt, radiusUsed: cappedRadius };
}

/**
 * Get offer by ID
 */
export async function getOfferById(offerId: string): Promise<Offer | null> {
  return dynamodb.get<Offer>(OFFERS_TABLE, { offerId });
}

/**
 * Accept offer
 */
export async function acceptOffer(
  offerId: string,
  vendorId: string
): Promise<{ offer: Offer; incident: Incident }> {
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new NotFoundError('Offer', offerId);
  }

  // Validate vendor
  if (offer.vendorId !== vendorId) {
    throw new ValidationError('Vendor ID does not match offer');
  }

  // Check if offer is still pending
  if (offer.status !== 'pending') {
    throw new ConflictError(`Offer is ${offer.status}, cannot accept`);
  }

  // Check if offer has expired
  const now = Math.floor(Date.now() / 1000);
  if (now > offer.expiresAt) {
    throw new ValidationError('Offer has expired');
  }

  // Get incident
  const incident = await dynamodb.get<Incident>(INCIDENTS_TABLE, {
    incidentId: offer.incidentId,
  });
  if (!incident) {
    throw new NotFoundError('Incident', offer.incidentId);
  }

  // Use optimistic locking to prevent concurrent acceptance
  try {
    await dynamodb.update(
      INCIDENTS_TABLE,
      { incidentId: offer.incidentId },
      {
        assignedVendorId: vendorId,
        updatedAt: new Date().toISOString(),
      },
      'attribute_not_exists(assignedVendorId)' // Condition: no vendor assigned yet
    );
  } catch (error) {
    // Conditional check failed - another vendor already accepted
    throw new ConflictError('Incident already assigned to another vendor');
  }

  // Update offer status
  await dynamodb.update(OFFERS_TABLE, { offerId }, {
    status: 'accepted',
    respondedAt: new Date().toISOString(),
  });

  // Cancel other pending offers for this incident
  await cancelOtherOffers(offer.incidentId, offerId);

  // Publish OfferAccepted event
  await eventBridge.publishEvent({
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_ACCEPTED,
    detail: {
      offerId,
      incidentId: offer.incidentId,
      vendorId,
      acceptedAt: new Date().toISOString(),
    },
  });

  logger.info('Offer accepted', { offerId, incidentId: offer.incidentId, vendorId });

  const updatedIncident = await dynamodb.get<Incident>(INCIDENTS_TABLE, {
    incidentId: offer.incidentId,
  });

  return {
    offer: { ...offer, status: 'accepted', respondedAt: new Date().toISOString() },
    incident: updatedIncident!,
  };
}

/**
 * Decline offer
 */
export async function declineOffer(
  offerId: string,
  vendorId: string,
  reason?: string
): Promise<Offer> {
  const offer = await getOfferById(offerId);
  if (!offer) {
    throw new NotFoundError('Offer', offerId);
  }

  // Validate vendor
  if (offer.vendorId !== vendorId) {
    throw new ValidationError('Vendor ID does not match offer');
  }

  // Check if offer is still pending
  if (offer.status !== 'pending') {
    throw new ConflictError(`Offer is ${offer.status}, cannot decline`);
  }

  // Update offer status
  await dynamodb.update(OFFERS_TABLE, { offerId }, {
    status: 'declined',
    respondedAt: new Date().toISOString(),
    declineReason: reason,
  });

  // Publish OfferDeclined event
  await eventBridge.publishEvent({
    source: EventSources.MATCH_SERVICE,
    detailType: EventTypes.OFFER_DECLINED,
    detail: {
      offerId,
      incidentId: offer.incidentId,
      vendorId,
      reason,
      declinedAt: new Date().toISOString(),
    },
  });

  logger.info('Offer declined', { offerId, incidentId: offer.incidentId, vendorId, reason });

  return {
    ...offer,
    status: 'declined',
    respondedAt: new Date().toISOString(),
    declineReason: reason,
  };
}

/**
 * Cancel other pending offers for an incident
 */
async function cancelOtherOffers(incidentId: string, acceptedOfferId: string): Promise<void> {
  // Query all offers for this incident
  const offers = await dynamodb.query<Offer>(
    OFFERS_TABLE,
    'incidentId = :incidentId',
    { ':incidentId': incidentId },
    'incident-status-index'
  );

  // Cancel pending offers (except the accepted one)
  const pendingOffers = offers.filter(
    (o) => o.offerId !== acceptedOfferId && o.status === 'pending'
  );

  for (const offer of pendingOffers) {
    await dynamodb.update(OFFERS_TABLE, { offerId: offer.offerId }, {
      status: 'cancelled',
      respondedAt: new Date().toISOString(),
    });

    logger.info('Offer cancelled', {
      offerId: offer.offerId,
      incidentId,
      reason: 'Another vendor accepted',
    });
  }
}

/**
 * Get offers by incident
 */
export async function getOffersByIncident(incidentId: string): Promise<Offer[]> {
  return dynamodb.query<Offer>(
    OFFERS_TABLE,
    'incidentId = :incidentId',
    { ':incidentId': incidentId },
    'incident-status-index'
  );
}

/**
 * Get offers by vendor
 */
export async function getOffersByVendor(
  vendorId: string,
  status?: OfferStatus
): Promise<Offer[]> {
  const keyCondition = status
    ? 'vendorId = :vendorId AND status = :status'
    : 'vendorId = :vendorId';
  const expressionValues = status
    ? { ':vendorId': vendorId, ':status': status }
    : { ':vendorId': vendorId };

  return dynamodb.query<Offer>(
    OFFERS_TABLE,
    keyCondition,
    expressionValues,
    'vendor-status-index'
  );
}
