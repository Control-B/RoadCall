# RoadCall Microservice Architecture

## Overview
RoadCall is built as a microservice architecture with clear separation between frontend applications and backend services.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend Layer                           │
├─────────────────────────────────────────────────────────────┤
│  Landing (3000)  │  Admin (3001)  │  Dispatcher (3002)      │
│  Driver (3003)   │  Vendor (3004) │  PWA (3005)             │
│  Mobile (React Native/Expo)                                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                      AWS Services                            │
├─────────────────────────────────────────────────────────────┤
│  CloudFront  │  Cognito  │  AppSync  │  API Gateway         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services (Lambda)                  │
├─────────────────────────────────────────────────────────────┤
│  auth-svc          │  driver-svc       │  vendor-svc        │
│  incident-svc      │  match-svc        │  tracking-svc      │
│  notifications-svc │  payments-svc     │  telephony-svc     │
│  kb-svc (Bedrock)  │  reporting-svc    │  compliance-svc    │
│  admin-config-svc  │  vendor-pipeline  │                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    Data & Event Layer                        │
├─────────────────────────────────────────────────────────────┤
│  DynamoDB  │  EventBridge  │  SQS  │  SNS  │  S3           │
└─────────────────────────────────────────────────────────────┘
```

## Frontend Applications

### 1. Landing Page (`@roadcall/landing`)
- **Purpose**: Public marketing site
- **Port**: 3000
- **Tech**: Next.js 14, Tailwind CSS
- **Auth**: None (public)
- **Deployment**: CloudFront + S3

### 2. Admin Dashboard (`@roadcall/admin-dashboard`)
- **Purpose**: System administration
- **Port**: 3001
- **Users**: RoadCall admins
- **Features**: User management, system config, analytics
- **Auth**: Cognito (admin role)
- **Deployment**: CloudFront + S3

### 3. Dispatcher Dashboard (`@roadcall/dispatcher-dashboard`)
- **Purpose**: Call center operations
- **Port**: 3002
- **Users**: Dispatchers, agents
- **Features**: Incident management, vendor assignment, tracking
- **Auth**: Cognito (dispatcher role)
- **Deployment**: CloudFront + S3
- **Special**: Amazon Connect integration

### 4. Driver Dashboard (`@roadcall/driver-dashboard`)
- **Purpose**: Driver self-service
- **Port**: 3003
- **Users**: Drivers
- **Features**: Request help, track service, payment, history
- **Auth**: Cognito (driver role)
- **Deployment**: CloudFront + S3

### 5. Vendor Dashboard (`@roadcall/vendor-dashboard`)
- **Purpose**: Service provider interface
- **Port**: 3004
- **Users**: Vendors (tow trucks, mechanics)
- **Features**: Accept jobs, navigation, status updates, earnings
- **Auth**: Cognito (vendor role)
- **Deployment**: CloudFront + S3

### 6. PWA (`@roadcall/pwa`)
- **Purpose**: Mobile web experience
- **Port**: 3005
- **Users**: Mobile users without app
- **Features**: Lightweight driver/vendor experience
- **Auth**: Cognito
- **Deployment**: CloudFront + S3
- **Special**: Service worker, offline support

### 7. Mobile App (`@roadcall/mobile`)
- **Purpose**: Native mobile experience
- **Platform**: iOS & Android
- **Tech**: React Native, Expo
- **Users**: Drivers and vendors
- **Features**: Full native experience, offline support, push notifications
- **Auth**: AWS Amplify + Cognito
- **Deployment**: Expo EAS, App Stores

## Backend Services

### Authentication & Authorization
- **auth-svc**: User authentication, token management
- **AWS Cognito**: Identity provider
- **IAM**: Service-to-service auth

### Core Services
- **driver-svc**: Driver profile, preferences, history
- **vendor-svc**: Vendor profile, availability, ratings
- **incident-svc**: Breakdown request management
- **match-svc**: Vendor matching algorithm
- **tracking-svc**: Real-time location tracking

### Communication Services
- **notifications-svc**: Push, SMS, email notifications
- **telephony-svc**: Amazon Connect integration
- **kb-svc**: AI knowledge base (Bedrock)

### Business Services
- **payments-svc**: Payment processing, billing
- **reporting-svc**: Analytics, dashboards
- **compliance-svc**: Audit logs, compliance checks
- **admin-config-svc**: System configuration

### Data Pipeline
- **vendor-data-pipeline-svc**: Vendor data ingestion, validation

## Shared Packages

### @roadcall/types
- TypeScript type definitions
- Shared across all apps and services
- Single source of truth for data models

### @roadcall/ui-components
- Reusable React components
- Radix UI primitives
- Tailwind CSS styling
- Used by all web frontends

### @roadcall/api-client
- API client utilities
- GraphQL queries/mutations
- REST API wrappers
- Used by all frontends

### @roadcall/utils
- Common utility functions
- Date formatting, validation, etc.
- Used by all apps and services

### @roadcall/events
- Event definitions for EventBridge
- Event schemas and types
- Used by all services

### @roadcall/aws-clients
- Configured AWS SDK clients
- DynamoDB, S3, SQS, SNS, etc.
- Used by all services

## Communication Patterns

### Synchronous (Request/Response)
- **Frontend → Backend**: AppSync (GraphQL) or API Gateway (REST)
- **Service → Service**: Direct Lambda invocation (rare)

### Asynchronous (Event-Driven)
- **Service → Service**: EventBridge events
- **Service → Queue**: SQS for reliable processing
- **Service → Notification**: SNS for fan-out

### Real-Time
- **Backend → Frontend**: AppSync subscriptions
- **Location Updates**: WebSocket via AppSync

## Data Storage

### DynamoDB Tables
Each service owns its tables:
- `drivers`: Driver profiles
- `vendors`: Vendor profiles
- `incidents`: Breakdown requests
- `matches`: Vendor matches
- `tracking`: Location history
- `payments`: Payment records
- `notifications`: Notification history
- `audit-logs`: Compliance logs

### S3 Buckets
- `roadcall-assets`: Static assets
- `roadcall-uploads`: User uploads (photos, documents)
- `roadcall-backups`: Database backups
- `roadcall-logs`: Application logs

## Security

### Authentication
- AWS Cognito user pools
- JWT tokens
- MFA support

### Authorization
- Cognito groups (admin, dispatcher, driver, vendor)
- IAM roles for services
- Fine-grained permissions

### Network Security
- WAF rules
- API rate limiting
- DDoS protection via CloudFront

### Data Security
- Encryption at rest (DynamoDB, S3)
- Encryption in transit (TLS)
- Secrets Manager for credentials

## Monitoring & Observability

### Logging
- CloudWatch Logs
- Structured JSON logging
- Log aggregation per service

### Metrics
- CloudWatch Metrics
- Custom business metrics
- Service health dashboards

### Tracing
- X-Ray distributed tracing
- Request flow visualization
- Performance bottleneck identification

### Alerting
- CloudWatch Alarms
- SNS notifications
- PagerDuty integration

## Deployment

### CI/CD Pipeline
- GitHub Actions
- Separate pipelines per app/service
- Automated testing
- Blue/green deployments

### Environments
- **dev**: Development environment
- **staging**: Pre-production testing
- **prod**: Production environment

### Infrastructure as Code
- AWS CDK (TypeScript)
- Separate stacks per service
- Automated provisioning

## Disaster Recovery

### Backup Strategy
- DynamoDB point-in-time recovery
- S3 versioning and replication
- Cross-region backups

### RTO/RPO
- RTO: 4 hours
- RPO: 1 hour
- Automated failover

## Scalability

### Auto-Scaling
- Lambda auto-scales automatically
- DynamoDB on-demand capacity
- CloudFront global distribution

### Performance
- API response time < 200ms (p95)
- Real-time updates < 1s latency
- Support 10,000+ concurrent users

## Development Workflow

### Local Development
```bash
# Run all apps
pnpm dev

# Run specific app
cd apps/landing && pnpm dev

# Run specific service
cd services/auth-svc && pnpm dev
```

### Testing
```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# E2E tests
pnpm test:e2e
```

### Deployment
```bash
# Deploy infrastructure
cd infrastructure && pnpm deploy

# Deploy specific service
cd services/auth-svc && pnpm deploy

# Deploy frontend
cd apps/landing && pnpm build && pnpm deploy
```

## Key Principles

### 1. Separation of Concerns
- Each app/service has single responsibility
- Clear boundaries between components
- No shared runtime dependencies

### 2. Independent Deployment
- Apps deploy independently
- Services deploy independently
- No cascading deployments

### 3. Fault Isolation
- Failure in one service doesn't affect others
- Circuit breakers prevent cascade failures
- Graceful degradation

### 4. Scalability
- Horizontal scaling via Lambda
- Stateless services
- Distributed data storage

### 5. Security First
- Zero trust architecture
- Least privilege access
- Defense in depth

### 6. Observability
- Comprehensive logging
- Distributed tracing
- Real-time monitoring

## Future Enhancements

- [ ] GraphQL Federation for unified API
- [ ] Service mesh (App Mesh)
- [ ] Multi-region active-active
- [ ] Advanced caching (ElastiCache)
- [ ] ML-powered matching algorithm
- [ ] Blockchain for audit trail
