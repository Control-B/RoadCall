import {
  SecretValue,
  parseSecretJSON,
  sanitizeForLogging,
  validateSecret,
  maskSecret,
} from '../secret-handler';

describe('SecretValue', () => {
  it('should wrap secret value and prevent logging', () => {
    const secret = new SecretValue('my-secret-key', 'api-key');

    expect(secret.getValue()).toBe('my-secret-key');
    expect(secret.getName()).toBe('api-key');
    expect(secret.toString()).toBe('[SecretValue:api-key]');
    expect(secret.toJSON()).toBe('[SecretValue:api-key]');
    expect(String(secret)).toBe('[SecretValue:api-key]');
  });

  it('should prevent accidental exposure in JSON.stringify', () => {
    const secret = new SecretValue('sensitive-data', 'password');
    const obj = { password: secret, username: 'john' };

    const json = JSON.stringify(obj);

    expect(json).not.toContain('sensitive-data');
    expect(json).toContain('[SecretValue:password]');
  });

  it('should prevent exposure in console.log', () => {
    const secret = new SecretValue('secret-123', 'token');
    const logOutput = String(secret);

    expect(logOutput).not.toContain('secret-123');
    expect(logOutput).toBe('[SecretValue:token]');
  });
});

describe('parseSecretJSON', () => {
  it('should parse JSON and wrap string values in SecretValue', () => {
    const secretJson = JSON.stringify({
      apiKey: 'sk_test_123',
      endpoint: 'https://api.example.com',
      port: 443,
    });

    const result = parseSecretJSON(secretJson, 'test-secret');

    expect(result.apiKey).toBeInstanceOf(SecretValue);
    expect(result.apiKey.getValue()).toBe('sk_test_123');
    expect(result.endpoint).toBe('https://api.example.com');
    expect(result.port).toBe(443);
  });

  it('should throw error for invalid JSON', () => {
    expect(() => parseSecretJSON('not-valid-json', 'test-secret')).toThrow(
      'Failed to parse secret JSON for test-secret'
    );
  });
});

describe('sanitizeForLogging', () => {
  it('should sanitize SecretValue instances', () => {
    const obj = {
      apiKey: new SecretValue('secret-123', 'api-key'),
      username: 'john',
    };

    const sanitized = sanitizeForLogging(obj);

    expect(sanitized.apiKey).toBe('[SecretValue:api-key]');
    expect(sanitized.username).toBe('john');
  });

  it('should redact common secret field names', () => {
    const obj = {
      password: 'my-password',
      apiKey: 'my-api-key',
      secret: 'my-secret',
      token: 'my-token',
      username: 'john',
    };

    const sanitized = sanitizeForLogging(obj);

    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.apiKey).toBe('[REDACTED]');
    expect(sanitized.secret).toBe('[REDACTED]');
    expect(sanitized.token).toBe('[REDACTED]');
    expect(sanitized.username).toBe('john');
  });

  it('should handle nested objects', () => {
    const obj = {
      user: {
        username: 'john',
        password: 'secret-password',
      },
      config: {
        apiKey: new SecretValue('key-123', 'api-key'),
      },
    };

    const sanitized = sanitizeForLogging(obj);

    expect(sanitized.user.username).toBe('john');
    expect(sanitized.user.password).toBe('[REDACTED]');
    expect(sanitized.config.apiKey).toBe('[SecretValue:api-key]');
  });

  it('should handle arrays', () => {
    const obj = {
      keys: [
        new SecretValue('secret-1', 'key-1'),
        new SecretValue('secret-2', 'key-2'),
      ],
    };

    const sanitized = sanitizeForLogging(obj);

    expect(sanitized.keys[0]).toBe('[SecretValue:key-1]');
    expect(sanitized.keys[1]).toBe('[SecretValue:key-2]');
  });

  it('should handle null and undefined', () => {
    expect(sanitizeForLogging(null)).toBeNull();
    expect(sanitizeForLogging(undefined)).toBeUndefined();
  });
});

describe('validateSecret', () => {
  it('should accept valid secrets', () => {
    expect(() => validateSecret('valid-secret-key', 'test-secret')).not.toThrow();
    expect(() =>
      validateSecret(new SecretValue('valid-key', 'test'), 'test-secret')
    ).not.toThrow();
  });

  it('should reject empty secrets', () => {
    expect(() => validateSecret('', 'test-secret')).toThrow('Secret test-secret is empty');
    expect(() => validateSecret('   ', 'test-secret')).toThrow('Secret test-secret is empty');
  });

  it('should reject placeholder values', () => {
    const placeholders = [
      'PLACEHOLDER',
      'REPLACE_WITH_ACTUAL_KEY',
      'TODO: Add key',
      'changeme',
      'xxx',
      'test-key',
    ];

    placeholders.forEach((placeholder) => {
      expect(() => validateSecret(placeholder, 'test-secret')).toThrow(
        'Secret test-secret contains placeholder value'
      );
    });
  });

  it('should accept secrets with valid content even if they contain common words', () => {
    // These should pass because they're actual API keys, not placeholders
    expect(() => validateSecret('sk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX', 'stripe-key')).not.toThrow();
    expect(() => validateSecret('prod_api_key_XXXXXXXXXXXXXXXX', 'api-key')).not.toThrow();
  });
});

describe('maskSecret', () => {
  it('should mask long secrets', () => {
    const secret = 'sk_live_1234567890abcdef';
    const masked = maskSecret(secret);

    expect(masked).toBe('sk_l...cdef');
    expect(masked).not.toContain('1234567890');
  });

  it('should mask short secrets completely', () => {
    const secret = 'short';
    const masked = maskSecret(secret);

    expect(masked).toBe('****');
  });

  it('should handle exactly 8 character secrets', () => {
    const secret = '12345678';
    const masked = maskSecret(secret);

    expect(masked).toBe('****');
  });
});
