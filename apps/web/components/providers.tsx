'use client'

import { useEffect } from 'react'
import { ApolloProvider } from '@apollo/client'
import { configureAmplify, awsConfig } from '@/lib/aws-config'
import { apolloClient } from '@/lib/graphql-client'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Only configure Amplify if environment variables are set
    if (process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID) {
      configureAmplify()
    }
  }, [])

  // Only use Apollo Provider if AppSync is configured
  if (awsConfig.appSyncUrl) {
    return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
  }

  // Return children without Apollo Provider if not configured
  return <>{children}</>
}
