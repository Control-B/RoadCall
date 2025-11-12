import { Amplify } from 'aws-amplify'

export const configureAmplify = () => {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID!,
        userPoolClientId: process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID!,
        loginWith: {
          oauth: {
            domain: `${process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID}.auth.${process.env.NEXT_PUBLIC_AWS_REGION}.amazoncognito.com`,
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
  region: process.env.NEXT_PUBLIC_AWS_REGION!,
  apiGatewayUrl: process.env.NEXT_PUBLIC_API_GATEWAY_URL!,
  appSyncUrl: process.env.NEXT_PUBLIC_APPSYNC_URL!,
  appSyncApiKey: process.env.NEXT_PUBLIC_APPSYNC_API_KEY!,
  locationMapName: process.env.NEXT_PUBLIC_LOCATION_MAP_NAME!,
}
