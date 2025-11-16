# Mobile App AWS Migration Guide

## Current State
- Mobile app uses custom REST API client (axios)
- API endpoint: `https://api.roadcall-assist.com`
- Auth stored in Zustand store
- No Supabase dependency found (good!)

## Target State
- Use AWS Amplify for mobile
- AWS Cognito for authentication
- AWS AppSync (GraphQL) for data
- AWS API Gateway (REST) as fallback
- Real-time updates via AppSync subscriptions

## Migration Steps

### 1. Install AWS Amplify
```bash
cd apps/mobile
pnpm add aws-amplify @aws-amplify/react-native amazon-cognito-identity-js @react-native-community/netinfo
```

### 2. Configure Amplify
Create `apps/mobile/src/aws-config.ts`:
```typescript
import { Amplify } from 'aws-amplify';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID!,
      identityPoolId: process.env.EXPO_PUBLIC_IDENTITY_POOL_ID!,
      region: process.env.EXPO_PUBLIC_AWS_REGION!,
    }
  },
  API: {
    GraphQL: {
      endpoint: process.env.EXPO_PUBLIC_APPSYNC_ENDPOINT!,
      region: process.env.EXPO_PUBLIC_AWS_REGION!,
      defaultAuthMode: 'userPool'
    },
    REST: {
      RoadCallAPI: {
        endpoint: process.env.EXPO_PUBLIC_API_GATEWAY_ENDPOINT!,
        region: process.env.EXPO_PUBLIC_AWS_REGION!
      }
    }
  }
});
```

### 3. Update Auth Store
Replace custom auth with AWS Cognito:
```typescript
import { signIn, signUp, signOut, getCurrentUser } from 'aws-amplify/auth';
```

### 4. Update API Client
Use AppSync for GraphQL or API Gateway for REST

### 5. Environment Variables
Add to `.env`:
```
EXPO_PUBLIC_AWS_REGION=us-east-1
EXPO_PUBLIC_USER_POOL_ID=us-east-1_xxxxx
EXPO_PUBLIC_USER_POOL_CLIENT_ID=xxxxx
EXPO_PUBLIC_IDENTITY_POOL_ID=us-east-1:xxxxx
EXPO_PUBLIC_APPSYNC_ENDPOINT=https://xxxxx.appsync-api.us-east-1.amazonaws.com/graphql
EXPO_PUBLIC_API_GATEWAY_ENDPOINT=https://xxxxx.execute-api.us-east-1.amazonaws.com/prod
```

## Benefits
- Unified auth across web and mobile
- Real-time updates via subscriptions
- Offline support with DataStore
- Better security with Cognito
- Consistent API across platforms
