# NTTS Data Integration - Implementation Plan

## Overview

This implementation plan extends the existing RoadCall platform to integrate NTTS (nttsbreakdown.com) mechanic data. It builds upon the existing vendor-data-pipeline-svc, kb-svc, match-svc, and telephony-svc to create a comprehensive, AI-powered mechanic discovery and matching system.

## Task List

- [ ] 1. Enhance vendor data pipeline for NTTS scraping
  - Analyze NTTS website structure and identify scraping targets
  - Create NTTS-specific selectors for business data extraction
  - Implement listing page scraper to collect vendor URLs
  - Implement detail page scraper for full vendor information
  - Add geocoding integration using AWS Location Service
  - Configure rate limiting specific to NTTS (10 req/min)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [ ] 2. Create DynamoDB table for NTTS vendor data
  - Define NTTSVendors table schema with vendorId as PK
  - Create GSI for geohash-based proximity queries
  - Create GSI for state and verification status filtering
  - Implement data validation rules for required fields
  - Set up DynamoDB Streams for change data capture
  - Configure encryption with KMS customer-managed key
  - _Requirements: 1.4, 5.2, 5.3_

- [ ] 3. Build NTTS scraping orchestrator Lambda
  - Create EventBridge schedule for daily scraping (2 AM UTC)
  - Implement robots.txt checker with 24-hour caching
  - Build target URL generator for NTTS directory pages
  - Create SQS queue for scraping jobs with DLQ
  - Implement job prioritization logic (new vs updates)
  - Add CloudWatch metrics for job queue depth
  - _Requirements: 1.1, 6.1, 6.4_

- [ ] 4. Implement parallel scraper Lambda functions
  - Create Lambda function with Playwright layer
  - Implement NTTS listing page scraper
  - Implement NTTS detail page scraper with data extraction
  - Add proxy rotation using existing proxy manager
  - Integrate circuit breaker from vendor-data-pipeline-svc
  - Implement exponential backoff retry logic (3 attempts)
  - Store raw scraped data in NTTSVendors table
  - _Requirements: 1.2, 1.3, 1.5, 5.1, 9.1, 9.4_

- [ ]* 4.1 Write unit tests for NTTS data extraction
  - Test selector accuracy with sample HTML
  - Test address parsing and normalization
  - Test phone number formatting (E.164)
  - Test service type extraction and mapping
  - _Requirements: 1.3_

- [ ] 5. Implement verification queue workflow
  - Create DynamoDB table for verification queue
  - Build Lambda function to add scraped data to queue
  - Create API endpoints: GET /verification/pending, POST /verification/{id}/approve, POST /verification/{id}/reject
  - Implement approval workflow with verifier tracking
  - Add rejection reason capture and storage
  - Update vendor verification status in NTTSVendors table
  - Publish VendorVerified event to EventBridge
  - _Requirements: 5.1, 5.2, 5.4_

- [ ] 6. Set up vector database for embeddings
  - Deploy OpenSearch Serverless collection for vector storage
  - Configure k-NN index with 1536 dimensions (Titan)
  - Create index mapping with metadata fields
  - Implement geospatial + vector hybrid search
  - Set up IAM roles for Lambda access to OpenSearch
  - Configure VPC endpoints for secure access
  - _Requirements: 2.2, 2.3, 10.2_

- [ ] 7. Implement embedding generation service
  - Create Lambda function triggered by VendorVerified event
  - Build text description generator from vendor data
  - Integrate Amazon Bedrock Titan Embeddings API
  - Implement embedding storage in OpenSearch
  - Add error handling for Bedrock throttling
  - Configure batch processing for bulk embedding generation
  - Cache embeddings in ElastiCache (1-hour TTL)
  - _Requirements: 2.1, 2.2, 10.1_

- [ ]* 7.1 Write integration tests for embedding pipeline
  - Test end-to-end: vendor data → embedding → storage
  - Test Bedrock Titan API integration
  - Test OpenSearch indexing and retrieval
  - Test cache hit/miss scenarios
  - _Requirements: 2.1, 2.2_

- [ ] 8. Enhance matching service with semantic search
  - Add semantic search function using OpenSearch k-NN
  - Implement hybrid scoring: geospatial (40%) + semantic (30%) + availability (30%)
  - Create Bedrock Claude integration for issue analysis
  - Build vendor capability scoring using Claude
  - Implement multi-source vendor aggregation (registered + NTTS)
  - Add match explanation generation using Bedrock
  - Update match API to include NTTS vendors
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 7.1, 7.2, 7.3_

- [ ]* 8.1 Write unit tests for enhanced matching algorithm
  - Test semantic similarity scoring
  - Test hybrid score calculation
  - Test multi-source vendor merging
  - Test match explanation generation
  - _Requirements: 3.2, 3.3, 7.3_

- [ ] 9. Integrate NTTS data with Amazon Kendra
  - Create Kendra data source for NTTS vendors
  - Implement Lambda function to sync verified vendors to Kendra
  - Define custom attributes: services, location, specializations
  - Configure relevance tuning for service type matching
  - Set up incremental sync for vendor updates
  - Implement Kendra query function with location filters
  - _Requirements: 2.4, 4.2, 8.1_

- [ ] 10. Enhance telephony service with NTTS knowledge
  - Update Amazon Q in Connect knowledge base with NTTS data
  - Modify call summary generator to include mechanic recommendations
  - Enhance agent assist to query NTTS vendors
  - Implement location-aware mechanic suggestions
  - Add Bedrock guardrails for NTTS query responses
  - Update agent assist API to return NTTS vendor matches
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 11. Build admin dashboard for NTTS data management
  - Create verification queue UI in Next.js admin panel
  - Implement vendor detail view with source URL
  - Add approve/reject buttons with reason input
  - Build scraping job monitor with status display
  - Create circuit breaker status indicator
  - Add manual scraping trigger for specific URLs
  - Implement vendor data diff viewer for updates
  - _Requirements: 5.1, 5.2, 6.2, 8.2, 8.3_

- [ ] 12. Implement data quality monitoring
  - Create CloudWatch dashboard for scraping metrics
  - Add alarms for circuit breaker open state
  - Implement data completeness checks (required fields)
  - Build duplicate detection using fuzzy matching
  - Create data freshness monitoring (last scrape time)
  - Add verification queue depth alarm (>100 items)
  - Implement scraping success rate tracking
  - _Requirements: 5.2, 6.4, 9.4, 10.3_

- [ ] 13. Build continuous update pipeline
  - Create EventBridge rule for daily scraping schedule
  - Implement change detection for existing vendors
  - Build incremental update logic (only changed fields)
  - Create historical data archival to S3 (90-day retention)
  - Implement vendor deactivation for removed listings
  - Add re-verification workflow for significant changes
  - _Requirements: 6.1, 6.2, 6.3, 6.5_

- [ ] 14. Implement compliance and audit features
  - Create audit log table for all scraping activities
  - Implement data provenance tracking (source URL, timestamp)
  - Build compliance flag system (robots.txt, rate limits)
  - Add legal review queue for flagged vendors
  - Create audit report generation API
  - Implement GDPR-compliant data deletion workflow
  - _Requirements: 5.2, 9.1, 9.2, 9.3, 9.5_

- [ ] 15. Optimize performance and caching
  - Implement ElastiCache caching for embeddings (1-hour TTL)
  - Add Redis caching for frequent semantic searches
  - Configure OpenSearch query result caching
  - Implement Lambda provisioned concurrency for matching service
  - Add DynamoDB DAX for hot vendor data
  - Optimize Bedrock API calls with batching
  - _Requirements: 2.5, 10.1, 10.2, 10.5_

- [ ]* 15.1 Conduct load testing for NTTS integration
  - Test 1000 concurrent semantic searches
  - Test daily scraping of 10,000 vendors
  - Test enhanced matching with NTTS data under load
  - Test Bedrock API rate limit handling
  - _Requirements: 10.2, 10.3, 10.4_

- [ ] 16. Build unified vendor API
  - Create unified vendor search API (registered + NTTS)
  - Implement source filtering (registered, ntts, all)
  - Add verification status filtering
  - Build vendor detail API with source indication
  - Create vendor comparison API for duplicate detection
  - Implement vendor merge API for duplicate resolution
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 17. Implement real-time availability integration
  - Create availability status table for NTTS vendors
  - Build availability inference from call patterns
  - Implement availability decay (assume offline after 7 days)
  - Add manual availability override for verified vendors
  - Create availability sync with registered vendor status
  - _Requirements: 3.2, 3.3, 8.4_

- [ ] 18. Add NTTS vendor analytics
  - Create ETL pipeline for NTTS vendor metrics
  - Build reporting on NTTS vs registered vendor usage
  - Implement match success rate tracking by source
  - Add geographic coverage analysis
  - Create service type distribution reports
  - Build verification queue metrics dashboard
  - _Requirements: 5.2, 8.2, 10.3_

- [ ] 19. Implement mobile app NTTS integration
  - Update driver app to display NTTS vendor matches
  - Add source indicator (registered vs NTTS) in UI
  - Implement vendor detail view with NTTS data
  - Add "call vendor" button for NTTS mechanics
  - Update vendor app to show NTTS competition nearby
  - _Requirements: 3.4, 8.2_

- [ ] 20. Build NTTS data export and backup
  - Create S3 backup for NTTS vendor data (daily)
  - Implement cross-region replication for DR
  - Build data export API (CSV, JSON formats)
  - Create vendor data snapshot for analytics
  - Implement point-in-time recovery for vendor data
  - _Requirements: 6.3, 9.2_

- [ ] 21. Final integration testing and optimization
  - Test end-to-end incident flow with NTTS matching
  - Verify Amazon Q in Connect NTTS recommendations
  - Test agent assist with NTTS vendor queries
  - Validate Bedrock guardrails for NTTS responses
  - Conduct security review of scraping pipeline
  - Perform cost optimization analysis
  - _Requirements: All requirements_

## Notes

- Tasks marked with "*" are optional testing tasks
- All tasks build upon existing services (vendor-data-pipeline-svc, kb-svc, match-svc, telephony-svc)
- AWS services used: Bedrock (Titan, Claude), Q in Connect, Kendra, OpenSearch, Location Service
- Estimated timeline: 6-8 weeks for full implementation
- Priority: Tasks 1-8 are critical path for MVP functionality
