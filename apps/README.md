# RoadCall Applications

This directory contains all frontend applications in the RoadCall monorepo.

## Applications

### Landing Page (`landing/`)
- **Port**: 3000
- **Purpose**: Public-facing marketing website
- **Users**: Potential customers
- **Features**: Product info, pricing, sign-up

### Admin Dashboard (`admin-dashboard/`)
- **Port**: 3001
- **Purpose**: System administration and configuration
- **Users**: RoadCall administrators
- **Features**: User management, system config, analytics

### Dispatcher Dashboard (`dispatcher-dashboard/`)
- **Port**: 3002
- **Purpose**: Call center and dispatch operations
- **Users**: Dispatchers, call center agents
- **Features**: Incident management, vendor assignment, real-time tracking

### Driver Dashboard (`driver-dashboard/`)
- **Port**: 3003
- **Purpose**: Driver interface for managing requests
- **Users**: Drivers needing assistance
- **Features**: Request help, track service, payment, history

### Vendor Dashboard (`vendor-dashboard/`)
- **Port**: 3004
- **Purpose**: Service provider interface
- **Users**: Tow truck operators, mechanics, etc.
- **Features**: Accept jobs, navigation, status updates, earnings

### PWA (`pwa/`)
- **Port**: 3005
- **Purpose**: Progressive Web App for mobile browsers
- **Users**: Mobile users without native app
- **Features**: Lightweight driver/vendor experience

### Mobile App (`mobile/`)
- **Port**: 8081 (Expo Metro)
- **Purpose**: Native mobile application
- **Platform**: iOS & Android (React Native/Expo)
- **Users**: Drivers and vendors on mobile devices
- **Features**: Full native experience with offline support

## Architecture Principles

### Isolation
- Each app is completely independent
- No shared runtime dependencies between apps
- Changes in one app don't affect others

### Shared Packages
Apps can use shared packages from `packages/`:
- `@roadcall/types` - TypeScript type definitions
- `@roadcall/ui-components` - Reusable UI components
- `@roadcall/api-client` - API client utilities
- `@roadcall/utils` - Common utilities
- `@roadcall/events` - Event definitions

### Backend Communication
All apps communicate with backend services via:
- **AWS AppSync** - GraphQL API
- **AWS API Gateway** - REST APIs
- **AWS Cognito** - Authentication
- **AWS Amplify** - Client SDK

### Development

Run all apps:
```bash
pnpm dev
```

Run specific app:
```bash
cd apps/landing && pnpm dev
cd apps/admin-dashboard && pnpm dev
cd apps/mobile && pnpm dev
```

### Deployment

Each app deploys independently:
- **Landing**: CloudFront + S3
- **Dashboards**: CloudFront + S3
- **PWA**: CloudFront + S3
- **Mobile**: Expo EAS / App Stores

### Port Allocation
- 3000: Landing page
- 3001: Admin dashboard
- 3002: Dispatcher dashboard
- 3003: Driver dashboard
- 3004: Vendor dashboard
- 3005: PWA
- 8081: Mobile (Expo Metro)
