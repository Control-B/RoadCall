# AI Roadcall Assistant

A cloud-native, event-driven platform built on AWS that connects truck drivers with roadside service vendors in real-time.

## Project Structure

This is a monorepo managed with Turborepo and pnpm workspaces.

```
.
├── apps/                    # Frontend applications
│   ├── web/                # Next.js web application (future)
│   └── mobile/             # React Native mobile app (future)
├── services/               # Backend microservices
│   ├── auth-svc/          # Authentication service (future)
│   ├── incident-svc/      # Incident management service (future)
│   ├── vendor-svc/        # Vendor management service (future)
│   ├── match-svc/         # Vendor matching service (future)
│   ├── tracking-svc/      # Real-time tracking service (future)
│   ├── telephony-svc/     # Telephony integration service (future)
│   ├── payments-svc/      # Payment processing service (future)
│   ├── kb-svc/            # Knowledge base service (future)
│   ├── notifications-svc/ # Notifications service (future)
│   ├── reporting-svc/     # Reporting and analytics service (future)
│   └── driver-svc/        # Driver management service (future)
├── packages/              # Shared libraries
│   ├── types/            # Shared TypeScript types
│   ├── utils/            # Utility functions
│   └── aws-clients/      # AWS SDK wrappers
├── infrastructure/        # AWS CDK infrastructure code
└── .kiro/                # Kiro specs and configuration

```

## Technology Stack

- **Monorepo**: Turborepo + npm workspaces
- **Language**: TypeScript
- **Compute**: AWS Lambda (Node.js), ECS Fargate
- **API Layer**: API Gateway (REST + WebSocket), AWS AppSync (GraphQL)
- **Data Stores**: DynamoDB, Aurora Postgres, ElastiCache Redis
- **AI/ML**: Amazon Connect, Q in Connect, Bedrock, Kendra, Comprehend
- **Geospatial**: AWS Location Service
- **Messaging**: EventBridge, SQS, SNS, Pinpoint
- **Storage**: S3, S3 Glacier
- **Auth**: Cognito User Pools, IAM
- **Observability**: CloudWatch, X-Ray, CloudTrail
- **Security**: WAF, Secrets Manager, KMS, GuardDuty
- **Frontend**: Next.js (web), React Native + Expo (mobile)
- **IaC**: AWS CDK (TypeScript)

## Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- AWS CLI configured
- AWS CDK CLI

## Getting Started

### Install Dependencies

```bash
npm install
```

### Build All Packages

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Lint Code

```bash
npm run lint
```

### Format Code

```bash
npm run format
```

### Type Check

```bash
npm run typecheck
```

## Shared Packages

### @roadcall/types

Core domain types and interfaces used across all services.

```typescript
import { Incident, Vendor, Offer } from '@roadcall/types';
```

### @roadcall/utils

Utility functions for validation, formatting, geospatial calculations, logging, and error handling.

```typescript
import { isValidE164Phone, calculateDistance, logger } from '@roadcall/utils';
```

### @roadcall/aws-clients

Wrapper classes for AWS SDK clients with built-in logging and error handling.

```typescript
import { dynamodb, s3, eventBridge, secretsManager } from '@roadcall/aws-clients';
```

## Infrastructure

AWS infrastructure is defined using AWS CDK in the `infrastructure/` directory.

### Deploy Infrastructure

```bash
# Deploy to dev environment
cd infrastructure
npm run cdk deploy --all --context stage=dev

# Deploy to staging
npm run cdk deploy --all --context stage=staging

# Deploy to production
npm run cdk deploy --all --context stage=prod
```

### Synthesize CloudFormation

```bash
cd infrastructure
npm run cdk synth
```

## Development Workflow

1. Make changes to code
2. Run type checking: `npm run typecheck`
3. Run linting: `npm run lint`
4. Run tests: `npm test`
5. Format code: `npm run format`
6. Build: `npm run build`

## Architecture Principles

1. **Security First**: Zero-trust architecture with encrypted data at rest and in transit
2. **Microservices Isolation**: Each service owns its data store
3. **Event-Driven**: Domain events published to EventBridge enable loose coupling
4. **Resilience**: Circuit breakers, bulkheads, health checks, and multi-AZ deployment
5. **Observability**: X-Ray tracing, CloudWatch metrics, and structured logging
6. **Scalability**: Serverless-first approach with Lambda and DynamoDB on-demand

## Contributing

Please refer to the design and requirements documents in `.kiro/specs/ai-roadcall-assistant/` for detailed information about the system architecture and requirements.

## License

Private - All Rights Reserved
