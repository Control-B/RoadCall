'use client'

import { useEffect } from 'react'
import { ApolloProvider } from '@apollo/client'
import { configureAmplify } from '@/lib/aws-config'
import { apolloClient } from '@/lib/graphql-client'

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    configureAmplify()
  }, [])

  return <ApolloProvider client={apolloClient}>{children}</ApolloProvider>
}
