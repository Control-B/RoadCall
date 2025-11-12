import { SecretsManagerWrapper } from '../secrets';
import { SecretValue } from '@roadcall/utils';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
  ResourceNotFoundException,
} from '@aws-sdk/client-secrets-manager';

// Mock the AWS SDK
jest.mock('@aws-sdk/client-secrets-manager');

describe('SecretsManagerWrapper', () => {
  let secretsManager: SecretsManagerWrapper;
  let mockSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend = jest.fn();
    (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
      send: mockSend,
    }));
    secretsManager = new SecretsManagerWrapper('us-east-1', 1000); // 1 second TTL for testing
  });

  describe('getSecret', () => {
    it('should retrieve secret from Secrets Manager', async () => {
      const secretValue = 'my-secret-value';
      mockSend.mockResolvedValueOnce({
        SecretString: secretValue,
        VersionId: 'v1',
      });

      const result = await secretsManager.getSecret('test-secret');

      expect(result).toBe(secretValue);
      expect(mockSend).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
    });

    it('should cache secrets and reuse cached values', async () => {
      const secretValue = 'cached-secret';
      mockSend.mockResolvedValueOnce({
        SecretString: secretValue,
        VersionId: 'v1',
      });

      // First call - fetches from Secrets Manager
      const result1 = await secretsManager.getSecret('test-secret');
      expect(result1).toBe(secretValue);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call - uses cache
      const result2 = await secretsManager.getSecret('test-secret');
      expect(result2).toBe(secretValue);
      expect(mockSend).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('should bypass cache when useCache is false', async () => {
      const secretValue = 'no-cache-secret';
      mockSend.mockResolvedValue({
        SecretString: secretValue,
        VersionId: 'v1',
      });

      // First call with cache disabled
      await secretsManager.getSecret('test-secret', false);
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Second call with cache disabled
      await secretsManager.getSecret('test-secret', false);
      expect(mockSend).toHaveBeenCalledTimes(2); // Called twice
    });

    it('should handle ResourceNotFoundException', async () => {
      mockSend.mockRejectedValueOnce(new ResourceNotFoundException({ message: 'Not found', $metadata: {} }));

      await expect(secretsManager.getSecret('non-existent')).rejects.toThrow(
        'Secret non-existent not found'
      );
    });

    it('should handle generic errors', async () => {
      mockSend.mockRejectedValueOnce(new Error('Network error'));

      await expect(secretsManager.getSecret('test-secret')).rejects.toThrow(
        'Failed to retrieve secret from Secrets Manager'
      );
    });
  });

  describe('getSecretValue', () => {
    it('should return SecretValue wrapper', async () => {
      const secretValue = 'wrapped-secret';
      mockSend.mockResolvedValueOnce({
        SecretString: secretValue,
        VersionId: 'v1',
      });

      const result = await secretsManager.getSecretValue('test-secret');

      expect(result).toBeInstanceOf(SecretValue);
      expect(result.getValue()).toBe(secretValue);
      expect(result.getName()).toBe('test-secret');
    });
  });

  describe('getSecretJSON', () => {
    it('should parse JSON secrets and wrap string values', async () => {
      const secretJson = JSON.stringify({
        apiKey: 'sk_test_123',
        endpoint: 'https://api.example.com',
      });

      mockSend.mockResolvedValueOnce({
        SecretString: secretJson,
        VersionId: 'v1',
      });

      const result = await secretsManager.getSecretJSON<{
        apiKey: SecretValue;
        endpoint: string;
      }>('test-secret');

      expect(result.apiKey).toBeInstanceOf(SecretValue);
      expect(result.apiKey.getValue()).toBe('sk_test_123');
      expect(result.endpoint).toBe('https://api.example.com');
    });

    it('should handle invalid JSON', async () => {
      mockSend.mockResolvedValueOnce({
        SecretString: 'not-valid-json',
        VersionId: 'v1',
      });

      await expect(secretsManager.getSecretJSON('test-secret')).rejects.toThrow(
        'Failed to parse secret test-secret as JSON'
      );
    });
  });

  describe('getSecretJSONRaw', () => {
    it('should parse JSON without wrapping in SecretValue', async () => {
      const secretJson = JSON.stringify({
        apiKey: 'sk_test_123',
        endpoint: 'https://api.example.com',
      });

      mockSend.mockResolvedValueOnce({
        SecretString: secretJson,
        VersionId: 'v1',
      });

      const result = await secretsManager.getSecretJSONRaw<{
        apiKey: string;
        endpoint: string;
      }>('test-secret');

      expect(result.apiKey).toBe('sk_test_123');
      expect(result.endpoint).toBe('https://api.example.com');
      expect(result.apiKey).not.toBeInstanceOf(SecretValue);
    });
  });

  describe('clearCache', () => {
    it('should clear specific secret from cache', async () => {
      mockSend.mockResolvedValue({
        SecretString: 'secret-value',
        VersionId: 'v1',
      });

      // Cache the secret
      await secretsManager.getSecret('test-secret');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Clear cache
      secretsManager.clearCache('test-secret');

      // Next call should fetch again
      await secretsManager.getSecret('test-secret');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });

    it('should clear all secrets from cache', async () => {
      mockSend.mockResolvedValue({
        SecretString: 'secret-value',
        VersionId: 'v1',
      });

      // Cache multiple secrets
      await secretsManager.getSecret('secret-1');
      await secretsManager.getSecret('secret-2');
      expect(mockSend).toHaveBeenCalledTimes(2);

      // Clear all cache
      secretsManager.clearCache();

      // Next calls should fetch again
      await secretsManager.getSecret('secret-1');
      await secretsManager.getSecret('secret-2');
      expect(mockSend).toHaveBeenCalledTimes(4);
    });
  });

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      mockSend.mockResolvedValue({
        SecretString: 'secret-value',
        VersionId: 'v1',
      });

      // Cache some secrets
      await secretsManager.getSecret('secret-1');
      await secretsManager.getSecret('secret-2');

      const stats = secretsManager.getCacheStats();

      expect(stats.size).toBe(2);
      expect(stats.keys).toContain('secret-1');
      expect(stats.keys).toContain('secret-2');
    });
  });

  describe('cache expiration', () => {
    it('should expire cached secrets after TTL', async () => {
      mockSend.mockResolvedValue({
        SecretString: 'secret-value',
        VersionId: 'v1',
      });

      // Cache the secret
      await secretsManager.getSecret('test-secret');
      expect(mockSend).toHaveBeenCalledTimes(1);

      // Wait for cache to expire (TTL is 1 second in test setup)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Next call should fetch again
      await secretsManager.getSecret('test-secret');
      expect(mockSend).toHaveBeenCalledTimes(2);
    });
  });
});
