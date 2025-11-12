# AI Roadcall Assistant - Web Application

Next.js web application for the AI Roadcall Assistant platform, providing dashboards for drivers, vendors, dispatchers, and administrators.

## Features

### Driver Dashboard
- Create new roadside assistance incidents
- Track incident status in real-time
- View assigned vendor location and ETA
- Monitor incident timeline

### Vendor Dashboard
- Receive and manage job offers
- Accept/decline offers within time window
- View active jobs and navigation
- Track earnings and performance metrics

### Dispatcher Dashboard
- Monitor all active incidents in real-time
- View live map with incident locations
- Manage incident assignments
- Access driver and vendor information

### Admin Dashboard
- System overview and KPIs
- Configure matching algorithm weights
- Manage SLA tiers and pricing
- Monitor system health

## Technology Stack

- **Framework**: Next.js 14 with App Router
- **UI**: Tailwind CSS + shadcn/ui components
- **Authentication**: AWS Cognito with Amplify
- **API**: REST API via API Gateway
- **Real-time**: GraphQL subscriptions via AppSync
- **Maps**: MapLibre GL JS with AWS Location Service
- **State Management**: React hooks + Apollo Client

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm
- AWS account with configured services

### Environment Variables

Copy `.env.example` to `.env.local` and configure:

```bash
NEXT_PUBLIC_AWS_REGION=us-east-1
NEXT_PUBLIC_COGNITO_USER_POOL_ID=your-user-pool-id
NEXT_PUBLIC_COGNITO_CLIENT_ID=your-client-id
NEXT_PUBLIC_API_GATEWAY_URL=https://your-api.execute-api.us-east-1.amazonaws.com
NEXT_PUBLIC_APPSYNC_URL=https://your-appsync-api.appsync-api.us-east-1.amazonaws.com/graphql
NEXT_PUBLIC_APPSYNC_API_KEY=your-api-key
NEXT_PUBLIC_LOCATION_MAP_NAME=your-map-name
```

### Installation

```bash
# Install dependencies
pnpm install

# Run development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

## Project Structure

```
apps/web/
├── app/                    # Next.js app directory
│   ├── auth/              # Authentication pages
│   ├── driver/            # Driver dashboard
│   ├── vendor/            # Vendor dashboard
│   ├── dispatcher/        # Dispatcher dashboard
│   ├── admin/             # Admin dashboard
│   ├── layout.tsx         # Root layout
│   └── page.tsx           # Home page
├── components/            # React components
│   ├── ui/               # shadcn/ui components
│   ├── map/              # Map components
│   └── providers.tsx     # Context providers
├── lib/                   # Utility functions
│   ├── api-client.ts     # REST API client
│   ├── graphql-client.ts # GraphQL/Apollo client
│   ├── aws-config.ts     # AWS configuration
│   └── utils.ts          # Helper functions
├── types/                 # TypeScript types
└── public/               # Static assets
```

## Key Features Implementation

### Authentication Flow
- Cognito Hosted UI integration
- JWT token management
- Role-based routing
- Automatic session refresh

### Real-time Tracking
- GraphQL subscriptions for live updates
- MapLibre GL JS for map visualization
- AWS Location Service integration
- ETA calculations and route display

### Incident Management
- Create incidents with geolocation
- Real-time status updates
- Timeline visualization
- Media upload support

### Vendor Matching
- Live offer notifications
- Countdown timers for acceptance
- Match score display
- Automatic offer expiration

### Admin Configuration
- Dynamic matching weight adjustment
- SLA tier management
- System health monitoring
- KPI dashboards

## API Integration

### REST API (API Gateway)
- Incident CRUD operations
- Offer management
- User profile management
- Configuration updates

### GraphQL API (AppSync)
- Real-time tracking subscriptions
- Live incident updates
- Vendor location streaming

## Deployment

### Vercel (Recommended)
```bash
vercel --prod
```

### AWS Amplify
```bash
amplify publish
```

### Docker
```bash
docker build -t roadcall-web .
docker run -p 3000:3000 roadcall-web
```

## Development

### Code Style
- ESLint for linting
- Prettier for formatting
- TypeScript strict mode

### Testing
```bash
# Run tests
pnpm test

# Run E2E tests
pnpm test:e2e
```

## Performance Optimization

- Server-side rendering for initial load
- Image optimization with Next.js Image
- Code splitting and lazy loading
- API response caching
- MapLibre GL JS performance tuning

## Security

- JWT token validation
- HTTPS only
- CORS configuration
- XSS protection
- CSRF tokens
- Input sanitization

## Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## License

Proprietary - AI Roadcall Assistant Platform
