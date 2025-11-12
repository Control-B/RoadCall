# Roadcall Mobile App

React Native mobile application for the AI Roadcall Assistant platform, built with Expo.

## Features

### Driver Features
- **SOS Button**: Quick incident creation for tire, engine, or towing emergencies
- **Real-time Tracking**: Track assigned vendor location and ETA on map
- **Incident History**: View past and active incidents
- **Push Notifications**: Receive updates on vendor assignment and arrival
- **Profile Management**: Manage driver profile and preferences

### Vendor Features
- **Job Offers**: Receive and manage incoming job offers with countdown timers
- **Accept/Decline**: Quick actions to accept or decline offers
- **Navigation**: Real-time navigation to incident location with background location tracking
- **Status Updates**: Update job status (en route, arrived, work in progress, completed)
- **Availability Toggle**: Control availability for receiving new offers
- **Job History**: View past accepted, declined, and expired offers

## Tech Stack

- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **State Management**: Zustand with AsyncStorage persistence
- **Authentication**: AWS Amplify with Cognito
- **API**: AWS Amplify REST API client
- **Real-time**: AWS AppSync GraphQL subscriptions
- **Maps**: React Native Maps with MapLibre
- **Notifications**: Expo Notifications with AWS Pinpoint
- **Location**: Expo Location with background tracking
- **TypeScript**: Full type safety

## Prerequisites

- Node.js 18+
- pnpm
- Expo CLI
- iOS Simulator (Mac) or Android Emulator
- AWS account with configured services

## Setup

1. **Install dependencies**:
   ```bash
   cd apps/mobile
   pnpm install
   ```

2. **Configure environment variables**:
   ```bash
   cp .env.example .env
   ```
   
   Update `.env` with your AWS configuration:
   - Cognito User Pool ID and Client ID
   - API Gateway endpoint
   - AppSync endpoint
   - Pinpoint App ID

3. **Start the development server**:
   ```bash
   pnpm start
   ```

4. **Run on device/simulator**:
   - iOS: Press `i` or run `pnpm ios`
   - Android: Press `a` or run `pnpm android`
   - Web: Press `w` or run `pnpm web`

## Project Structure

```
apps/mobile/
├── app/                      # Expo Router app directory
│   ├── (auth)/              # Authentication screens
│   │   ├── welcome.tsx      # Landing page
│   │   ├── register.tsx     # Registration
│   │   └── verify-otp.tsx   # OTP verification
│   ├── (driver)/            # Driver screens
│   │   ├── home.tsx         # SOS button and active incident
│   │   ├── tracking.tsx     # Real-time vendor tracking
│   │   ├── incidents.tsx    # Incident history
│   │   └── profile.tsx      # Driver profile
│   ├── (vendor)/            # Vendor screens
│   │   ├── home.tsx         # Job offers
│   │   ├── active.tsx       # Active job with navigation
│   │   ├── history.tsx      # Job history
│   │   └── profile.tsx      # Vendor profile
│   ├── _layout.tsx          # Root layout
│   └── index.tsx            # Entry point
├── src/
│   ├── config/              # Configuration
│   │   ├── aws-config.ts    # AWS Amplify config
│   │   └── appsync-client.ts # AppSync GraphQL client
│   ├── services/            # Service layer
│   │   ├── api.ts           # REST API calls
│   │   ├── auth.ts          # Authentication
│   │   ├── location.ts      # Location tracking
│   │   └── notifications.ts # Push notifications
│   ├── store/               # State management
│   │   ├── auth-store.ts    # Auth state
│   │   ├── incident-store.ts # Incident state
│   │   └── vendor-store.ts  # Vendor state
│   └── types/               # TypeScript types
│       └── index.ts
├── assets/                  # Images and fonts
├── app.json                 # Expo configuration
├── package.json
└── tsconfig.json
```

## Key Features Implementation

### Authentication
- Phone-based registration with OTP verification
- AWS Cognito integration
- Persistent auth state with AsyncStorage
- Role-based routing (driver/vendor)

### Real-time Tracking
- AppSync GraphQL subscriptions for live updates
- Background location tracking for vendors
- ETA calculation and display
- Map visualization with markers and routes

### Push Notifications
- Expo Notifications integration
- AWS Pinpoint for delivery
- Notification channels (offers, tracking, updates)
- Badge count management
- Deep linking support

### Offline Support
- Local state persistence with Zustand
- AsyncStorage for offline data
- Automatic sync on reconnection

### Background Location
- Expo Task Manager for background tasks
- Foreground service notification
- 10-second update interval
- Automatic location updates to AppSync

## Environment Variables

Required environment variables (see `.env.example`):

- `EXPO_PUBLIC_AWS_REGION`: AWS region
- `EXPO_PUBLIC_USER_POOL_ID`: Cognito User Pool ID
- `EXPO_PUBLIC_USER_POOL_CLIENT_ID`: Cognito Client ID
- `EXPO_PUBLIC_IDENTITY_POOL_ID`: Cognito Identity Pool ID
- `EXPO_PUBLIC_API_ENDPOINT`: API Gateway endpoint
- `EXPO_PUBLIC_APPSYNC_ENDPOINT`: AppSync GraphQL endpoint
- `EXPO_PUBLIC_PINPOINT_APP_ID`: Pinpoint Application ID

## Building for Production

### iOS

1. Configure app signing in Xcode
2. Build:
   ```bash
   eas build --platform ios
   ```

### Android

1. Configure signing credentials
2. Build:
   ```bash
   eas build --platform android
   ```

## Testing

Run type checking:
```bash
pnpm typecheck
```

Run linting:
```bash
pnpm lint
```

## Permissions

### iOS
- Location (Always and When In Use)
- Notifications
- Background Modes (location, fetch, remote-notification)

### Android
- ACCESS_FINE_LOCATION
- ACCESS_COARSE_LOCATION
- ACCESS_BACKGROUND_LOCATION
- FOREGROUND_SERVICE
- FOREGROUND_SERVICE_LOCATION

## Requirements Mapping

This implementation addresses the following requirements:

- **Requirement 2.2**: Incident creation via mobile app with GPS coordinates
- **Requirement 5.1**: Vendor offer acceptance/decline with notifications
- **Requirement 6.1**: Real-time location tracking sessions
- **Requirement 23.3**: Mobile app real-time synchronization with GraphQL subscriptions

## Notes

- Background location tracking requires user permission
- Push notifications require physical device (not simulator)
- AppSync subscriptions require active network connection
- Location updates are batched every 10 seconds to conserve battery
