/**
 * Rate Limiter for Web Scraping
 * 
 * Implements rate limiting to avoid service disruption
 */

import { RateLimitConfig } from './types';

export class RateLimiter {
  private requestTimestamps: number[] = [];
  private config: RateLimitConfig;

  constructor(config: RateLimitConfig = {
    requestsPerMinute: 10,
    requestsPerHour: 100,
    delayBetweenRequests: 1000 // 1 second
  }) {
    this.config = config;
  }

  /**
   * Wait if necessary to comply with rate limits
   */
  async waitIfNeeded(): Promise<void> {
    const now = Date.now();
    
    // Clean up old timestamps
    this.cleanupOldTimestamps(now);

    // Check minute limit
    const requestsInLastMinute = this.requestTimestamps.filter(
      ts => now - ts < 60000
    ).length;

    if (requestsInLastMinute >= this.config.requestsPerMinute) {
      const oldestInMinute = this.requestTimestamps.find(
        ts => now - ts < 60000
      );
      if (oldestInMinute) {
        const waitTime = 60000 - (now - oldestInMinute) + 100; // Add 100ms buffer
        console.log(`Rate limit: waiting ${waitTime}ms (minute limit)`);
        await this.sleep(waitTime);
      }
    }

    // Check hour limit
    const requestsInLastHour = this.requestTimestamps.filter(
      ts => now - ts < 3600000
    ).length;

    if (requestsInLastHour >= this.config.requestsPerHour) {
      const oldestInHour = this.requestTimestamps.find(
        ts => now - ts < 3600000
      );
      if (oldestInHour) {
        const waitTime = 3600000 - (Date.now() - oldestInHour) + 100;
        console.log(`Rate limit: waiting ${waitTime}ms (hour limit)`);
        await this.sleep(waitTime);
      }
    }

    // Apply delay between requests
    if (this.requestTimestamps.length > 0) {
      const lastRequest = this.requestTimestamps[this.requestTimestamps.length - 1];
      const timeSinceLastRequest = now - lastRequest;
      
      if (timeSinceLastRequest < this.config.delayBetweenRequests) {
        const waitTime = this.config.delayBetweenRequests - timeSinceLastRequest;
        console.log(`Rate limit: waiting ${waitTime}ms (request delay)`);
        await this.sleep(waitTime);
      }
    }

    // Record this request
    this.requestTimestamps.push(Date.now());
  }

  /**
   * Clean up timestamps older than 1 hour
   */
  private cleanupOldTimestamps(now: number): void {
    this.requestTimestamps = this.requestTimestamps.filter(
      ts => now - ts < 3600000
    );
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current rate limit status
   */
  getStatus(): {
    requestsInLastMinute: number;
    requestsInLastHour: number;
    minuteLimit: number;
    hourLimit: number;
  } {
    const now = Date.now();
    this.cleanupOldTimestamps(now);

    return {
      requestsInLastMinute: this.requestTimestamps.filter(
        ts => now - ts < 60000
      ).length,
      requestsInLastHour: this.requestTimestamps.length,
      minuteLimit: this.config.requestsPerMinute,
      hourLimit: this.config.requestsPerHour
    };
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.requestTimestamps = [];
  }

  /**
   * Update rate limit configuration
   */
  updateConfig(config: Partial<RateLimitConfig>): void {
    this.config = { ...this.config, ...config };
  }
}
