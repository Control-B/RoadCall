import { Driver, DriverStatus, DriverPreferences, Incident, PaginatedResponse } from '@roadcall/types';
import { dynamodb } from '@roadcall/aws-clients';
import { logger, NotFoundError } from '@roadcall/utils';

const USERS_TABLE = process.env.USERS_TABLE || '';
const INCIDENTS_TABLE = process.env.INCIDENTS_TABLE || '';

/**
 * Get driver by ID
 */
export async function getDriverById(driverId: string): Promise<Driver | null> {
  const driver = await dynamodb.get<Driver>(USERS_TABLE, { userId: driverId });

  if (!driver || driver.userId !== driverId) {
    return null;
  }

  return driver as unknown as Driver;
}

/**
 * Create driver profile
 */
export async function createDriver(
  userId: string,
  phone: string,
  name: string,
  companyId: string,
  companyName: string,
  truckNumber: string,
  email?: string,
  licenseNumber?: string,
  licenseState?: string,
  paymentType: 'company' | 'independent_contractor' = 'company'
): Promise<Driver> {
  const driver: Driver = {
    driverId: userId,
    userId,
    phone,
    name,
    email,
    companyId,
    companyName,
    truckNumber,
    licenseNumber,
    licenseState,
    paymentType,
    preferences: {
      language: 'en',
      autoShareLocation: true,
    },
    stats: {
      totalIncidents: 0,
      avgRating: 0,
    },
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await dynamodb.put(USERS_TABLE, driver);

  logger.info('Driver profile created', { driverId: driver.driverId });

  return driver;
}

/**
 * Update driver profile
 */
export async function updateDriver(
  driverId: string,
  updates: Partial<Omit<Driver, 'driverId' | 'userId' | 'createdAt'>>
): Promise<Driver> {
  const driver = await getDriverById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver', driverId);
  }

  const updatedFields = {
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await dynamodb.update(USERS_TABLE, { userId: driverId }, updatedFields);

  const updatedDriver = await getDriverById(driverId);
  if (!updatedDriver) {
    throw new Error('Driver not found after update');
  }

  logger.info('Driver profile updated', { driverId });

  return updatedDriver;
}

/**
 * Get driver preferences
 */
export async function getDriverPreferences(driverId: string): Promise<DriverPreferences> {
  const driver = await getDriverById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver', driverId);
  }

  return driver.preferences;
}

/**
 * Update driver preferences
 */
export async function updateDriverPreferences(
  driverId: string,
  preferences: Partial<DriverPreferences>
): Promise<DriverPreferences> {
  const driver = await getDriverById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver', driverId);
  }

  const updatedPreferences = {
    ...driver.preferences,
    ...preferences,
  };

  await dynamodb.update(USERS_TABLE, { userId: driverId }, {
    preferences: updatedPreferences,
    updatedAt: new Date().toISOString(),
  });

  logger.info('Driver preferences updated', { driverId });

  return updatedPreferences;
}

/**
 * Get driver incident history with pagination
 */
export async function getDriverIncidents(
  driverId: string,
  limit: number = 20
): Promise<PaginatedResponse<Incident>> {
  // Query incidents by driver ID using GSI
  const incidents = await dynamodb.query<Incident>(
    INCIDENTS_TABLE,
    'driverId = :driverId',
    { ':driverId': driverId },
    'driver-status-index',
    limit
  );

  // Sort by creation date (most recent first)
  incidents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  logger.info('Driver incidents retrieved', { driverId, count: incidents.length });

  return {
    items: incidents,
    total: incidents.length,
  };
}

/**
 * Update driver stats after incident completion
 */
export async function updateDriverStats(
  driverId: string,
  rating?: number
): Promise<void> {
  const driver = await getDriverById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver', driverId);
  }

  const totalIncidents = driver.stats.totalIncidents + 1;
  let avgRating = driver.stats.avgRating;

  if (rating !== undefined) {
    // Calculate new average rating
    const totalRating = driver.stats.avgRating * driver.stats.totalIncidents + rating;
    avgRating = totalRating / totalIncidents;
  }

  await dynamodb.update(USERS_TABLE, { userId: driverId }, {
    stats: {
      totalIncidents,
      avgRating,
      lastIncidentAt: new Date().toISOString(),
    },
    updatedAt: new Date().toISOString(),
  });

  logger.info('Driver stats updated', { driverId, totalIncidents, avgRating });
}

/**
 * Get drivers by company
 */
export async function getDriversByCompany(companyId: string): Promise<Driver[]> {
  const drivers = await dynamodb.query<Driver>(
    USERS_TABLE,
    'companyId = :companyId',
    { ':companyId': companyId },
    'company-index'
  );

  logger.info('Drivers retrieved by company', { companyId, count: drivers.length });

  return drivers;
}

/**
 * Update driver status
 */
export async function updateDriverStatus(
  driverId: string,
  status: DriverStatus
): Promise<void> {
  const driver = await getDriverById(driverId);
  if (!driver) {
    throw new NotFoundError('Driver', driverId);
  }

  await dynamodb.update(USERS_TABLE, { userId: driverId }, {
    status,
    updatedAt: new Date().toISOString(),
  });

  logger.info('Driver status updated', { driverId, status });
}
