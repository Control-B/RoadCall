/**
 * Service Discovery with AWS Cloud Map
 * 
 * Provides service registration and discovery capabilities
 * for microservices architecture.
 */

import {
  ServiceDiscoveryClient,
  RegisterInstanceCommand,
  DeregisterInstanceCommand,
  DiscoverInstancesCommand,
  GetInstancesHealthStatusCommand,
  UpdateInstanceCustomHealthStatusCommand,
} from '@aws-sdk/client-servicediscovery';
import { logger } from './logger';

export interface ServiceInstance {
  instanceId: string;
  serviceName: string;
  ipv4?: string;
  port?: number;
  attributes?: Record<string, string>;
  healthStatus?: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN';
}

export interface ServiceDiscoveryConfig {
  namespaceId: string;
  serviceName: string;
  instanceId: string;
  attributes?: Record<string, string>;
  healthCheckUrl?: string;
}

/**
 * Service Discovery Manager
 */
export class ServiceDiscoveryManager {
  private client: ServiceDiscoveryClient;
  private config: ServiceDiscoveryConfig;
  private registered = false;

  constructor(config: ServiceDiscoveryConfig) {
    this.client = new ServiceDiscoveryClient({});
    this.config = config;
  }

  /**
   * Register service instance with Cloud Map
   */
  async register(): Promise<void> {
    try {
      const attributes: Record<string, string> = {
        AWS_INSTANCE_IPV4: process.env.AWS_INSTANCE_IPV4 || '127.0.0.1',
        AWS_INSTANCE_PORT: process.env.AWS_INSTANCE_PORT || '3000',
        ...this.config.attributes,
      };

      // Add health check URL if provided
      if (this.config.healthCheckUrl) {
        attributes.HEALTH_CHECK_URL = this.config.healthCheckUrl;
      }

      await this.client.send(
        new RegisterInstanceCommand({
          ServiceId: this.config.serviceName,
          InstanceId: this.config.instanceId,
          Attributes: attributes,
        })
      );

      this.registered = true;

      logger.info('Service instance registered with Cloud Map', {
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
        attributes,
      });
    } catch (error) {
      logger.error('Failed to register service instance', error instanceof Error ? error : new Error(String(error)), {
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
      });
      throw error;
    }
  }

  /**
   * Deregister service instance from Cloud Map
   */
  async deregister(): Promise<void> {
    if (!this.registered) {
      return;
    }

    try {
      await this.client.send(
        new DeregisterInstanceCommand({
          ServiceId: this.config.serviceName,
          InstanceId: this.config.instanceId,
        })
      );

      this.registered = false;

      logger.info('Service instance deregistered from Cloud Map', {
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
      });
    } catch (error) {
      logger.error('Failed to deregister service instance', error instanceof Error ? error : new Error(String(error)), {
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
      });
      throw error;
    }
  }

  /**
   * Update instance health status
   */
  async updateHealthStatus(status: 'HEALTHY' | 'UNHEALTHY'): Promise<void> {
    try {
      await this.client.send(
        new UpdateInstanceCustomHealthStatusCommand({
          ServiceId: this.config.serviceName,
          InstanceId: this.config.instanceId,
          Status: status,
        })
      );

      logger.info('Instance health status updated', {
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
        status,
      });
    } catch (error) {
      logger.error('Failed to update health status', error instanceof Error ? error : new Error(String(error)), {
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
      });
    }
  }

  /**
   * Discover healthy instances of a service
   */
  async discoverInstances(
    serviceName: string,
    namespaceId: string
  ): Promise<ServiceInstance[]> {
    try {
      const response = await this.client.send(
        new DiscoverInstancesCommand({
          NamespaceName: namespaceId,
          ServiceName: serviceName,
          HealthStatus: 'HEALTHY',
        })
      );

      const instances: ServiceInstance[] = (response.Instances || []).map(
        (instance: any) => ({
          instanceId: instance.InstanceId || '',
          serviceName,
          ipv4: instance.Attributes?.AWS_INSTANCE_IPV4,
          port: instance.Attributes?.AWS_INSTANCE_PORT
            ? parseInt(instance.Attributes.AWS_INSTANCE_PORT, 10)
            : undefined,
          attributes: instance.Attributes,
          healthStatus: instance.HealthStatus as 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN',
        })
      );

      logger.info('Discovered service instances', {
        serviceName,
        count: instances.length,
      });

      return instances;
    } catch (error) {
      logger.error('Failed to discover service instances', error instanceof Error ? error : new Error(String(error)), {
        serviceName,
      });
      return [];
    }
  }

  /**
   * Get health status of all instances
   */
  async getInstancesHealthStatus(
    serviceName: string
  ): Promise<Map<string, 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'>> {
    try {
      const response = await this.client.send(
        new GetInstancesHealthStatusCommand({
          ServiceId: serviceName,
        })
      );

      const healthMap = new Map<string, 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'>();

      if (response.Status) {
        Object.entries(response.Status).forEach(([instanceId, status]) => {
          healthMap.set(instanceId, status as 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN');
        });
      }

      return healthMap;
    } catch (error) {
      logger.error('Failed to get instances health status', error instanceof Error ? error : new Error(String(error)), {
        serviceName,
      });
      return new Map();
    }
  }

  /**
   * Setup graceful shutdown handler
   */
  setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      logger.info('Received shutdown signal, deregistering service', {
        signal,
        serviceName: this.config.serviceName,
        instanceId: this.config.instanceId,
      });

      try {
        await this.deregister();
        process.exit(0);
      } catch (error) {
        logger.error('Error during graceful shutdown', error instanceof Error ? error : new Error(String(error)));
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  }
}

/**
 * Create a service discovery manager with automatic registration
 */
export async function createServiceDiscovery(
  config: ServiceDiscoveryConfig
): Promise<ServiceDiscoveryManager> {
  const manager = new ServiceDiscoveryManager(config);
  
  // Register on startup
  await manager.register();
  
  // Setup graceful shutdown
  manager.setupGracefulShutdown();
  
  return manager;
}

/**
 * Simple service locator for discovering service endpoints
 */
export class ServiceLocator {
  private client: ServiceDiscoveryClient;
  private cache: Map<string, { instances: ServiceInstance[]; timestamp: number }> = new Map();
  private cacheTTL: number;

  constructor(cacheTTL: number = 60000) {
    this.client = new ServiceDiscoveryClient({});
    this.cacheTTL = cacheTTL;
  }

  /**
   * Get a healthy instance of a service (with caching)
   */
  async getServiceInstance(
    serviceName: string,
    namespaceId: string
  ): Promise<ServiceInstance | null> {
    const instances = await this.getServiceInstances(serviceName, namespaceId);
    
    if (instances.length === 0) {
      return null;
    }

    // Return random instance for load balancing
    return instances[Math.floor(Math.random() * instances.length)];
  }

  /**
   * Get all healthy instances of a service (with caching)
   */
  async getServiceInstances(
    serviceName: string,
    namespaceId: string
  ): Promise<ServiceInstance[]> {
    const cacheKey = `${namespaceId}:${serviceName}`;
    const cached = this.cache.get(cacheKey);

    // Return cached instances if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.instances;
    }

    // Discover instances
    try {
      const response = await this.client.send(
        new DiscoverInstancesCommand({
          NamespaceName: namespaceId,
          ServiceName: serviceName,
          HealthStatus: 'HEALTHY',
        })
      );

      const instances: ServiceInstance[] = (response.Instances || []).map(
        (instance: any) => ({
          instanceId: instance.InstanceId || '',
          serviceName,
          ipv4: instance.Attributes?.AWS_INSTANCE_IPV4,
          port: instance.Attributes?.AWS_INSTANCE_PORT
            ? parseInt(instance.Attributes.AWS_INSTANCE_PORT, 10)
            : undefined,
          attributes: instance.Attributes,
          healthStatus: 'HEALTHY' as const,
        })
      );

      // Update cache
      this.cache.set(cacheKey, {
        instances,
        timestamp: Date.now(),
      });

      return instances;
    } catch (error) {
      logger.error('Failed to discover service instances', error instanceof Error ? error : new Error(String(error)), {
        serviceName,
        namespaceId,
      });

      // Return cached instances if available, even if expired
      return cached?.instances || [];
    }
  }

  /**
   * Clear cache for a specific service or all services
   */
  clearCache(serviceName?: string, namespaceId?: string): void {
    if (serviceName && namespaceId) {
      this.cache.delete(`${namespaceId}:${serviceName}`);
    } else {
      this.cache.clear();
    }
  }
}
