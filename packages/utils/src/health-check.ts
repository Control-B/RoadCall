/**
 * Health Check Utilities
 * 
 * Provides health check endpoints and dependency monitoring
 * for microservices.
 */

import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import { logger } from './logger';
import { getAllCircuitBreakerStats } from './external-services';

export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
}

export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: string;
  service: string;
  version?: string;
  checks: {
    [key: string]: {
      status: HealthStatus;
      message?: string;
      responseTime?: number;
    };
  };
  circuitBreakers?: ReturnType<typeof getAllCircuitBreakerStats>;
}

export interface HealthCheckConfig {
  serviceName: string;
  version?: string;
  checks?: HealthCheck[];
}

export interface HealthCheck {
  name: string;
  check: () => Promise<{ healthy: boolean; message?: string }>;
  critical?: boolean; // If true, failure marks service as unhealthy
}

/**
 * Health Check Manager
 */
export class HealthCheckManager {
  private config: HealthCheckConfig;
  private checks: Map<string, HealthCheck> = new Map();

  constructor(config: HealthCheckConfig) {
    this.config = config;
    
    // Register provided checks
    if (config.checks) {
      config.checks.forEach(check => this.registerCheck(check));
    }
  }

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.set(check.name, check);
    logger.info('Health check registered', {
      service: this.config.serviceName,
      check: check.name,
      critical: check.critical,
    });
  }

  /**
   * Execute all health checks
   */
  async executeHealthChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const checkResults: HealthCheckResult['checks'] = {};
    let overallStatus = HealthStatus.HEALTHY;

    // Execute all checks in parallel
    const checkPromises = Array.from(this.checks.entries()).map(
      async ([name, check]) => {
        const checkStartTime = Date.now();
        try {
          const result = await Promise.race([
            check.check(),
            new Promise<{ healthy: boolean; message: string }>((_, reject) =>
              setTimeout(() => reject(new Error('Health check timeout')), 5000)
            ),
          ]);

          const responseTime = Date.now() - checkStartTime;
          const status = result.healthy ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY;

          checkResults[name] = {
            status,
            message: result.message,
            responseTime,
          };

          // Update overall status
          if (!result.healthy) {
            if (check.critical) {
              overallStatus = HealthStatus.UNHEALTHY;
            } else if (overallStatus === HealthStatus.HEALTHY) {
              overallStatus = HealthStatus.DEGRADED;
            }
          }
        } catch (error) {
          const responseTime = Date.now() - checkStartTime;
          checkResults[name] = {
            status: HealthStatus.UNHEALTHY,
            message: error instanceof Error ? error.message : 'Check failed',
            responseTime,
          };

          if (check.critical) {
            overallStatus = HealthStatus.UNHEALTHY;
          } else if (overallStatus === HealthStatus.HEALTHY) {
            overallStatus = HealthStatus.DEGRADED;
          }
        }
      }
    );

    await Promise.all(checkPromises);

    const result: HealthCheckResult = {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      service: this.config.serviceName,
      version: this.config.version,
      checks: checkResults,
      circuitBreakers: getAllCircuitBreakerStats(),
    };

    logger.info('Health check completed', {
      service: this.config.serviceName,
      status: overallStatus,
      duration: Date.now() - startTime,
    });

    return result;
  }

  /**
   * Simple liveness check (always returns healthy if service is running)
   */
  async liveness(): Promise<{ alive: boolean }> {
    return { alive: true };
  }

  /**
   * Readiness check (checks if service is ready to accept traffic)
   */
  async readiness(): Promise<HealthCheckResult> {
    return this.executeHealthChecks();
  }
}

/**
 * Common health checks
 */

/**
 * DynamoDB table health check
 */
export function createDynamoDBHealthCheck(
  tableName: string,
  client?: DynamoDBClient
): HealthCheck {
  const dynamoClient = client || new DynamoDBClient({});

  return {
    name: `dynamodb-${tableName}`,
    check: async () => {
      try {
        await dynamoClient.send(
          new DescribeTableCommand({ TableName: tableName })
        );
        return { healthy: true, message: 'Table accessible' };
      } catch (error) {
        return {
          healthy: false,
          message: error instanceof Error ? error.message : 'Table check failed',
        };
      }
    },
    critical: true,
  };
}

/**
 * Environment variable health check
 */
export function createEnvVarHealthCheck(
  requiredVars: string[]
): HealthCheck {
  return {
    name: 'environment-variables',
    check: async () => {
      const missing = requiredVars.filter(varName => !process.env[varName]);
      
      if (missing.length > 0) {
        return {
          healthy: false,
          message: `Missing required environment variables: ${missing.join(', ')}`,
        };
      }
      
      return { healthy: true, message: 'All required variables present' };
    },
    critical: true,
  };
}

/**
 * Memory usage health check
 */
export function createMemoryHealthCheck(
  thresholdPercent: number = 90
): HealthCheck {
  return {
    name: 'memory-usage',
    check: async () => {
      const usage = process.memoryUsage();
      const heapUsedPercent = (usage.heapUsed / usage.heapTotal) * 100;
      
      if (heapUsedPercent > thresholdPercent) {
        return {
          healthy: false,
          message: `Memory usage at ${heapUsedPercent.toFixed(2)}%`,
        };
      }
      
      return {
        healthy: true,
        message: `Memory usage at ${heapUsedPercent.toFixed(2)}%`,
      };
    },
    critical: false,
  };
}

/**
 * Generic HTTP endpoint health check
 */
export function createHttpHealthCheck(
  name: string,
  url: string,
  expectedStatus: number = 200
): HealthCheck {
  return {
    name: `http-${name}`,
    check: async () => {
      try {
        const response = await fetch(url, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        if (response.status === expectedStatus) {
          return { healthy: true, message: `Endpoint responding with ${response.status}` };
        }
        
        return {
          healthy: false,
          message: `Unexpected status: ${response.status}`,
        };
      } catch (error) {
        return {
          healthy: false,
          message: error instanceof Error ? error.message : 'Request failed',
        };
      }
    },
    critical: false,
  };
}

/**
 * Create a Lambda handler for health check endpoints
 */
export function createHealthCheckHandler(manager: HealthCheckManager) {
  return {
    /**
     * Liveness probe handler
     */
    liveness: async () => {
      const result = await manager.liveness();
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
    },

    /**
     * Readiness probe handler
     */
    readiness: async () => {
      const result = await manager.readiness();
      const statusCode = result.status === HealthStatus.HEALTHY ? 200 : 503;
      
      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
    },

    /**
     * Detailed health check handler
     */
    health: async () => {
      const result = await manager.executeHealthChecks();
      const statusCode = result.status === HealthStatus.UNHEALTHY ? 503 : 200;
      
      return {
        statusCode,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(result),
      };
    },
  };
}
