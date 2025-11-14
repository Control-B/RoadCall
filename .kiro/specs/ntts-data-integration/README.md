# NTTS Data Integration Specification

## Overview

This specification outlines the integration of NTTS (National Truck & Trailer Services) mechanic data from nttsbreakdown.com into the RoadCall AI Roadside Assistant platform. The integration leverages existing AWS services including Amazon Bedrock (Titan, Claude), Amazon Q in Connect, Amazon Kendra, and the existing microservices architecture.

## Business Value

### Problem Statement
The RoadCall platform currently relies on manually registered vendors, which limits coverage and may leave drivers stranded in areas without registered mechanics. NTTS provides a comprehensive directory of truck and trailer repair shops across the country, but this data is not currently accessible to the platform's AI matching system.

### Solution
By scraping and integrating NTTS data, we can:
1. **Expand Coverage**: Access thousands of mechanics nationwide
2. **Improve Matching**: Use AI-powered semantic search to find specialists
3. **Enhance Agent Assist**: Provide real-time mechanic recommendations via Amazon Q
4. **Reduce Response Time**: Automatically match drivers with nearby mechanics
5. **Increase Success Rate**: Match based on specialization, not just proximity

## Architecture Summary

```
Driver Breakdown → Amazon Connect → AI Analysis (Bedrock Claude)
                                           ↓
                                    Issue Extraction
                                           ↓
                    ┌──────────────────────┴──────────────────────┐
                    ↓                                              ↓
            Geospatial Search                              Semantic Search
         (DynamoDB + Redis)                            (OpenSearch + Titan)
                    ↓                                              ↓
            Registered Vendors                              NTTS Vendors
                    └──────────────────────┬──────────────────────┘
                                           ↓
                                  Unified Ranking (Bedrock)
                                           ↓
                                  Top 3 Matches → Offers
```

## Key Technologies

### AWS Services
- **Amazon Bedrock**: 
  - Titan Embeddings for semantic search
  - Claude for issue analysis and match scoring
  - Guardrails for PII filtering and content safety
- **Amazon Q in Connect**: Real-time agent assist with NTTS knowledge
- **Amazon Kendra**: Document indexing and semantic search
- **Amazon Location Service**: Geocoding and geospatial queries
- **AWS Lambda**: Serverless compute for all processing
- **DynamoDB**: NoSQL database for vendor data
- **OpenSearch Serverless**: Vector database for embeddings
- **ElastiCache Redis**: Caching and geospatial indexing
- **EventBridge**: Event-driven orchestration
- **SQS**: Job queue for scraping tasks

### Existing Services Enhanced
1. **vendor-data-pipeline-svc**: Extended for NTTS scraping
2. **kb-svc**: Enhanced with NTTS embeddings and Kendra integration
3. **match-svc**: Upgraded with semantic search and multi-source matching
4. **telephony-svc**: Integrated with Q in Connect for NTTS recommendations

## Implementation Phases

### Phase 1: Data Collection (Weeks 1-2)
- Set up NTTS scraping pipeline
- Create DynamoDB tables
- Implement verification queue
- Build scraping orchestrator

**Deliverables**:
- Functional scraper collecting NTTS data
- Verification queue for manual review
- Admin dashboard for data management

### Phase 2: AI Integration (Weeks 3-4)
- Deploy OpenSearch vector database
- Implement Titan embedding generation
- Integrate Bedrock Claude for analysis
- Build semantic search capabilities

**Deliverables**:
- Vector database with NTTS embeddings
- Semantic search API
- Bedrock-powered match scoring

### Phase 3: Service Enhancement (Weeks 5-6)
- Enhance matching service with NTTS data
- Integrate with Amazon Q in Connect
- Update Kendra knowledge base
- Build unified vendor API

**Deliverables**:
- Enhanced matching with NTTS vendors
- Agent assist with NTTS recommendations
- Unified vendor search API

### Phase 4: Testing & Optimization (Weeks 7-8)
- Load testing and performance optimization
- Security review and compliance validation
- Cost optimization
- Documentation and training

**Deliverables**:
- Production-ready system
- Performance benchmarks met
- Security audit passed
- User documentation

## Success Metrics

### Coverage Metrics
- **Target**: 10,000+ NTTS vendors indexed
- **Geographic Coverage**: All 50 US states
- **Service Types**: Tire, engine, towing, electrical

### Performance Metrics
- **Scraping**: 10 pages/minute, complete 10K vendors in <4 hours
- **Embedding Generation**: <2 seconds per vendor
- **Semantic Search**: <500ms for top 10 results
- **Enhanced Matching**: <3 seconds end-to-end
- **Agent Assist**: <2 seconds response time

### Quality Metrics
- **Data Accuracy**: >95% after verification
- **Match Relevance**: >90% driver satisfaction
- **Verification Rate**: >80% of scraped data verified within 48 hours
- **Circuit Breaker**: <10% error rate maintained

### Business Metrics
- **Match Success Rate**: +20% improvement
- **Average Response Time**: -30% reduction
- **Driver Satisfaction**: +15% increase
- **Coverage Gaps**: -50% reduction

## Compliance and Legal

### Data Collection Ethics
1. **Robots.txt Compliance**: All scraping respects robots.txt directives
2. **Rate Limiting**: 10 requests/minute to avoid service disruption
3. **Public Data Only**: Only publicly available business information collected
4. **No PII**: No personal information of individuals collected
5. **Attribution**: Data source tracked for transparency

### Data Usage
1. **Business Purpose**: Roadside assistance matching only
2. **No Resale**: Data not sold or shared with third parties
3. **Verification Required**: Manual review before operational use
4. **Opt-Out**: Vendors can request removal
5. **Audit Trail**: Complete provenance tracking

### AWS Compliance
1. **Encryption**: All data encrypted at rest (KMS) and in transit (TLS 1.3)
2. **Access Control**: IAM roles with least-privilege
3. **Audit Logging**: CloudTrail for all API calls
4. **Bedrock Guardrails**: PII filtering and content safety
5. **Data Retention**: 90-day retention with archival to Glacier

## Cost Estimate

### Monthly Operational Costs (10K vendors)

**AWS Services**:
- Lambda (scraping + processing): $150
- DynamoDB (on-demand): $100
- OpenSearch Serverless: $300
- ElastiCache Redis: $50
- Bedrock Titan Embeddings: $200 (10K embeddings/month)
- Bedrock Claude (matching): $500 (100K requests/month)
- Kendra (Developer Edition): $810
- S3 Storage: $20
- Data Transfer: $50

**Total**: ~$2,180/month

**Cost per Match**: ~$0.02 (assuming 100K matches/month)

### One-Time Setup Costs
- Development: 8 weeks × $10K/week = $80K
- Testing & QA: $10K
- Documentation: $5K

**Total**: ~$95K

## Risks and Mitigation

### Technical Risks
1. **NTTS Website Changes**: 
   - Risk: Scraper breaks if HTML structure changes
   - Mitigation: Automated monitoring, flexible selectors, manual fallback

2. **Bedrock Rate Limits**:
   - Risk: Throttling during high load
   - Mitigation: Request quota increase, implement caching, batch processing

3. **Data Quality**:
   - Risk: Inaccurate or outdated NTTS data
   - Mitigation: Verification queue, regular updates, user feedback

### Legal Risks
1. **Terms of Service Violation**:
   - Risk: NTTS may prohibit scraping
   - Mitigation: Legal review, robots.txt compliance, rate limiting, partnership discussion

2. **Data Accuracy Liability**:
   - Risk: Incorrect data leads to poor service
   - Mitigation: Verification workflow, data source attribution, user reviews

### Operational Risks
1. **Verification Backlog**:
   - Risk: Queue grows faster than manual review
   - Mitigation: Automated quality checks, prioritization, additional reviewers

2. **Cost Overruns**:
   - Risk: Bedrock costs exceed budget
   - Mitigation: Caching, batch processing, cost monitoring, alerts

## Next Steps

1. **Legal Review**: Confirm NTTS scraping is permissible
2. **Spec Approval**: Review and approve this specification
3. **Resource Allocation**: Assign development team
4. **Phase 1 Kickoff**: Begin NTTS scraping implementation
5. **Stakeholder Communication**: Update drivers and vendors on expanded coverage

## Questions for Review

1. Do we have legal approval to scrape NTTS data?
2. Should we reach out to NTTS for a data partnership?
3. What is the priority vs other platform features?
4. Do we have budget approval for Bedrock and Kendra costs?
5. What is the target launch date for Phase 1?

## References

- [NTTS Website](https://www.nttsbreakdown.com)
- [Amazon Bedrock Documentation](https://docs.aws.amazon.com/bedrock/)
- [Amazon Q in Connect](https://docs.aws.amazon.com/connect/latest/adminguide/amazon-q-connect.html)
- [Amazon Kendra](https://docs.aws.amazon.com/kendra/)
- [Existing Vendor Data Pipeline](../../services/vendor-data-pipeline-svc/README.md)
- [Knowledge Base Service](../../services/kb-svc/README.md)
- [Matching Service](../../services/match-svc/README.md)
- [Telephony Service](../../services/telephony-svc/README.md)

---

**Specification Version**: 1.0  
**Last Updated**: 2024-01-15  
**Status**: Draft - Awaiting Approval  
**Owner**: Platform Engineering Team
