/**
 * Lambda Handler for Scraping Operations
 * 
 * Handles scraping requests triggered by EventBridge or API Gateway
 */

import { Handler } from 'aws-lambda';
import { VendorDataPipeline } from '../data-pipeline';
import { ScrapingTarget, ProxyConfig } from '../types';

// Initialize pipeline (reused across warm Lambda invocations)
let pipeline: VendorDataPipeline | null = null;

function getPipeline(): VendorDataPipeline {
  if (!pipeline) {
    // Load proxy configuration from environment
    const proxies: ProxyConfig[] = process.env.PROXY_URLS
      ? JSON.parse(process.env.PROXY_URLS)
      : [];

    pipeline = new VendorDataPipeline(proxies, {
      requestsPerMinute: parseInt(process.env.RATE_LIMIT_PER_MINUTE || '10'),
      requestsPerHour: parseInt(process.env.RATE_LIMIT_PER_HOUR || '100'),
      delayBetweenRequests: parseInt(process.env.DELAY_BETWEEN_REQUESTS || '1000')
    });
  }
  return pipeline;
}

/**
 * Handler for single target scraping
 */
export const scrapeSingleTarget: Handler = async (event) => {
  console.log('Scraping single target:', JSON.stringify(event));

  try {
    const target: ScrapingTarget = event.target || event;
    
    if (!target.url || !target.targetId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: url, targetId' })
      };
    }

    const pipeline = getPipeline();
    const result = await pipeline.processTarget(target);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        result
      })
    };
  } catch (error) {
    console.error('Error scraping target:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Handler for batch scraping
 */
export const scrapeBatch: Handler = async (event) => {
  console.log('Scraping batch:', JSON.stringify(event));

  try {
    const targets: ScrapingTarget[] = event.targets || [];
    
    if (!Array.isArray(targets) || targets.length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing or empty targets array' })
      };
    }

    const pipeline = getPipeline();
    const results = await pipeline.processBatch(targets);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        results,
        summary: {
          total: targets.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      })
    };
  } catch (error) {
    console.error('Error scraping batch:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Handler for getting pipeline status
 */
export const getPipelineStatus: Handler = async () => {
  try {
    const pipeline = getPipeline();
    const status = pipeline.getStatus();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        status
      })
    };
  } catch (error) {
    console.error('Error getting pipeline status:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Handler for resetting pipeline (admin only)
 */
export const resetPipeline: Handler = async () => {
  try {
    const pipeline = getPipeline();
    pipeline.reset();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Pipeline reset successfully'
      })
    };
  } catch (error) {
    console.error('Error resetting pipeline:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
