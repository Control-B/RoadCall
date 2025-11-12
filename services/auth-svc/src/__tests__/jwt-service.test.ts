import { User } from '@roadcall/types';

// Mock the secretsManager before importing jwt-service
jest.mock('@roadcall/aws-clients', () => ({
  secretsManager: {
    getSecret: jest.fn().mockResolvedValue('test-secret-key-for-jwt-signing-minimum-32-chars'),
  },
}));

import { generateAccessToken, verifyToken } from '../jwt-service';

describe('JWT Service', () => {
  const mockUser: User = {
    userId: 'user-123',
    phone: '+15551234567',
    role: 'driver',
    name: 'Test User',
    createdAt: '2024-01-01T00:00:00Z',
    lastLoginAt: '2024-01-01T00:00:00Z',
  };

  describe('generateAccessToken', () => {
    it('should generate a valid JWT token', async () => {
      const token = await generateAccessToken(mockUser);

      expect(token).toBeDefined();
      expect(typeof token).toBe('string');
      expect(token.split('.')).toHaveLength(3); // JWT has 3 parts
    });
  });

  describe('verifyToken', () => {
    it('should verify and decode a valid token', async () => {
      const token = await generateAccessToken(mockUser);
      const decoded = await verifyToken(token);

      expect(decoded.userId).toBe(mockUser.userId);
      expect(decoded.phone).toBe(mockUser.phone);
      expect(decoded.role).toBe(mockUser.role);
    });

    it('should reject an invalid token', async () => {
      const invalidToken = 'invalid.token.here';

      await expect(verifyToken(invalidToken)).rejects.toThrow();
    });
  });
});
