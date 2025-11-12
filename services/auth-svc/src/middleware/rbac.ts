import { UserRole } from '@roadcall/types';
import { AuthorizationError, logger } from '@roadcall/utils';

/**
 * Permission definitions
 */
export enum Permission {
  // Incident permissions
  CREATE_INCIDENT = 'incident:create',
  VIEW_INCIDENT = 'incident:view',
  UPDATE_INCIDENT = 'incident:update',
  CANCEL_INCIDENT = 'incident:cancel',

  // Offer permissions
  VIEW_OFFER = 'offer:view',
  ACCEPT_OFFER = 'offer:accept',
  DECLINE_OFFER = 'offer:decline',

  // Payment permissions
  VIEW_PAYMENT = 'payment:view',
  APPROVE_PAYMENT = 'payment:approve',
  PROCESS_PAYMENT = 'payment:process',

  // Admin permissions
  MANAGE_USERS = 'admin:users',
  MANAGE_CONFIG = 'admin:config',
  VIEW_ANALYTICS = 'admin:analytics',
}

/**
 * Role-based permission mapping
 */
const rolePermissions: Record<UserRole, Permission[]> = {
  driver: [
    Permission.CREATE_INCIDENT,
    Permission.VIEW_INCIDENT,
    Permission.CANCEL_INCIDENT,
  ],
  vendor: [
    Permission.VIEW_OFFER,
    Permission.ACCEPT_OFFER,
    Permission.DECLINE_OFFER,
    Permission.VIEW_INCIDENT,
    Permission.UPDATE_INCIDENT,
    Permission.VIEW_PAYMENT,
  ],
  dispatcher: [
    Permission.VIEW_INCIDENT,
    Permission.UPDATE_INCIDENT,
    Permission.VIEW_PAYMENT,
    Permission.APPROVE_PAYMENT,
    Permission.VIEW_ANALYTICS,
  ],
  admin: Object.values(Permission),
};

/**
 * Check if user has permission
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  const permissions = rolePermissions[role];
  return permissions.includes(permission);
}

/**
 * Require permission middleware
 */
export function requirePermission(permission: Permission) {
  return (role: UserRole, userId: string) => {
    if (!hasPermission(role, permission)) {
      logger.warn('Permission denied', { userId, role, permission });
      throw new AuthorizationError(`Permission denied: ${permission}`);
    }
  };
}

/**
 * Check resource ownership
 */
export function canAccessResource(
  role: UserRole,
  userId: string,
  resource: { type: string; ownerId?: string; companyId?: string },
  userCompanyId?: string
): boolean {
  // Admins can access everything
  if (role === 'admin') {
    return true;
  }

  // Dispatchers can access resources in their company
  if (role === 'dispatcher' && userCompanyId && resource.companyId === userCompanyId) {
    return true;
  }

  // Users can access their own resources
  if (resource.ownerId === userId) {
    return true;
  }

  return false;
}
