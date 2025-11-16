# RoadCall Assist

A React Native mobile app built with Expo for AI-powered roadside assistance. Connects truck drivers with nearby mechanics and tow services via AWS backend integration.

## Overview

RoadCall Assist is an Uber-style roadside support application designed for truck drivers. When drivers experience a breakdown, the app sends a request to an AWS backend (Amazon Connect + Bedrock + Q in Connect) which matches them with the nearest qualified mechanic or tow truck.

This is the **frontend-only** implementation that communicates with AWS backend services via REST APIs and WebSocket connections.

## Tech Stack

- **Framework**: Expo + React Native
- **Language**: TypeScript
- **Navigation**: React Navigation (Stack + Tabs)
- **HTTP Client**: Axios
- **State Management**: Zustand
- **Maps**: react-native-maps
- **Location**: expo-location
- **Images**: expo-image-picker
- **Secure Storage**: expo-secure-store

## Features

### Authentication
- Email/phone + password login
- Driver registration with truck details
- Secure token storage
- Auto-login on app launch

### Roadside Request Flow
1. Describe problem (Tire, Engine, Battery, Fuel, Tow, Brakes, Other)
2. Auto-capture GPS location or manual address entry
3. Add notes and photos (up to 3)
4. Submit request
5. Real-time mechanic matching
6. Live tracking with ETA
7. Direct communication (call/chat)

### Main Features
- **Home**: Quick access to request help, view active requests
- **History**: Past service requests with details
- **Profile**: Driver info, settings, logout
- **Active Job Tracking**: Live map with driver + mechanic pins, status timeline

## Project Structure

```
src/
├── api/              # API client (Axios instance)
│   └── roadcallApi.ts
├── components/       # Reusable UI components
│   ├── Button.tsx
│   ├── Card.tsx
│   ├── Chip.tsx
│   ├── Input.tsx
│   └── StatusBadge.tsx
├── hooks/           # Custom React hooks
│   ├── useActiveRequest.ts
│   ├── useJobUpdates.ts
│   └── useLocation.ts
├── navigation/      # Navigation structure
│   ├── AuthNavigator.tsx
│   └── MainNavigator.tsx
├── screens/         # App screens
│   ├── auth/       # Authentication screens
│   │   ├── LoginScreen.tsx
│   │   ├── RegisterScreen.tsx
│   │   └── SplashScreen.tsx
│   ├── main/       # Main tab screens
│   │   ├── HomeScreen.tsx
│   │   ├── HistoryScreen.tsx
│   │   └── ProfileScreen.tsx
│   └── request/    # Request flow screens
│       ├── ActiveJobScreen.tsx
│       ├── NewRequestScreen.tsx
│       ├── RequestDetailScreen.tsx
│       └── SearchingScreen.tsx
├── store/          # Zustand state stores
│   ├── authStore.ts
│   └── requestStore.ts
├── types/          # TypeScript type definitions
│   └── index.ts
└── utils/          # Utility functions
```

## Installation

### Prerequisites
- Node.js 18+ and npm
- Expo CLI: `npm install -g expo-cli`
- iOS Simulator (macOS) or Android Emulator

### Setup

1. **Install dependencies**:
```bash
npm install
```

2. **Configure environment variables**:
Copy `.env.example` to `.env` and update:
```bash
cp .env.example .env
```

Edit `.env`:
```
EXPO_PUBLIC_API_BASE_URL=https://your-api-gateway-url.amazonaws.com
```

3. **Run the app**:
```bash
npm run dev
```

Then:
- Press `i` for iOS simulator
- Press `a` for Android emulator
- Scan QR code with Expo Go app for physical device

## AWS Backend Integration

### API Endpoints

The app expects the following REST endpoints to be available:

#### Authentication
```
POST /auth/login
Body: { identifier: string, password: string }
Response: { accessToken: string, refreshToken: string, user: User }

POST /auth/register
Body: { name, phone, email?, truckingCompany, truckNumber, truckType, password }
Response: { accessToken: string, refreshToken: string, user: User }

GET /me
Headers: { Authorization: "Bearer <token>" }
Response: User
```

#### Requests
```
POST /requests
Body: { location, problemType, hasTrailer, notes, photos?, truckType, truckNumber }
Response: BreakdownRequest

GET /requests/active
Response: BreakdownRequest | null

GET /requests/:id
Response: BreakdownRequest

GET /requests/history
Response: BreakdownRequest[]

POST /requests/:id/cancel
Response: BreakdownRequest
```

### Request Status Flow

```
REQUESTED → SEARCHING → ACCEPTED → EN_ROUTE → ON_SITE → COMPLETED
                                                     ↓
                                                 CANCELED
```

### WebSocket Integration (Optional)

For real-time updates, integrate WebSocket connections in `src/hooks/useJobUpdates.ts`:

```typescript
// Example AppSync subscription or WebSocket connection
const ws = new WebSocket(`wss://your-websocket-url.amazonaws.com?requestId=${requestId}`);
ws.onmessage = (event) => {
  const update = JSON.parse(event.data);
  updateRequestStatus(update);
};
```

### AWS Services Architecture

Backend should use:
- **Amazon Connect** + **Q in Connect**: Handle calls/chat
- **Amazon Bedrock**: AI-powered decisioning
- **API Gateway** + **Lambda**: REST endpoints
- **Amazon Cognito**: Authentication (optional - or custom JWT)
- **DynamoDB** or **RDS**: Data persistence
- **AppSync** or **WebSocket API**: Real-time updates (optional)

## Configuration

### Changing API Base URL

Update `EXPO_PUBLIC_API_BASE_URL` in `.env`:
```
EXPO_PUBLIC_API_BASE_URL=https://your-new-api-url.com
```

### Authentication Method

To switch between phone/OTP and email/password:
- Update `LoginScreen.tsx` UI fields
- Modify `LoginPayload` in `src/types/index.ts`
- Update backend `/auth/login` endpoint accordingly

## Error Handling

The app includes:
- Network error detection with retry
- Token expiration handling (auto-logout)
- Location permission handling
- Offline mode indicators
- User-friendly error messages

## Testing

The app is ready for testing with:
1. Mock API responses (use tools like `json-server` or `mockoon`)
2. Real AWS backend endpoints
3. Manual testing on physical devices
4. End-to-end testing with AWS integration

## Deployment

### EAS Build (Recommended)

```bash
npm install -g eas-cli
eas login
eas build --platform ios
eas build --platform android
```

### Publishing Updates
```bash
eas update --auto
```

## Known Limitations

- No real-time chat implementation (placeholder UI only)
- Photo upload uses local URIs (backend should handle base64 or multipart uploads)
- WebSocket integration is stubbed (needs implementation)
- Map clustering not implemented for multiple mechanics
- No offline request queueing

## Future Enhancements

- Real-time chat with mechanics
- In-app payment processing
- Driver ratings and reviews
- Push notifications
- Offline mode with request queueing
- Multi-language support
- Mechanic/tow truck app (separate)

## Support

For issues or questions:
1. Check backend API endpoint connectivity
2. Verify environment variables are set correctly
3. Check console logs for detailed error messages
4. Ensure location permissions are granted

## License

MIT
