import { ApolloClient, InMemoryCache, HttpLink, split } from '@apollo/client'
import { GraphQLWsLink } from '@apollo/client/link/subscriptions'
import { getMainDefinition } from '@apollo/client/utilities'
import { createClient } from 'graphql-ws'
import { awsConfig } from './aws-config'

const httpLink = new HttpLink({
  uri: awsConfig.appSyncUrl,
  headers: {
    'x-api-key': awsConfig.appSyncApiKey,
  },
})

const wsLink = typeof window !== 'undefined' ? new GraphQLWsLink(
  createClient({
    url: awsConfig.appSyncUrl.replace('https://', 'wss://').replace('/graphql', '/realtime'),
    connectionParams: {
      headers: {
        'x-api-key': awsConfig.appSyncApiKey,
      },
    },
  })
) : null

const splitLink = typeof window !== 'undefined' && wsLink
  ? split(
      ({ query }) => {
        const definition = getMainDefinition(query)
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        )
      },
      wsLink,
      httpLink
    )
  : httpLink

export const apolloClient = new ApolloClient({
  link: splitLink,
  cache: new InMemoryCache(),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
})
