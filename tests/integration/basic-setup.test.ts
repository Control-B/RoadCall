/**
 * Basic Setup Test
 * Verifies test environment is configured correctly
 */

describe('Basic Setup Test', () => {
  it('should have test environment configured', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });
  
  it('should have AWS region configured', () => {
    expect(process.env.AWS_REGION).toBeDefined();
  });
  
  it('should be able to perform basic assertions', () => {
    expect(1 + 1).toBe(2);
    expect('test').toBe('test');
    expect(true).toBe(true);
  });
  
  it('should be able to use async/await', async () => {
    const result = await Promise.resolve('success');
    expect(result).toBe('success');
  });
  
  it('should have test utilities available', () => {
    expect(global.testUtils).toBeDefined();
    expect(global.testUtils.sleep).toBeDefined();
    expect(global.testUtils.generateTestId).toBeDefined();
    expect(global.testUtils.waitFor).toBeDefined();
  });
  
  it('should be able to generate test IDs', () => {
    const id1 = global.testUtils.generateTestId('test');
    const id2 = global.testUtils.generateTestId('test');
    
    expect(id1).toMatch(/^test-/);
    expect(id2).toMatch(/^test-/);
    expect(id1).not.toBe(id2);
  });
  
  it('should be able to sleep', async () => {
    const start = Date.now();
    await global.testUtils.sleep(100);
    const duration = Date.now() - start;
    
    expect(duration).toBeGreaterThanOrEqual(95); // Allow small timing variance
    expect(duration).toBeLessThan(200);
  });
});
