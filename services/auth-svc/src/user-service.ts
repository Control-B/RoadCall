import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '@roadcall/types';
import { dynamodb } from '@roadcall/aws-clients';
import { logger, isValidE164Phone, ValidationError, ConflictError } from '@roadcall/utils';

const USERS_TABLE = process.env.USERS_TABLE || '';

/**
 * Check if user exists by phone number
 */
export async function getUserByPhone(phone: string): Promise<User | null> {
  const users = await dynamodb.query<User>(
    USERS_TABLE,
    'phone = :phone',
    { ':phone': phone },
    'phone-index',
    1
  );

  return users.length > 0 ? users[0] : null;
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string): Promise<User | null> {
  return dynamodb.get<User>(USERS_TABLE, { userId });
}

/**
 * Create new user
 */
export async function createUser(
  phone: string,
  role: UserRole,
  name: string,
  email?: string,
  companyId?: string,
  truckNumber?: string
): Promise<User> {
  // Validate phone number
  if (!isValidE164Phone(phone)) {
    throw new ValidationError('Invalid phone number format. Must be E.164 format (e.g., +15551234567)');
  }

  // Check if user already exists
  const existingUser = await getUserByPhone(phone);
  if (existingUser) {
    throw new ConflictError('User with this phone number already exists');
  }

  // Create user
  const user: User = {
    userId: uuidv4(),
    phone,
    role,
    name,
    email,
    companyId,
    truckNumber,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  await dynamodb.put(USERS_TABLE, user);

  logger.info('User created', { userId: user.userId, phone, role });

  return user;
}

/**
 * Update user's last login timestamp
 */
export async function updateLastLogin(userId: string): Promise<void> {
  await dynamodb.update(
    USERS_TABLE,
    { userId },
    { lastLoginAt: new Date().toISOString() }
  );

  logger.info('User last login updated', { userId });
}

/**
 * Update user profile
 */
export async function updateUser(
  userId: string,
  updates: Partial<Omit<User, 'userId' | 'phone' | 'createdAt'>>
): Promise<User> {
  await dynamodb.update(USERS_TABLE, { userId }, updates);

  const updatedUser = await getUserById(userId);
  if (!updatedUser) {
    throw new Error('User not found after update');
  }

  logger.info('User updated', { userId });

  return updatedUser;
}
