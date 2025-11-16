# Microservice Separation Plan

## Current State
All frontends are bundled together in `apps/web`:
- Landing page
- Admin dashboard
- Dispatcher dashboard  
- Driver dashboard
- Vendor dashboard
- PWA functionality

Mobile app is separate but uses Supabase instead of AWS backend.

## Target Architecture

### Frontend Applications (apps/)
```
apps/
├── landing/          # Public landing page (Next.js)
├── admin-dashboard/  # Admin portal (Next.js)
├── dispatcher-dashboard/ # Dispatcher portal (Next.js)
├── driver-dashboard/ # Driver portal (Next.js)
├── vendor-dashboard/ # Vendor portal (Next.js)
├── mobile/          # React Native/Expo app
└── pwa/             # Progressive Web App (Next.js)
```

### Backend Services (services/)
```
services/
├── auth-svc/                    # Authentication & Authorization
├── driver-svc/                  # Driver management
├── vendor-svc/                  # Vendor management
├── incident-svc/                # Incident/request management
├── match-svc/                   # Matching algorithm
├── tracking-svc/                # Real-time tracking
├── notifications-svc/           # Push/SMS/Email notifications
├── payments-svc/                # Payment processing
├── telephony-svc/               # Amazon Connect integration
├── kb-svc/                      # Knowledge base (Bedrock)
├── reporting-svc/               # Analytics & reporting
├── compliance-svc/              # Compliance & audit
├── admin-config-svc/            # Admin configuration
└── vendor-data-pipeline-svc/   # Vendor data pipeline
```

### Shared Packages (packages/)
```
packages/
├── types/           # Shared TypeScript types
├── utils/           # Shared utilities
├── events/          # Event definitions
└── aws-clients/     # AWS SDK clients
```

## Separation Strategy

### Phase 1: Split Frontend Apps
1. Create separate Next.js apps for each dashboard
2. Extract shared components to packages
3. Each app has its own:
   - Dependencies
   - Build pipeline
   - Deployment target
   - Environment variables

### Phase 2: Ensure Backend Independence
1. Each service has its own:
   - Database/DynamoDB tables
   - API Gateway endpoints
   - Lambda functions
   - IAM roles
2. Services communicate via:
   - EventBridge (async)
   - API Gateway (sync)
   - SQS (queuing)

### Phase 3: Shared Package Management
1. Create shared packages for:
   - Common UI components
   - API client libraries
   - Type definitions
   - Utilities
2. Use workspace protocol for internal dependencies

## Benefits

### Isolation
- Changes in one app don't affect others
- Independent deployment cycles
- Separate build/test pipelines

### Scalability
- Scale each service independently
- Different resource allocation per service
- Optimize for specific use cases

### Team Organization
- Teams can own specific apps/services
- Clear boundaries and responsibilities
- Parallel development

### Performance
- Smaller bundle sizes per app
- Faster build times
- Better caching

## Implementation Steps

1. ✅ Mobile app already separated
2. ⏳ Split web app into separate applications
3. ⏳ Create shared component packages
4. ⏳ Update turbo.json for new structure
5. ⏳ Update CI/CD pipelines
6. ⏳ Migrate mobile app to AWS backend (remove Supabase)
7. ⏳ Update infrastructure for separate deployments
