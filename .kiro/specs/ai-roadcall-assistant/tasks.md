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

- [ ] 29.1 Enhance authentication with social login providers
  - Configure Cognito User Pool with federated identity providers
  - Add Microsoft (Azure AD) as identity provider with OAuth 2.0
  - Add Google as identity provider with Google Sign-In
  - Add Apple as identity provider with Sign in with Apple
  - Add Amazon as identity provider with Login with Amazon
  - Keep email/password authentication as fallback option
  - Create unified sign-in page with social login buttons
  - Create sign-up page with provider selection and role assignment (driver/vendor/company)
  - Implement post-authentication redirect based on user role
  - Add profile completion flow for first-time social login users
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 29.2 Build company analytics dashboard
  - Create company dashboard layout with navigation sidebar
  - Implement job call analytics with charts (total calls, by type, by urgency)
  - Build call volume trends chart (daily/weekly/monthly views)
  - Create response time metrics dashboard (avg, P50, P95, P99)
  - Implement cost analysis view (total spend, cost per incident, by service type)
  - Build vendor performance comparison table (response time, completion rate, ratings)
  - Create geographic heatmap showing incident distribution
  - Add export functionality for analytics data (CSV, PDF reports)
  - Implement date range filters and real-time data refresh
  - _Requirements: 16.2, 24.1_

- [ ] 29.3 Build call transcripts and summaries dashboard
  - Create transcripts list view with search and filters (date, incident type, driver)
  - Implement transcript detail view with full text and timestamps
  - Display AI-generated summaries with incident type, urgency, and action items
  - Add sentiment analysis visualization (positive/neutral/negative)
  - Implement key phrases extraction and highlighting
  - Build audio playback integration for original call recordings
  - Create transcript export functionality (PDF, text)
  - Add annotation capability for quality assurance review
  - Implement redacted vs full transcript toggle (PII access control)
  - _Requirements: 2.5, 8.1, 8.2, 8.3, 11.4_

- [ ] 29.4 Build mechanic shop dashboard
  - Create mechanic shop analytics showing accepted jobs, completion rate, earnings
  - Implement job history view with filters (date range, status, incident type)
  - Build earnings dashboard with payout tracking and pending payments
  - Create performance metrics view (avg response time, customer ratings, acceptance rate)
  - Implement service area coverage map with incident density overlay
  - Add availability calendar for scheduling and time-off management
  - Build customer feedback and ratings view
  - Create profile management for services offered and operating hours
  - _Requirements: 4.2, 10.5, 16.2_

- [ ] 29.5 Build responsive mobile-optimized dashboards
  - Create mobile-responsive layouts for all dashboard views
  - Implement touch-friendly UI components for mobile devices
  - Build progressive web app (PWA) capabilities for offline access
  - Add mobile-specific navigation (bottom tab bar)
  - Implement swipe gestures for common actions
  - Create mobile-optimized charts and data visualizations
  - Add push notification integration for mobile web
  - _Requirements: 23.3_

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

- [ ] 30.1 Implement social login in mobile app
  - Add Microsoft authentication with Azure AD SDK
  - Add Google Sign-In with @react-native-google-signin/google-signin
  - Add Apple Sign-In with expo-apple-authentication
  - Add Amazon Login with Amazon SDK
  - Create unified login screen with social provider buttons
  - Implement biometric authentication (Face ID, Touch ID) for returning users
  - Add secure token storage with expo-secure-store
  - Implement automatic token refresh and session management
  - _Requirements: 1.1, 1.2, 1.3_

- [ ] 30.2 Build Uber-like vendor job acceptance interface
  - Create incoming job card with slide-to-accept gesture
  - Display job details: location, incident type, estimated payout, distance
  - Show countdown timer for offer expiration (2 minutes)
  - Implement map preview showing driver location and route
  - Add estimated arrival time calculation
  - Build accept/decline action buttons with haptic feedback
  - Create job queue showing multiple pending offers
  - Implement sound/vibration alerts for new job offers
  - Add quick decline with reason selection (too far, not available, wrong service type)
  - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 30.3 Build driver tracking view (who is coming)
  - Create real-time vendor tracking map with live location updates
  - Display vendor profile card with photo, name, rating, vehicle info
  - Show ETA countdown with dynamic updates based on traffic
  - Implement route visualization on map with vendor path
  - Add vendor contact buttons (call, message)
  - Display vendor status updates (en route, arrived, working, completed)
  - Create arrival notification with geofence detection
  - Build incident timeline showing all status changes
  - Add estimated completion time based on service type
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 30.4 Build vendor navigation and job management
  - Create active job screen with driver details and location
  - Implement turn-by-turn navigation using MapLibre Navigation SDK
  - Add status update buttons (en route, arrived, working, completed)
  - Build photo upload for work documentation
  - Create digital signature capture for job completion
  - Implement offline mode for areas with poor connectivity
  - Add job history view with earnings tracking
  - Build daily earnings summary with payout schedule
  - _Requirements: 6.1, 6.4, 10.5_

- [ ] 30.5 Build company mobile dashboard
  - Create mobile analytics dashboard with key metrics
  - Implement real-time incident monitoring with map view
  - Build call transcripts viewer optimized for mobile
  - Add push notifications for critical incidents
  - Create quick actions for common tasks (assign vendor, escalate, contact driver)
  - Implement voice-to-text for quick notes and updates
  - Build team management view for dispatchers
  - _Requirements: 8.5, 16.2, 24.1_

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

- [ ] 38. Enhance vendor data pipeline for NTTS scraping
  - Analyze NTTS website structure (nttsbreakdown.com) and identify scraping targets
  - Create NTTS-specific selectors for business name, address, phone, services, hours extraction
  - Implement listing page scraper to collect vendor profile URLs
  - Implement detail page scraper for full vendor information
  - Add geocoding integration using AWS Location Service for address-to-coordinates conversion
  - Configure NTTS-specific rate limiting (10 requests/minute)
  - Create DynamoDB table NTTSVendors with geohash GSI for proximity queries
  - Implement data validation for required fields (name, address, phone, services)
  - _Requirements: NTTS-1.1, NTTS-1.2, NTTS-1.3, NTTS-1.4, NTTS-1.5_

- [ ]* 38.1 Write unit tests for NTTS data extraction
  - Test selector accuracy with sample NTTS HTML pages
  - Test address parsing and normalization logic
  - Test phone number formatting to E.164 standard
  - Test service type extraction and mapping to platform categories
  - _Requirements: NTTS-1.3_

- [ ] 39. Build NTTS scraping orchestrator
  - Create EventBridge schedule rule for daily scraping at 2 AM UTC
  - Implement robots.txt checker with 24-hour cache in ElastiCache
  - Build target URL generator for NTTS directory pages by state/region
  - Create SQS queue for scraping jobs with dead-letter queue
  - Implement job prioritization logic (new vendors vs updates)
  - Add CloudWatch metrics for job queue depth and processing rate
  - Build Lambda function to orchestrate scraping workflow
  - Implement circuit breaker monitoring with CloudWatch alarms
  - _Requirements: NTTS-1.1, NTTS-6.1, NTTS-6.4_

- [ ] 40. Implement NTTS verification queue workflow
  - Create DynamoDB table VerificationQueue with status GSI
  - Build Lambda function to add scraped NTTS data to verification queue
  - Create API endpoints: GET /verification/pending, POST /verification/{id}/approve, POST /verification/{id}/reject
  - Implement approval workflow with verifier user ID tracking
  - Add rejection reason capture and storage in DynamoDB
  - Update vendor verification status in NTTSVendors table on approval
  - Publish VendorVerified event to EventBridge for downstream processing
  - Build admin UI component in Next.js for verification queue management
  - _Requirements: NTTS-5.1, NTTS-5.2, NTTS-5.4_

- [ ] 41. Deploy OpenSearch Serverless for vector embeddings
  - Create OpenSearch Serverless collection for NTTS vendor embeddings
  - Configure k-NN index with 1536 dimensions for Amazon Titan embeddings
  - Create index mapping with metadata fields (services, location, specializations, verificationStatus)
  - Implement geospatial + vector hybrid search capability
  - Set up IAM roles for Lambda access to OpenSearch with least-privilege
  - Configure VPC endpoints for secure private access to OpenSearch
  - Implement index refresh and optimization policies
  - _Requirements: NTTS-2.2, NTTS-2.3, NTTS-10.2_

- [ ] 42. Implement Amazon Titan embedding generation service
  - Create Lambda function triggered by VendorVerified EventBridge event
  - Build text description generator from NTTS vendor data (name, services, specializations, location)
  - Integrate Amazon Bedrock Titan Embeddings API with error handling
  - Implement embedding storage in OpenSearch with metadata
  - Add exponential backoff retry logic for Bedrock throttling
  - Configure batch processing for bulk embedding generation (up to 25 vendors per batch)
  - Implement ElastiCache caching for embeddings with 1-hour TTL
  - Add CloudWatch metrics for embedding generation latency and success rate
  - _Requirements: NTTS-2.1, NTTS-2.2, NTTS-10.1_

- [ ]* 42.1 Write integration tests for embedding pipeline
  - Test end-to-end flow: vendor data → text generation → Titan API → OpenSearch storage
  - Test Bedrock Titan API integration with sample vendor data
  - Test OpenSearch indexing and k-NN retrieval accuracy
  - Test ElastiCache hit/miss scenarios and TTL expiration
  - _Requirements: NTTS-2.1, NTTS-2.2_

- [ ] 43. Enhance matching service with semantic search
  - Add semantic search function using OpenSearch k-NN query
  - Implement hybrid scoring algorithm: geospatial (40%) + semantic (30%) + availability (30%)
  - Create Bedrock Claude integration for natural language issue analysis
  - Build vendor capability scoring using Claude to evaluate match quality
  - Implement multi-source vendor aggregation (registered vendors + NTTS vendors)
  - Add match explanation generation using Bedrock for transparency
  - Update match API response to include NTTS vendors with source indicator
  - Implement fallback to NTTS vendors when no registered vendors available
  - _Requirements: NTTS-3.1, NTTS-3.2, NTTS-3.3, NTTS-3.4, NTTS-3.5, NTTS-7.1, NTTS-7.2, NTTS-7.3_

- [ ]* 43.1 Write unit tests for enhanced matching algorithm
  - Test semantic similarity scoring with various issue descriptions
  - Test hybrid score calculation with different weight configurations
  - Test multi-source vendor merging and deduplication
  - Test Bedrock-generated match explanations for clarity
  - _Requirements: NTTS-3.2, NTTS-3.3, NTTS-7.3_

- [ ] 44. Integrate NTTS data with Amazon Kendra
  - Create Kendra data source connector for NTTS vendors
  - Implement Lambda function to sync verified NTTS vendors to Kendra index
  - Define custom attributes for Kendra: services, location, specializations, verificationStatus
  - Configure relevance tuning to boost verified vendors and recent updates
  - Set up incremental sync triggered by VendorVerified and VendorUpdated events
  - Implement Kendra query function with location-based filtering
  - Add faceted search capabilities for service types and geographic regions
  - _Requirements: NTTS-2.4, NTTS-4.2, NTTS-8.1_

- [ ] 45. Enhance telephony service with NTTS knowledge
  - Update Amazon Q in Connect knowledge base configuration to include NTTS data
  - Modify call summary generator Lambda to query NTTS vendors for mechanic recommendations
  - Enhance agent assist function to search NTTS vendors based on incident location and type
  - Implement location-aware mechanic suggestions using geospatial + semantic search
  - Add Bedrock guardrails configuration for NTTS query responses (PII filtering, content safety)
  - Update agent assist API response to include NTTS vendor matches with contact information
  - Implement real-time availability inference for NTTS vendors based on historical data
  - _Requirements: NTTS-4.1, NTTS-4.2, NTTS-4.3, NTTS-4.4, NTTS-4.5_

- [ ] 46. Build unified vendor API for multi-source access
  - Create unified vendor search API combining registered and NTTS vendors
  - Implement source filtering parameter (registered, ntts, all)
  - Add verification status filtering (verified, pending, all)
  - Build vendor detail API with clear source indication in response
  - Create vendor comparison API for duplicate detection across sources
  - Implement vendor merge API for resolving duplicates between registered and NTTS data
  - Add pagination and sorting capabilities for large result sets
  - Configure API Gateway caching for frequently accessed vendor queries
  - _Requirements: NTTS-8.1, NTTS-8.2, NTTS-8.3, NTTS-8.4, NTTS-8.5_

- [ ] 47. Implement NTTS data quality monitoring
  - Create CloudWatch dashboard for NTTS scraping metrics (success rate, error rate, queue depth)
  - Add CloudWatch alarms for circuit breaker open state
  - Implement data completeness checks for required fields (name, address, phone)
  - Build duplicate detection using fuzzy string matching for business names
  - Create data freshness monitoring tracking last scrape timestamp per vendor
  - Add verification queue depth alarm triggering at >100 pending items
  - Implement scraping success rate tracking with alarm at <90%
  - Build automated data quality reports sent to admin team daily
  - _Requirements: NTTS-5.2, NTTS-6.4, NTTS-9.4, NTTS-10.3_

- [ ] 48. Build continuous NTTS update pipeline
  - Create EventBridge rule for daily incremental scraping schedule
  - Implement change detection comparing new scrape data with existing vendor records
  - Build incremental update logic updating only changed fields to minimize writes
  - Create S3 archival for historical NTTS data with 90-day retention policy
  - Implement vendor deactivation workflow for vendors removed from NTTS
  - Add re-verification workflow triggered by significant data changes (address, phone, services)
  - Build vendor update notification system for registered vendors with NTTS conflicts
  - _Requirements: NTTS-6.1, NTTS-6.2, NTTS-6.3, NTTS-6.5_

- [ ] 49. Implement NTTS compliance and audit features
  - Create DynamoDB table ScrapingAuditLog for all NTTS scraping activities
  - Implement data provenance tracking (source URL, timestamp, collector ID, IP address)
  - Build compliance flag system (robotsTxtCompliant, rateLimitCompliant, legalReview)
  - Add legal review queue for vendors flagged with potential compliance issues
  - Create audit report generation API for compliance team review
  - Implement GDPR-compliant data deletion workflow for NTTS vendor data
  - Build compliance dashboard showing robots.txt adherence and rate limit metrics
  - _Requirements: NTTS-5.2, NTTS-9.1, NTTS-9.2, NTTS-9.3, NTTS-9.5_

- [ ] 50. Optimize NTTS integration performance
  - Implement ElastiCache Redis caching for NTTS embeddings with 1-hour TTL
  - Add Redis caching for frequent semantic search queries with 15-minute TTL
  - Configure OpenSearch query result caching for common search patterns
  - Implement Lambda provisioned concurrency for enhanced matching service (5 instances)
  - Add DynamoDB DAX for hot NTTS vendor data acceleration
  - Optimize Bedrock API calls with request batching (up to 25 requests per batch)
  - Implement connection pooling for OpenSearch to reduce latency
  - Configure CloudFront caching for NTTS vendor profile images and static data
  - _Requirements: NTTS-2.5, NTTS-10.1, NTTS-10.2, NTTS-10.5_

- [ ]* 50.1 Conduct load testing for NTTS integration
  - Test 1000 concurrent semantic searches with OpenSearch k-NN
  - Test daily scraping of 10,000 NTTS vendors within 4-hour window
  - Test enhanced matching service with NTTS data under 500 req/min load
  - Test Bedrock API rate limit handling with exponential backoff
  - Validate P95 latency targets: semantic search <500ms, matching <3s
  - _Requirements: NTTS-10.2, NTTS-10.3, NTTS-10.4_

- [ ] 51. Build NTTS admin dashboard features
  - Create verification queue UI in Next.js admin panel with pending items list
  - Implement vendor detail view showing NTTS source URL and scraped data
  - Add approve/reject buttons with rejection reason text input
  - Build scraping job monitor displaying active jobs, success rate, and errors
  - Create circuit breaker status indicator with manual reset capability
  - Add manual scraping trigger for specific NTTS URLs or regions
  - Implement vendor data diff viewer showing changes between scrapes
  - Build NTTS coverage map showing geographic distribution of vendors
  - _Requirements: NTTS-5.1, NTTS-5.2, NTTS-6.2, NTTS-8.2, NTTS-8.3_

- [ ] 52. Implement NTTS mobile app integration
  - Update driver mobile app to display NTTS vendor matches with source badge
  - Add source indicator UI (registered vs NTTS) in vendor list and detail views
  - Implement vendor detail view showing NTTS-specific data (hours, specializations)
  - Add "call vendor" button for NTTS mechanics with phone number formatting
  - Update vendor mobile app to show nearby NTTS competition for market awareness
  - Implement offline caching for NTTS vendor data in driver app
  - _Requirements: NTTS-3.4, NTTS-8.2_

- [ ] 53. Build NTTS analytics and reporting
  - Create ETL pipeline for NTTS vendor usage metrics in Aurora data warehouse
  - Build reporting on NTTS vs registered vendor match rates
  - Implement match success rate tracking by vendor source (registered vs NTTS)
  - Add geographic coverage analysis showing NTTS vendor density by region
  - Create service type distribution reports for NTTS vendors
  - Build verification queue metrics dashboard (pending count, avg review time, approval rate)
  - Implement cost tracking for Bedrock API usage (Titan embeddings, Claude scoring)
  - _Requirements: NTTS-5.2, NTTS-8.2, NTTS-10.3_

- [ ] 54. Implement NTTS data export and backup
  - Create S3 backup for NTTS vendor data with daily snapshots
  - Implement cross-region replication to us-west-2 for disaster recovery
  - Build data export API supporting CSV and JSON formats
  - Create vendor data snapshot for analytics team consumption
  - Implement point-in-time recovery for NTTS vendor data using DynamoDB backups
  - Build automated backup verification testing weekly
  - _Requirements: NTTS-6.3, NTTS-9.2_

- [ ] 55. Final NTTS integration testing
  - Test end-to-end incident flow with NTTS vendor matching and assignment
  - Verify Amazon Q in Connect provides accurate NTTS mechanic recommendations
  - Test agent assist with NTTS vendor queries during live calls
  - Validate Bedrock guardrails prevent PII leakage in NTTS responses
  - Conduct security review of NTTS scraping pipeline and data storage
  - Perform cost optimization analysis for Bedrock and OpenSearch usage
  - Test failover scenarios with NTTS data in secondary region
  - Validate all NTTS compliance and audit logging requirements
  - _Requirements: All NTTS requirements_

- [x] 56. Final integration and system testing
  - Conduct end-to-end testing of complete incident flow (creation → matching → tracking → payment)
  - Verify all EventBridge event flows and subscriptions
  - Test failover scenarios and disaster recovery procedures
  - Validate security controls (authentication, authorization, encryption)
  - Perform penetration testing and vulnerability scanning
  - Conduct performance testing to validate SLA targets
  - Review and validate all audit logging and compliance features
  - _Requirements: All requirements_

