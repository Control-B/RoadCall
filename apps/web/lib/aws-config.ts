import { Amplify } from 'aws-amplify'

export const configureAmplify = () => {
  // Only configure if environment variables are present
  if (!process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID || !process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID) {
    console.warn('AWS Cognito not configured. Set NEXT_PUBLIC_COGNITO_USER_POOL_ID and NEXT_PUBLIC_COGNITO_CLIENT_ID environment variables.')
    return
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID,
        loginWith: {
          oauth: {
            domain: `${process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID}.auth.${process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1'}.amazoncognito.com`,
            scopes: ['openid', 'email', 'phone', 'profile'],
            redirectSignIn: [typeof window !== 'undefined' ? window.location.origin : ''],
            redirectSignOut: [typeof window !== 'undefined' ? window.location.origin : ''],
            responseType: 'code',
          },
        },
      },
    },
  })
}

export const awsConfig = {
  region: process.env.NEXT_PUBLIC_AWS_REGION || 'us-east-1',
  apiGatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL || 'http://localhost:3000',
  appSyncUrl: process.env.NEXT_PUBLIC_APPSYNC_URL || '',
  appSyncApiKey: process.env.NEXT_PUBLIC_APPSYNC_API_KEY || '',
  locationMapName: process.env.NEXT_PUBLIC_LOCATION_MAP_NAME || 'roadcall-map',
}
