import { Amplify } from 'aws-amplify';

// AWS Configuration
// These values should be replaced with actual values from your AWS deployment
export const awsConfig = {
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID || '',
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID || '',
      identityPoolId: process.env.EXPO_PUBLIC_IDENTITY_POOL_ID || '',
      loginWith: {
        phone: true,
      },
      signUpVerificationMethod: 'code',
      userAttributes: {
        phone_number: {
          required: true,
        },
      },
      passwordFormat: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireNumbers: true,
        requireSpecialCharacters: true,
      },
    },
  },
  API: {
    REST: {
      RoadcallAPI: {
        endpoint: process.env.EXPO_PUBLIC_API_ENDPOINT || '',
        region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
      },
    },
    GraphQL: {
      endpoint: process.env.EXPO_PUBLIC_APPSYNC_ENDPOINT || '',
      region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
      defaultAuthMode: 'userPool',
    },
  },
  Notifications: {
    Pinpoint: {
      appId: process.env.EXPO_PUBLIC_PINPOINT_APP_ID || '',
      region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
    },
  },
};

export function configureAmplify() {
  Amplify.configure(awsConfig);
}
