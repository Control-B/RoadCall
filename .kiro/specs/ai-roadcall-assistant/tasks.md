# Implementation Plan

## Overview

This implementation plan breaks down the AI Roadcall Assistant platform into discrete, actionable coding tasks. Each task builds incrementally on previous work, following microservices architecture principles with security and AWS best practices. The plan focuses on core functionality first, with optional testing tasks marked with "*".

## Task List

- [x] 1. Set up monorepo infrastructure and shared libraries
  - Initialize Turborepo with pnpm workspaces
  - Create workspace structure: apps/ (web, mobile), services/ (microservices), packages/ (shared libs), infrastructure/ (CDK)
  - Configure TypeScript with shared tsconfig.json
  - Set up ESLint and Prettier with shared configs
  - Create shared packages: @roadcall/types, @roadcall/utils, @roadcall/aws-clients
  - _Requirements: 13.1, 13.2, 25.1_

- [x] 2. Implement AWS CDK infrastructure foundation
  - Create CDK app entry point and stack organization
  - Implement network-stack: VPC with 3-tier subnets (public, private, data) across 2 AZs
  - Configure NAT Gateway, Internet Gateway, and route tables
  - Set up VPC endpoints for S3, DynamoDB, Secrets Manager
  - Create security groups for Lambda, Aurora, ElastiCache with least-privilege rules
  - Implement KMS customer-managed keys for encryption
  - _Requirements: 13.1, 13.3, 15.1_

- [x] 3. Deploy core AWS services infrastructure
  - Create DynamoDB tables with on-demand billing: Users, Incidents, Vendors, Offers, TrackingSessions, CallRecords, KBDocuments, NotificationLog
  - Configure DynamoDB GSIs for query patterns (phone lookup, geohash, status filters)
  - Set up Aurora Postgres cluster with encryption and automated backups
  - Deploy ElastiCache Redis cluster in data subnets
  - Configure S3 buckets with encryption: call-recordings, kb-documents, incident-media
  - Set up S3 lifecycle policies (90-day retention, Glacier transition)
  - _Requirements: 11.3, 13.4, 15.3, 15.4_

- [x] 4. Implement authentication service (auth-svc)
  - Create Lambda function for user registration with phone validation (E.164 format)
  - Implement OTP generation (6-digit), hashing (bcrypt), and storage in DynamoDB with TTL
  - Build OTP verification logic with rate limiting (5 attempts per hour)
  - Integrate Cognito User Pools for JWT token management
  - Implement JWT issuance (RS256, 15-min expiry) and refresh token flow
  - Create API Gateway endpoints: POST /auth/register, POST /auth/verify, POST /auth/refresh, GET /auth/me
  - Configure Cognito authorizer for API Gateway
  - Implement RBAC permission checking middleware
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 12.2_

- [x] 4.1 Write unit tests for OTP validation and JWT generation
  - _Requirements: 1.1, 1.2, 1.3_

- [x] 5. Implement driver service (driver-svc)
  - Create Lambda functions for driver profile CRUD operations
  - Implement driver registration with company association
  - Build driver preferences management (notifications, language, auto-location)
  - Create incident history query with pagination
  - Implement driver stats tracking (total incidents, avg rating)
  - Set up API Gateway endpoints: GET/PATCH /drivers/{id}, GET /drivers/{id}/incidents, GET/PATCH /drivers/{id}/preferences
  - Configure DynamoDB queries with GSIs for company and status filters
  - _Requirements: 1.1, 20.3_

- [x] 6. Implement vendor service (vendor-svc)
  - Create Lambda functions for vendor profile management
  - Implement vendor registration with capability selection and coverage area definition
  - Build availability status management (available/busy/offline)
  - Implement geospatial indexing using DynamoDB geohash GSI
  - Set up Redis geospatial index (GEOADD/GEORADIUS) for vendor search
  - Create vendor rating and metrics tracking (acceptance rate, completion rate, avg response time)
  - Implement vendor search API with radius and capability filters
  - Set up API Gateway endpoints: POST /vendors, GET/PATCH /vendors/{id}, PATCH /vendors/{id}/availability, GET /vendors/search
  - Configure Redis caching with 5-minute TTL for vendor profiles
  - _Requirements: 4.1, 4.2, 13.1_

- [x] 6.1 Write unit tests for geospatial distance calculations and vendor scoring
  - _Requirements: 4.1, 4.2_

- [x] 7. Implement incident service core functionality
  - Create Lambda function for incident creation with GPS coordinate capture
  - Implement incident data model with status, location, timeline, and media arrays
  - Build incident query APIs with filters (driverId, vendorId, status)
  - Create incident status update endpoint with validation
  - Set up DynamoDB table with GSIs for driver, vendor, and status queries
  - Implement EventBridge event publishing for IncidentCreated and IncidentStatusChanged
  - Configure S3 presigned URLs for media uploads
  - Implement media upload validation (file type, size limit 10MB, malware scanning)
  - _Requirements: 2.2, 2.3, 7.1, 7.2, 18.5_

- [x] 8. Integrate AWS Location Service for geolocation
  - Set up AWS Location Service Place Index for geocoding
  - Implement road snapping using Location Service Routes API
  - Create Lambda function to enrich incident location with address and road-snapped coordinates
  - Integrate weather API for incident context (condition, temperature, visibility)
  - Implement geofence storage in DynamoDB with polygon definitions
  - Create geofence containment check using point-in-polygon algorithm
  - Configure Location Service to complete processing within 2 seconds
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Implement Step Functions state machine for incident lifecycle
  - Create Step Functions state machine with incident status states
  - Implement timeout handling for vendor response (2 minutes) and arrival (30 minutes)
  - Build escalation logic for no vendor found after 3 radius expansions
  - Configure state transitions with EventBridge event publishing
  - Implement automatic status updates on vendor actions (accept, arrive, complete)
  - Set up error handling and retry logic for failed state transitions
  - Create Lambda functions for each state transition handler
  - _Requirements: 7.4, 7.5_

- [x] 10. Implement vendor matching service (match-svc)
  - Create Lambda function triggered by IncidentCreated EventBridge event
  - Implement vendor query with geospatial radius search (default 50 miles)
  - Build match scoring algorithm with weighted factors (distance 30%, capability 25%, availability 20%, acceptance rate 15%, rating 10%)
  - Implement vendor ranking and top-3 selection logic
  - Create offer records in DynamoDB with 2-minute TTL
  - Implement optimistic locking for incident assignment using conditional writes
  - Build radius expansion logic (25% increase) with max 3 attempts
  - Publish OfferCreated events to EventBridge
  - Set up SQS dead-letter queue for failed matches
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 5.5_

- [x] 10.1 Write unit tests for match scoring algorithm edge cases
  - _Requirements: 4.2_

- [x] 11. Implement offer management APIs
  - Create Lambda functions for offer acceptance and decline
  - Implement offer status validation and expiry checking
  - Build concurrent acceptance prevention using DynamoDB conditional writes
  - Create offer cancellation logic when incident is assigned
  - Implement decline reason capture and storage
  - Set up API Gateway endpoints: GET /offers/{id}, POST /offers/{id}/accept, POST /offers/{id}/decline
  - Publish OfferAccepted and OfferDeclined events to EventBridge
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [x] 12. Implement tracking service with AppSync GraphQL
  - Create AppSync GraphQL API with schema for tracking sessions
  - Implement mutations: startTracking, updateVendorLocation, stopTracking
  - Build queries: getTrackingSession, getActiveSessionByIncident
  - Create subscriptions: onTrackingUpdate, onIncidentTracking
  - Implement Lambda resolvers for tracking session CRUD operations
  - Set up DynamoDB table for tracking sessions with incident GSI
  - Configure AppSync caching with 5-second TTL
  - _Requirements: 6.1, 6.2, 23.1, 23.2_

- [x] 13. Integrate AWS Location Service for real-time tracking
  - Set up AWS Location Service Tracker for vendor location updates
  - Implement ETA calculation using Location Service Routes API with traffic data
  - Create Lambda function for ETA recalculation triggered by location updates
  - Implement geofence creation (100-meter radius) around incident location
  - Configure geofence arrival detection and automatic status update
  - Build vendor path storage as circular buffer (max 50 points)
  - Optimize location update batching (every 10 seconds)
  - Ensure ETA updates propagate to subscribed clients within 2 seconds
  - _Requirements: 6.3, 6.4, 6.5_

- [x] 14. Implement Amazon Connect telephony integration
  - Create Amazon Connect instance with phone number provisioning
  - Build IVR contact flow with ANI lookup and driver identification
  - Implement incident type selection menu (tire/engine/tow)
  - Create Lambda function for driver lookup by phone number
  - Build incident creation from call with location collection
  - Configure call recording with S3 storage and encryption
  - Set up post-call Lambda trigger for processing pipeline
  - _Requirements: 2.1, 2.4_

- [x] 15. Implement call transcription and PII redaction
  - Integrate Amazon Transcribe for call-to-text conversion
  - Create Lambda function for transcription processing
  - Implement PII detection using Amazon Comprehend DetectPiiEntities
  - Build PII redaction logic for names, addresses, SSN, credit cards
  - Store both raw and redacted transcripts in DynamoDB
  - Create encrypted PII mapping table for authorized access
  - Implement PII access logging with user ID and purpose
  - Ensure transcription completes within 30 seconds of call end
  - _Requirements: 2.5, 11.4, 18.2_

- [x] 16. Integrate Amazon Q in Connect for AI summarization
  - Set up Amazon Q in Connect with knowledge base integration
  - Create Lambda function to send transcripts to Q for summarization
  - Implement structured summary extraction (incident type, urgency, action items, sentiment)
  - Configure Bedrock prompt guardrails for PII filtering and content safety
  - Store summaries in DynamoDB linked to incidents
  - Build real-time agent assist for knowledge base queries during calls
  - Ensure summary generation completes within 30 seconds
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [x] 17. Implement knowledge base service (kb-svc)
  - Create Lambda functions for document upload and management
  - Set up S3 bucket for knowledge base documents with versioning
  - Implement document processing pipeline: upload → Textract → chunking → Kendra indexing
  - Configure Amazon Kendra index with custom attributes (category, tags, effectiveDate)
  - Build document metadata storage in DynamoDB
  - Create API endpoints: POST /kb/documents, GET /kb/documents/{id}, DELETE /kb/documents/{id}, POST /kb/search
  - Implement RAG query function using Kendra search + Bedrock LLM
  - Configure Kendra reindexing to complete within 15 minutes
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 17.1 Write integration tests for document processing pipeline
  - _Requirements: 9.4, 9.5_

- [x] 18. Implement payments service infrastructure
  - Create Aurora Postgres database schema for payments, line items, and audit log
  - Set up database indexes for status, incident, and vendor queries
  - Implement Lambda functions for payment CRUD operations
  - Create payment record generation on work completion
  - Build payment approval workflow with back-office queue
  - Set up SQS queue for pending payment approvals
  - Configure database connection pooling and transaction management
  - _Requirements: 10.1, 10.2_

- [x] 19. Integrate Stripe for payment processing
  - Set up Stripe Connect for vendor payouts
  - Implement Payment Intents API for IC driver payments
  - Create Lambda function for payment processing with idempotency keys
  - Build Stripe webhook handler with signature verification
  - Implement automatic retry with exponential backoff for failed payments
  - Store Stripe API keys in Secrets Manager with automatic rotation
  - Create payment confirmation notifications
  - _Requirements: 10.3, 10.4, 10.5, 14.1, 14.2_

- [x] 20. Implement fraud detection for payments
  - Set up Amazon Fraud Detector with vendor payment event type
  - Create fraud scoring Lambda function with transaction variables
  - Implement fraud score evaluation (threshold 0.7 for manual review)
  - Build manual review queue for flagged payments
  - Store fraud scores and reasons in payment records
  - Configure fraud detection to complete within 5 seconds
  - _Requirements: 19.2, 19.3_

- [x] 21. Implement notifications service (notifications-svc)
  - Create Lambda functions for multi-channel notification delivery
  - Set up Amazon Pinpoint for push notifications and SMS
  - Configure Amazon SES for email notifications
  - Implement notification templates for all event types (offer_received, vendor_en_route, payment_approved, etc.)
  - Build EventBridge subscriptions for domain events
  - Create SQS queue for notification buffering with priority handling
  - Implement user notification preferences management
  - Build delivery tracking and logging in DynamoDB
  - Configure rate limiting (10 SMS per user per hour)
  - _Requirements: 4.4, 5.1, 6.5, 10.5_

- [x] 21.1 Write unit tests for notification template rendering
  - _Requirements: 4.4_

- [x] 22. Implement reporting service (reporting-svc)
  - Create Aurora Postgres data warehouse schema (fact_incidents, dim_vendors, dim_drivers, dim_date)
  - Build ETL Lambda functions triggered by DynamoDB Streams
  - Implement KPI calculation functions (time-to-assign, time-to-arrival, acceptance rate, cost per incident)
  - Create API endpoints for report generation: GET /reports/kpis, GET /reports/incidents, GET /reports/vendors/{id}/performance
  - Set up CloudWatch custom metrics for real-time KPIs
  - Configure QuickSight dashboards for executive and operational reports
  - Implement data export to S3 (CSV/Parquet format)
  - _Requirements: 16.2_

- [x] 22.1 Write integration tests for ETL pipeline data transformations
  - _Requirements: 16.2_

- [x] 23. Implement API Gateway with security controls
  - Create API Gateway REST APIs for all microservices
  - Configure Cognito authorizer for JWT validation
  - Implement request validation using JSON schemas
  - Set up rate limiting (100 req/min standard, 10 req/min sensitive endpoints)
  - Configure CORS policies for web and mobile clients
  - Enable API Gateway logging and X-Ray tracing
  - Create custom domain with ACM certificate
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [x] 24. Deploy AWS WAF with security rules
  - Create WAF WebACL attached to API Gateway and AppSync
  - Implement rate limiting rule (2000 req/min per IP)
  - Configure geo-blocking rules for high-risk countries
  - Set up SQL injection and XSS protection rules
  - Enable AWS Managed Rules for common threats
  - Configure WAF logging to S3 for analysis
  - _Requirements: 12.1, 18.1, 18.2_

- [x] 25. Implement Secrets Manager integration
  - Create secrets for Stripe API keys, weather API, database credentials
  - Implement Lambda functions to retrieve secrets at runtime
  - Configure automatic rotation for database credentials (90-day cycle)
  - Set up SNS notifications for secret rotation events
  - Implement secret caching in Lambda with TTL
  - Ensure secrets are never logged or exposed in errors
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5_

- [x] 26. Implement observability and monitoring
  - Configure AWS X-Ray tracing for all Lambda functions and API Gateway
  - Create CloudWatch Log Groups with structured JSON logging
  - Implement custom CloudWatch metrics for business KPIs
  - Set up CloudWatch alarms for API latency (P95 > 300ms), error rates, and service health
  - Create CloudWatch dashboards for real-time monitoring
  - Configure SNS topics for alarm notifications
  - Enable CloudTrail for all AWS API calls with log file validation
  - _Requirements: 11.1, 11.2, 16.1, 16.3, 16.5_

- [x] 27. Implement circuit breaker pattern for resilience
  - Create reusable circuit breaker utility class with configurable thresholds
  - Implement circuit breaker for external service calls (Stripe, weather API, Location Service)
  - Configure failure threshold (50% over 10 requests) and timeout (30 seconds)
  - Build fallback mechanisms (cached data, degraded functionality)
  - Register services with AWS Cloud Map for service discovery
  - Implement health check endpoints for all services
  - _Requirements: 21.2, 21.3, 21.4, 21.5_

- [x] 28. Implement event-driven architecture with EventBridge
  - Create EventBridge event bus for domain events
  - Define event schemas for all domain events (IncidentCreated, VendorAssigned, WorkCompleted, etc.)
  - Implement event publishers in each microservice
  - Create EventBridge rules for event routing to target services
  - Set up SQS queues as targets with dead-letter queues
  - Configure retry logic (3 attempts with exponential backoff)
  - Implement event replay capability for failed events
  - _Requirements: 2.3, 7.2, 22.1, 22.2, 22.3_

- [x] 29. Build Next.js web application
  - Initialize Next.js app with App Router and TypeScript
  - Set up Tailwind CSS and shadcn/ui component library
  - Implement authentication flow with Cognito Hosted UI
  - Create driver dashboard with incident creation and tracking
  - Build vendor dashboard with offer management and navigation
  - Implement dispatcher dashboard with live incident queue and map view
  - Create admin panel for configuration (matching weights, SLA tiers, geofences)
  - Integrate MapLibre GL JS for map visualization with AWS Location tiles
  - Set up AppSync client for GraphQL subscriptions
  - _Requirements: 6.4, 8.5, 24.1, 24.2, 24.3_

- [x] 30. Build React Native mobile application
  - Initialize React Native project with Expo
  - Set up navigation with React Navigation
  - Implement authentication with Cognito SDK
  - Create driver screens: SOS button, incident tracking, vendor ETA, receipts
  - Build vendor screens: incoming offers, accept/decline, navigation, status updates
  - Integrate React Native Maps with MapLibre for real-time tracking
  - Implement push notifications with Expo Notifications and Pinpoint
  - Set up AppSync client for real-time subscriptions
  - Configure background location tracking for vendors
  - Implement offline support with local state persistence
  - _Requirements: 2.2, 5.1, 6.1, 23.3_

- [x] 31. Implement disaster recovery and high availability
  - Configure DynamoDB Global Tables for cross-region replication (us-east-1 → us-west-2)
  - Set up Aurora cross-region read replicas
  - Implement S3 cross-region replication for critical buckets
  - Create Route 53 health checks with automatic failover
  - Configure multi-AZ deployment for all critical services
  - Implement automated backup verification and restore testing
  - Set up CloudWatch alarms for failover events
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [x] 32. Implement data retention and compliance features
  - Create Lambda function for automated PII deletion after 3 years of inactivity
  - Implement S3 lifecycle policies for log archival to Glacier after 90 days
  - Build user data export API (JSON format) for GDPR compliance
  - Implement right-to-be-forgotten workflow with PII anonymization
  - Create consent management during user registration
  - Set up data minimization rules for temporary data deletion (GPS tracks, call recordings after 90 days)
  - Configure audit log retention for 7 years
  - _Requirements: 11.3, 11.5, 20.1, 20.2, 20.3, 20.4, 20.5_

- [x] 33. Set up CI/CD pipeline with GitHub Actions
  - Create GitHub Actions workflows for test, build, and deploy
  - Configure OIDC authentication to AWS
  - Implement automated testing on pull requests (unit, integration, linting)
  - Set up environment-specific deployments (dev, staging, prod)
  - Create CDK deployment jobs with approval gates for production
  - Implement smoke tests post-deployment
  - Configure automatic rollback on deployment failures
  - Set up Slack/email notifications for pipeline events
  - _Requirements: 25.3_

- [x] 33.1 Write end-to-end tests for critical user flows
  - _Requirements: 2.2, 4.3, 6.1, 10.3_

- [x] 34. Implement admin configuration and rules engine
  - Create DynamoDB table for system configuration (matching weights, SLA tiers, pricing)
  - Build Lambda functions for configuration CRUD with validation
  - Implement hot-reload mechanism for configuration changes (60-second propagation)
  - Create admin API endpoints: GET/PUT /config/matching, GET/PUT /config/sla-tiers, POST /config/geofences
  - Build geofence polygon drawing interface in admin web app
  - Implement configuration change audit logging
  - Set up configuration versioning for rollback capability
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5_

- [x] 35. Implement performance optimization and caching
  - Configure ElastiCache Redis for vendor profile caching (5-minute TTL)
  - Implement geospatial caching for vendor search results
  - Set up CloudFront distribution for static assets and API caching
  - Configure DynamoDB DAX for hot data acceleration
  - Implement Lambda function warming to reduce cold starts
  - Optimize DynamoDB table design with efficient GSIs
  - Configure AppSync caching for tracking queries
  - Implement database connection pooling for Aurora
  - _Requirements: 25.1, 25.4, 25.5_

- [x] 35.1 Conduct load testing with Artillery for 1000 concurrent incidents
  - _Requirements: 25.2, 25.3_

- [x] 36. Implement vendor data pipeline (optional for MVP)
  - Create Lambda function for web scraping with Playwright
  - Set up proxy rotation and rate limiting for data collection
  - Implement robots.txt compliance checking
  - Build manual verification queue for collected vendor data
  - Create circuit breaker for data collection errors (10% threshold)
  - Implement data provenance logging in audit table
  - Set up IP rotation using proxy services
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5_

- [x] 37. Final integration and system testing
  - Conduct end-to-end testing of complete incident flow (creation → matching → tracking → payment)
  - Verify all EventBridge event flows and subscriptions
  - Test failover scenarios and disaster recovery procedures
  - Validate security controls (authentication, authorization, encryption)
  - Perform penetration testing and vulnerability scanning
  - Conduct performance testing to validate SLA targets
  - Review and validate all audit logging and compliance features
  - _Requirements: All requirements_

