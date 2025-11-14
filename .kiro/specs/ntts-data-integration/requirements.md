# Requirements Document

## Introduction

This document outlines the requirements for integrating NTTS (National Truck & Trailer Services) data into the RoadCall AI Roadside Assistant platform. The system will scrape vendor data from nttsbreakdown.com, build a comprehensive knowledge base, and enhance the AI matching algorithm with real-world mechanic shop data.

## Glossary

- **NTTS**: National Truck & Trailer Services - a directory of truck and trailer repair shops
- **RoadCall Platform**: The AI-powered roadside assistance dispatch system
- **Vendor Data Pipeline**: The service responsible for ethical web scraping and data collection
- **Knowledge Base Service**: The service managing document storage and RAG queries using Amazon Bedrock
- **Matching Service**: The AI service that connects drivers with mechanics based on location and capabilities
- **Amazon Bedrock**: AWS service for foundation models (Claude, Titan)
- **Amazon Titan**: Amazon's embedding model for semantic search
- **Amazon Q**: AWS AI assistant for knowledge base queries
- **Amazon Connect**: AWS cloud contact center service

## Requirements

### Requirement 1: NTTS Data Scraping

**User Story:** As a platform administrator, I want to automatically collect mechanic shop data from NTTS, so that drivers have access to a comprehensive network of service providers.

#### Acceptance Criteria

1. WHEN the system initiates a scraping job, THE Vendor Data Pipeline SHALL check nttsbreakdown.com robots.txt for compliance
2. WHILE scraping is active, THE Vendor Data Pipeline SHALL respect rate limits of 10 requests per minute
3. WHEN a mechanic shop page is accessed, THE Vendor Data Pipeline SHALL extract business name, address, phone number, service types, and operating hours
4. WHEN data is collected, THE Vendor Data Pipeline SHALL store raw data in the verification queue for manual review
5. WHERE proxy rotation is configured, THE Vendor Data Pipeline SHALL rotate IP addresses to distribute load

### Requirement 2: Knowledge Base Enhancement

**User Story:** As an AI system, I want to build embeddings from NTTS data, so that I can perform semantic search for mechanic capabilities and specializations.

#### Acceptance Criteria

1. WHEN vendor data is approved, THE Knowledge Base Service SHALL generate embeddings using Amazon Titan
2. THE Knowledge Base Service SHALL store embeddings in a vector database for semantic search
3. WHEN a driver requests service, THE Knowledge Base Service SHALL perform similarity search to find relevant mechanics
4. THE Knowledge Base Service SHALL index mechanic specializations (tire, engine, electrical, towing) as searchable attributes
5. WHEN querying the knowledge base, THE Knowledge Base Service SHALL return results within 500 milliseconds

### Requirement 3: Real-Time Matching Enhancement

**User Story:** As a driver with a breakdown, I want to be matched with mechanics who specialize in my specific issue, so that I receive expert service quickly.

#### Acceptance Criteria

1. WHEN an incident is created, THE Matching Service SHALL query both DynamoDB vendors and NTTS knowledge base
2. THE Matching Service SHALL combine geospatial proximity with semantic capability matching
3. WHEN calculating match scores, THE Matching Service SHALL weight NTTS-sourced vendors equally with registered vendors
4. THE Matching Service SHALL prioritize mechanics with verified specializations for the incident type
5. WHEN no registered vendors are available, THE Matching Service SHALL automatically search NTTS data within expanded radius

### Requirement 4: Amazon Q Integration for Driver Queries

**User Story:** As a driver calling for assistance, I want the AI to understand my problem description, so that I'm matched with the right specialist.

#### Acceptance Criteria

1. WHEN a driver describes their issue via Amazon Connect, THE Telephony Service SHALL use Amazon Q to extract incident type and urgency
2. THE Telephony Service SHALL query the NTTS knowledge base for relevant mechanic specializations
3. WHEN generating call summaries, THE Telephony Service SHALL include recommended mechanic types from NTTS data
4. THE Telephony Service SHALL use Bedrock guardrails to filter PII from NTTS queries
5. WHEN agent assist is requested, THE Telephony Service SHALL provide mechanic recommendations within 2 seconds

### Requirement 5: Data Quality and Verification

**User Story:** As a platform administrator, I want to verify NTTS data accuracy before using it for matching, so that drivers receive reliable service.

#### Acceptance Criteria

1. WHEN NTTS data is scraped, THE Vendor Data Pipeline SHALL flag entries for manual verification
2. THE Vendor Data Pipeline SHALL track data provenance including source URL and collection timestamp
3. WHEN verification is complete, THE Vendor Data Pipeline SHALL update vendor status to "verified" in DynamoDB
4. THE Vendor Data Pipeline SHALL implement a circuit breaker that halts scraping at 10% error rate
5. WHERE data conflicts exist, THE Vendor Data Pipeline SHALL prioritize manually verified data over scraped data

### Requirement 6: Continuous Data Updates

**User Story:** As a platform operator, I want NTTS data to be refreshed regularly, so that mechanic information stays current.

#### Acceptance Criteria

1. THE Vendor Data Pipeline SHALL schedule daily scraping jobs using EventBridge
2. WHEN a mechanic's data changes, THE Vendor Data Pipeline SHALL detect differences and flag for review
3. THE Vendor Data Pipeline SHALL archive historical data for 90 days before deletion
4. WHEN scraping fails repeatedly, THE Vendor Data Pipeline SHALL send CloudWatch alarms to administrators
5. THE Vendor Data Pipeline SHALL maintain audit logs of all data updates for compliance

### Requirement 7: Bedrock-Powered Semantic Matching

**User Story:** As a matching algorithm, I want to use Amazon Bedrock to understand natural language descriptions of vehicle issues, so that I can find the best-suited mechanic.

#### Acceptance Criteria

1. WHEN a driver describes their issue, THE Matching Service SHALL use Bedrock Claude to extract key problem indicators
2. THE Matching Service SHALL generate embeddings using Amazon Titan for semantic similarity
3. WHEN comparing mechanics, THE Matching Service SHALL use Bedrock to score capability alignment
4. THE Matching Service SHALL apply Bedrock guardrails to ensure safe and appropriate matching
5. WHEN generating match explanations, THE Matching Service SHALL use Bedrock to create human-readable justifications

### Requirement 8: Multi-Source Vendor Aggregation

**User Story:** As a dispatcher, I want to see both registered vendors and NTTS mechanics in one unified view, so that I can make informed assignment decisions.

#### Acceptance Criteria

1. THE Vendor Service SHALL maintain a unified vendor index combining registered and NTTS-sourced mechanics
2. WHEN displaying vendor lists, THE Vendor Service SHALL indicate data source (registered vs NTTS)
3. THE Vendor Service SHALL allow filtering by verification status and data source
4. WHEN a vendor exists in both systems, THE Vendor Service SHALL merge records and prioritize registered data
5. THE Vendor Service SHALL expose vendor source metadata via API for transparency

### Requirement 9: Compliance and Legal Safeguards

**User Story:** As a legal compliance officer, I want to ensure NTTS data collection follows all applicable laws, so that the platform operates ethically and legally.

#### Acceptance Criteria

1. THE Vendor Data Pipeline SHALL only collect publicly available information from NTTS
2. THE Vendor Data Pipeline SHALL respect robots.txt directives and crawl-delay settings
3. WHEN storing NTTS data, THE Vendor Data Pipeline SHALL include legal compliance flags
4. THE Vendor Data Pipeline SHALL implement rate limiting to avoid service disruption
5. WHERE terms of service prohibit scraping, THE Vendor Data Pipeline SHALL halt collection and alert administrators

### Requirement 10: Performance and Scalability

**User Story:** As a system architect, I want NTTS data integration to scale efficiently, so that the platform can handle thousands of mechanics without performance degradation.

#### Acceptance Criteria

1. THE Knowledge Base Service SHALL cache NTTS embeddings in ElastiCache with 1-hour TTL
2. WHEN performing semantic search, THE Knowledge Base Service SHALL use vector database indexing for sub-second queries
3. THE Matching Service SHALL batch NTTS queries to minimize Bedrock API calls
4. THE Vendor Data Pipeline SHALL process scraping jobs in parallel using SQS and Lambda
5. WHEN load increases, THE Knowledge Base Service SHALL auto-scale DynamoDB and Lambda capacity
