/**
 * Robots.txt Compliance Checker
 * 
 * Checks and respects robots.txt directives before scraping
 */

import robotsParser from 'robots-parser';

export class RobotsChecker {
  private robotsCache: Map<string, { parser: any; fetchedAt: number }> = new Map();
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
  private readonly USER_AGENT = 'RoadcallBot/1.0 (+https://roadcall.example.com/bot)';

  /**
   * Check if a URL is allowed to be scraped according to robots.txt
   */
  async isAllowed(url: string): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      const parser = await this.getRobotsParser(robotsUrl);
      
      if (!parser) {
        // If robots.txt doesn't exist or can't be fetched, assume allowed
        return { allowed: true, reason: 'No robots.txt found' };
      }

      const allowed = parser.isAllowed(url, this.USER_AGENT);
      
      if (!allowed) {
        return { 
          allowed: false, 
          reason: 'Disallowed by robots.txt' 
        };
      }

      // Check crawl delay
      const crawlDelay = parser.getCrawlDelay(this.USER_AGENT);
      if (crawlDelay) {
        return { 
          allowed: true, 
          reason: `Allowed with ${crawlDelay}s crawl delay` 
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking robots.txt:', error);
      // On error, be conservative and disallow
      return { 
        allowed: false, 
        reason: `Error checking robots.txt: ${error instanceof Error ? error.message : 'Unknown error'}` 
      };
    }
  }

  /**
   * Get the crawl delay specified in robots.txt
   */
  async getCrawlDelay(url: string): Promise<number> {
    try {
      const urlObj = new URL(url);
      const robotsUrl = `${urlObj.protocol}//${urlObj.host}/robots.txt`;
      
      const parser = await this.getRobotsParser(robotsUrl);
      
      if (!parser) {
        return 1; // Default 1 second delay
      }

      const crawlDelay = parser.getCrawlDelay(this.USER_AGENT);
      return crawlDelay || 1;
    } catch (error) {
      console.error('Error getting crawl delay:', error);
      return 1; // Default to 1 second on error
    }
  }

  /**
   * Get or fetch robots.txt parser
   */
  private async getRobotsParser(robotsUrl: string): Promise<any | null> {
    // Check cache
    const cached = this.robotsCache.get(robotsUrl);
    if (cached && Date.now() - cached.fetchedAt < this.CACHE_TTL) {
      return cached.parser;
    }

    try {
      // Fetch robots.txt
      const response = await fetch(robotsUrl, {
        headers: {
          'User-Agent': this.USER_AGENT
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          // No robots.txt, cache null result
          this.robotsCache.set(robotsUrl, { parser: null, fetchedAt: Date.now() });
          return null;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const robotsTxt = await response.text();
      const parser = robotsParser(robotsUrl, robotsTxt);

      // Cache the parser
      this.robotsCache.set(robotsUrl, { parser, fetchedAt: Date.now() });

      return parser;
    } catch (error) {
      console.error(`Error fetching robots.txt from ${robotsUrl}:`, error);
      return null;
    }
  }

  /**
   * Clear the robots.txt cache
   */
  clearCache(): void {
    this.robotsCache.clear();
  }

  /**
   * Get the user agent string used for robots.txt checks
   */
  getUserAgent(): string {
    return this.USER_AGENT;
  }
}
