/**
 * Proxy Manager for IP Rotation
 * 
 * Manages proxy rotation to distribute load and avoid IP blocking
 */

import { ProxyConfig } from './types';

export class ProxyManager {
  private proxies: ProxyConfig[] = [];
  private currentIndex: number = 0;
  private readonly maxFailures: number = 3;

  constructor(proxyConfigs: ProxyConfig[] = []) {
    this.proxies = proxyConfigs.map(config => ({
      ...config,
      failureCount: 0,
      lastUsed: undefined
    }));
  }

  /**
   * Get the next available proxy
   */
  getNextProxy(): ProxyConfig | null {
    if (this.proxies.length === 0) {
      return null;
    }

    // Filter out proxies that have exceeded max failures
    const availableProxies = this.proxies.filter(
      proxy => proxy.failureCount < this.maxFailures
    );

    if (availableProxies.length === 0) {
      console.warn('All proxies have exceeded max failures');
      return null;
    }

    // Round-robin selection
    this.currentIndex = (this.currentIndex + 1) % availableProxies.length;
    const proxy = availableProxies[this.currentIndex];

    // Update last used timestamp
    proxy.lastUsed = Date.now();

    return proxy;
  }

  /**
   * Record a successful request through a proxy
   */
  recordSuccess(proxyUrl: string): void {
    const proxy = this.proxies.find(p => p.proxyUrl === proxyUrl);
    if (proxy) {
      // Reset failure count on success
      proxy.failureCount = 0;
    }
  }

  /**
   * Record a failed request through a proxy
   */
  recordFailure(proxyUrl: string): void {
    const proxy = this.proxies.find(p => p.proxyUrl === proxyUrl);
    if (proxy) {
      proxy.failureCount++;
      console.warn(`Proxy ${proxyUrl} failure count: ${proxy.failureCount}/${this.maxFailures}`);
    }
  }

  /**
   * Add a new proxy to the pool
   */
  addProxy(config: ProxyConfig): void {
    this.proxies.push({
      ...config,
      failureCount: 0,
      lastUsed: undefined
    });
  }

  /**
   * Remove a proxy from the pool
   */
  removeProxy(proxyUrl: string): void {
    this.proxies = this.proxies.filter(p => p.proxyUrl !== proxyUrl);
  }

  /**
   * Get all proxies with their status
   */
  getProxyStatus(): Array<{ proxyUrl: string; available: boolean; failureCount: number; lastUsed?: number }> {
    return this.proxies.map(proxy => ({
      proxyUrl: proxy.proxyUrl,
      available: proxy.failureCount < this.maxFailures,
      failureCount: proxy.failureCount,
      lastUsed: proxy.lastUsed
    }));
  }

  /**
   * Reset all proxy failure counts
   */
  resetAllProxies(): void {
    this.proxies.forEach(proxy => {
      proxy.failureCount = 0;
    });
  }

  /**
   * Get proxy configuration for Playwright
   */
  getPlaywrightProxyConfig(proxy: ProxyConfig | null): any {
    if (!proxy) {
      return undefined;
    }

    return {
      server: proxy.proxyUrl,
      username: proxy.username,
      password: proxy.password
    };
  }

  /**
   * Get count of available proxies
   */
  getAvailableProxyCount(): number {
    return this.proxies.filter(p => p.failureCount < this.maxFailures).length;
  }
}
