/**
 * Basic Usage Examples for Vendor Data Pipeline
 */

import { VendorDataPipeline, ScrapingTarget, ProxyConfig } from '../src';

async function main() {
  // Example 1: Basic scraping without proxies
  console.log('Example 1: Basic scraping');
  const pipeline = new VendorDataPipeline();

  const target: ScrapingTarget = {
    targetId: 'example-1',
    url: 'https://example.com/vendor-directory',
    sourceType: 'directory',
    selectors: {
      businessName: '.vendor-name',
      phone: '.contact-phone',
      address: '.vendor-address',
      services: '.services-list'
    },
    metadata: {
      region: 'us-east',
      category: 'towing',
      priority: 1
    }
  };

  try {
    const result = await pipeline.processTarget(target);
    console.log('Scraping result:', JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Scraping failed:', error);
  }

  // Example 2: Scraping with proxies
  console.log('\nExample 2: Scraping with proxies');
  const proxies: ProxyConfig[] = [
    {
      proxyUrl: 'http://proxy1.example.com:8080',
      username: 'user1',
      password: 'pass1',
      region: 'us-east',
      failureCount: 0
    },
    {
      proxyUrl: 'http://proxy2.example.com:8080',
      username: 'user2',
      password: 'pass2',
      region: 'us-west',
      failureCount: 0
    }
  ];

  const pipelineWithProxies = new VendorDataPipeline(proxies, {
    requestsPerMinute: 5,
    requestsPerHour: 50,
    delayBetweenRequests: 2000
  });

  // Example 3: Batch scraping
  console.log('\nExample 3: Batch scraping');
  const targets: ScrapingTarget[] = [
    {
      targetId: 'vendor-1',
      url: 'https://example.com/vendor/1',
      sourceType: 'profile',
      selectors: {
        businessName: 'h1.name',
        phone: 'a[href^="tel:"]',
        address: '.address'
      },
      metadata: { region: 'us-east' }
    },
    {
      targetId: 'vendor-2',
      url: 'https://example.com/vendor/2',
      sourceType: 'profile',
      selectors: {
        businessName: 'h1.name',
        phone: 'a[href^="tel:"]',
        address: '.address'
      },
      metadata: { region: 'us-west' }
    }
  ];

  try {
    const results = await pipelineWithProxies.processBatch(targets);
    console.log(`Processed ${results.length} targets`);
    console.log(`Successful: ${results.filter(r => r.success).length}`);
    console.log(`Failed: ${results.filter(r => !r.success).length}`);
  } catch (error) {
    console.error('Batch scraping failed:', error);
  }

  // Example 4: Check pipeline status
  console.log('\nExample 4: Pipeline status');
  const status = pipelineWithProxies.getStatus();
  console.log('Pipeline status:', JSON.stringify(status, null, 2));

  // Example 5: Verification queue
  console.log('\nExample 5: Verification queue');
  const queue = pipelineWithProxies.getVerificationQueue();
  
  const pendingItems = await queue.getPendingItems(10);
  console.log(`Pending items: ${pendingItems.length}`);

  if (pendingItems.length > 0) {
    const item = pendingItems[0];
    console.log('First pending item:', JSON.stringify(item, null, 2));

    // Approve or reject
    // await queue.approve(item.itemId, 'admin-user-123');
    // await queue.reject(item.itemId, 'admin-user-123', 'Duplicate entry');
  }

  // Example 6: Legal compliance check
  console.log('\nExample 6: Legal compliance check');
  const complianceFlags = ['copyright_violation', 'terms_of_service_breach'];
  pipelineWithProxies.checkCompliance(complianceFlags);
  
  const statusAfterCompliance = pipelineWithProxies.getStatus();
  console.log('Circuit breaker after compliance check:', statusAfterCompliance.circuitBreaker);

  // Cleanup
  await pipeline.shutdown();
  await pipelineWithProxies.shutdown();
}

// Run examples
if (require.main === module) {
  main().catch(console.error);
}

export { main };
