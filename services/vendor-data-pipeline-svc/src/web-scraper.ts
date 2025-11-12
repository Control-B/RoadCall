/**
 * Web Scraper with Playwright
 * 
 * Scrapes vendor data from public sources with compliance checks
 */

import { chromium, Browser, Page } from 'playwright';
import { ScrapingTarget, ScrapingResult, VendorData, DataProvenance } from './types';
import { RobotsChecker } from './robots-checker';
import { RateLimiter } from './rate-limiter';
import { ProxyManager } from './proxy-manager';
import { AuditLogger } from './audit-logger';
import { DataCollectionCircuitBreaker } from './circuit-breaker';

export class WebScraper {
  private browser: Browser | null = null;
  private robotsChecker: RobotsChecker;
  private rateLimiter: RateLimiter;
  private proxyManager: ProxyManager;
  private auditLogger: AuditLogger;
  private circuitBreaker: DataCollectionCircuitBreaker;

  constructor(
    robotsChecker: RobotsChecker,
    rateLimiter: RateLimiter,
    proxyManager: ProxyManager,
    auditLogger: AuditLogger,
    circuitBreaker: DataCollectionCircuitBreaker
  ) {
    this.robotsChecker = robotsChecker;
    this.rateLimiter = rateLimiter;
    this.proxyManager = proxyManager;
    this.auditLogger = auditLogger;
    this.circuitBreaker = circuitBreaker;
  }

  /**
   * Initialize browser instance
   */
  private async initBrowser(proxyConfig?: any): Promise<void> {
    if (!this.browser) {
      this.browser = await chromium.launch({
        headless: true,
        proxy: proxyConfig
      });
    }
  }

  /**
   * Close browser instance
   */
  async close(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Scrape a target URL
   */
  async scrape(target: ScrapingTarget): Promise<ScrapingResult> {
    const collectorId = process.env.AWS_LAMBDA_FUNCTION_NAME || 'local-scraper';
    
    try {
      // Check circuit breaker
      if (this.circuitBreaker.isOpen()) {
        throw new Error('Circuit breaker is OPEN - data collection halted');
      }

      // Check robots.txt compliance
      const robotsCheck = await this.robotsChecker.isAllowed(target.url);
      await this.auditLogger.logRobotsCheck(target.url, robotsCheck.allowed, robotsCheck.reason);

      if (!robotsCheck.allowed) {
        return {
          targetId: target.targetId,
          url: target.url,
          timestamp: new Date().toISOString(),
          success: false,
          error: robotsCheck.reason || 'Disallowed by robots.txt',
          provenanceInfo: this.createProvenance(target.url, collectorId, false, ['robots_txt_disallowed'])
        };
      }

      // Apply rate limiting
      await this.rateLimiter.waitIfNeeded();

      // Execute scraping with circuit breaker
      return await this.circuitBreaker.execute(async () => {
        return await this.performScrape(target, collectorId);
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      await this.auditLogger.logScrapeFailed(target.url, errorMessage, {
        targetId: target.targetId,
        error: errorMessage
      });

      return {
        targetId: target.targetId,
        url: target.url,
        timestamp: new Date().toISOString(),
        success: false,
        error: errorMessage,
        provenanceInfo: this.createProvenance(target.url, collectorId, false, ['scraping_error'])
      };
    }
  }

  /**
   * Perform the actual scraping
   */
  private async performScrape(target: ScrapingTarget, collectorId: string): Promise<ScrapingResult> {
    let page: Page | null = null;
    let currentProxy = this.proxyManager.getNextProxy();

    try {
      await this.auditLogger.logScrapeStarted(target.url, {
        targetId: target.targetId,
        sourceType: target.sourceType,
        proxy: currentProxy?.proxyUrl
      });

      // Initialize browser with proxy
      const proxyConfig = this.proxyManager.getPlaywrightProxyConfig(currentProxy);
      await this.initBrowser(proxyConfig);

      if (!this.browser) {
        throw new Error('Failed to initialize browser');
      }

      // Create new page
      page = await this.browser.newPage({
        userAgent: this.robotsChecker.getUserAgent()
      });

      // Set timeout
      page.setDefaultTimeout(30000);

      // Navigate to URL
      await page.goto(target.url, { waitUntil: 'networkidle' });

      // Extract data using selectors
      const vendorData = await this.extractData(page, target);

      // Record proxy success
      if (currentProxy) {
        this.proxyManager.recordSuccess(currentProxy.proxyUrl);
      }

      await this.auditLogger.logScrapeCompleted(target.url, {
        targetId: target.targetId,
        dataExtracted: !!vendorData
      });

      const result: ScrapingResult = {
        targetId: target.targetId,
        url: target.url,
        timestamp: new Date().toISOString(),
        success: true,
        data: vendorData,
        provenanceInfo: this.createProvenance(target.url, collectorId, true, [])
      };

      return result;

    } catch (error) {
      // Record proxy failure
      if (currentProxy) {
        this.proxyManager.recordFailure(currentProxy.proxyUrl);
      }

      throw error;
    } finally {
      if (page) {
        await page.close();
      }
    }
  }

  /**
   * Extract vendor data from page
   */
  private async extractData(page: Page, target: ScrapingTarget): Promise<VendorData | undefined> {
    try {
      const data: Partial<VendorData> = {};

      // Extract business name
      if (target.selectors.businessName) {
        const name = await page.textContent(target.selectors.businessName);
        if (name) data.businessName = name.trim();
      }

      // Extract phone
      if (target.selectors.phone) {
        const phone = await page.textContent(target.selectors.phone);
        if (phone) data.phone = phone.trim();
      }

      // Extract address
      if (target.selectors.address) {
        const address = await page.textContent(target.selectors.address);
        if (address) data.address = address.trim();
      }

      // Extract services
      if (target.selectors.services) {
        const servicesText = await page.textContent(target.selectors.services);
        if (servicesText) {
          data.services = servicesText.split(',').map(s => s.trim());
        }
      }

      // Extract operating hours
      if (target.selectors.hours) {
        const hoursText = await page.textContent(target.selectors.hours);
        if (hoursText) {
          // Parse hours (simplified - would need more robust parsing)
          data.operatingHours = this.parseOperatingHours(hoursText);
        }
      }

      // Validate required fields
      if (!data.businessName) {
        return undefined;
      }

      return data as VendorData;

    } catch (error) {
      console.error('Error extracting data:', error);
      return undefined;
    }
  }

  /**
   * Parse operating hours text
   */
  private parseOperatingHours(hoursText: string): Record<string, { open: string; close: string }> {
    // Simplified parser - would need more robust implementation
    const hours: Record<string, { open: string; close: string }> = {};
    
    // Example: "Mon-Fri: 9:00 AM - 5:00 PM"
    const lines = hoursText.split('\n');
    for (const line of lines) {
      const match = line.match(/(\w+):\s*(\d+:\d+\s*[AP]M)\s*-\s*(\d+:\d+\s*[AP]M)/i);
      if (match) {
        const [, day, open, close] = match;
        hours[day.toLowerCase()] = { open, close };
      }
    }

    return hours;
  }

  /**
   * Create data provenance record
   */
  private createProvenance(
    sourceUrl: string,
    collectorId: string,
    robotsTxtCompliant: boolean,
    legalFlags: string[]
  ): DataProvenance {
    return {
      sourceUrl,
      collectedAt: new Date().toISOString(),
      collectorId,
      ipAddress: 'proxy-rotated', // Actual IP would come from proxy
      userAgent: this.robotsChecker.getUserAgent(),
      method: 'scraping',
      robotsTxtCompliant,
      legalFlags
    };
  }

  /**
   * Batch scrape multiple targets
   */
  async scrapeBatch(targets: ScrapingTarget[]): Promise<ScrapingResult[]> {
    const results: ScrapingResult[] = [];

    for (const target of targets) {
      try {
        const result = await this.scrape(target);
        results.push(result);

        // Check if circuit breaker opened
        if (this.circuitBreaker.isOpen()) {
          console.warn('Circuit breaker opened, stopping batch scraping');
          break;
        }
      } catch (error) {
        console.error(`Error scraping ${target.url}:`, error);
        // Continue with next target
      }
    }

    return results;
  }
}
