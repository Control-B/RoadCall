/**
 * Vendor Data Pipeline Orchestrator
 * 
 * Coordinates all components of the data collection pipeline
 */

import { ScrapingTarget, ScrapingResult, ProxyConfig, RateLimitConfig } from './types';
import { WebScraper } from './web-scraper';
import { RobotsChecker } from './robots-checker';
import { RateLimiter } from './rate-limiter';
import { ProxyManager } from './proxy-manager';
import { AuditLogger } from './audit-logger';
import { DataCollectionCircuitBreaker } from './circuit-breaker';
import { VerificationQueue } from './verification-queue';

export class VendorDataPipeline {
  private webScraper: WebScraper;
  private robotsChecker: RobotsChecker;
  private rateLimiter: RateLimiter;
  private proxyManager: ProxyManager;
  private auditLogger: AuditLogger;
  private circuitBreaker: DataCollectionCircuitBreaker;
  private verificationQueue: VerificationQueue;

  constructor(
    proxies: ProxyConfig[] = [],
    rateLimitConfig?: RateLimitConfig
  ) {
    // Initialize components
    this.robotsChecker = new RobotsChecker();
    this.rateLimiter = new RateLimiter(rateLimitConfig);
    this.proxyManager = new ProxyManager(proxies);
    this.auditLogger = new AuditLogger();
    this.circuitBreaker = new DataCollectionCircuitBreaker();
    this.verificationQueue = new VerificationQueue();

    // Initialize web scraper with all dependencies
    this.webScraper = new WebScraper(
      this.robotsChecker,
      this.rateLimiter,
      this.proxyManager,
      this.auditLogger,
      this.circuitBreaker
    );
  }

  /**
   * Process a single scraping target
   */
  async processTarget(target: ScrapingTarget): Promise<ScrapingResult> {
    try {
      // Scrape the target
      const result = await this.webScraper.scrape(target);

      // If successful and data was collected, add to verification queue
      if (result.success && result.data) {
        await this.verificationQueue.addToQueue(result.data, result.provenanceInfo);
        console.log(`Added vendor data to verification queue: ${result.data.businessName}`);
      }

      return result;
    } catch (error) {
      console.error(`Error processing target ${target.url}:`, error);
      throw error;
    }
  }

  /**
   * Process multiple scraping targets
   */
  async processBatch(targets: ScrapingTarget[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const target of targets) {
      try {
        const result = await this.processTarget(target);
        results.push(result);

        // Check circuit breaker status
        if (this.circuitBreaker.isOpen()) {
          console.warn('Circuit breaker opened, stopping batch processing');
          await this.auditLogger.logCircuitBreakerStateChange('circuit_breaker_opened', {
            errorRate: this.circuitBreaker.getErrorRate(),
            processedCount: results.length,
            totalCount: targets.length
          });
          break;
        }
      } catch (error) {
        console.error(`Error processing target:`, error);
        // Continue with next target
      }
    }

    return results;
  }

  /**
   * Get pipeline status
   */
  getStatus(): {
    circuitBreaker: {
      state: string;
      errorRate: number;
      isOpen: boolean;
    };
    rateLimiter: {
      requestsInLastMinute: number;
      requestsInLastHour: number;
      minuteLimit: number;
      hourLimit: number;
    };
    proxyManager: {
      availableProxies: number;
      totalProxies: number;
    };
  } {
    return {
      circuitBreaker: {
        state: this.circuitBreaker.getState().state,
        errorRate: this.circuitBreaker.getErrorRate(),
        isOpen: this.circuitBreaker.isOpen()
      },
      rateLimiter: this.rateLimiter.getStatus(),
      proxyManager: {
        availableProxies: this.proxyManager.getAvailableProxyCount(),
        totalProxies: this.proxyManager.getProxyStatus().length
      }
    };
  }

  /**
   * Reset the pipeline (useful for testing or recovery)
   */
  reset(): void {
    this.circuitBreaker.reset();
    this.rateLimiter.reset();
    this.proxyManager.resetAllProxies();
    this.robotsChecker.clearCache();
  }

  /**
   * Shutdown the pipeline
   */
  async shutdown(): Promise<void> {
    await this.webScraper.close();
  }

  /**
   * Check legal compliance flags and halt if needed
   */
  checkCompliance(flags: string[]): void {
    if (flags.length > 0) {
      this.circuitBreaker.checkComplianceFlags(flags);
      this.auditLogger.logCircuitBreakerStateChange('circuit_breaker_opened', {
        reason: 'legal_compliance_flags',
        flags
      });
    }
  }

  /**
   * Get verification queue
   */
  getVerificationQueue(): VerificationQueue {
    return this.verificationQueue;
  }

  /**
   * Get audit logger
   */
  getAuditLogger(): AuditLogger {
    return this.auditLogger;
  }
}
