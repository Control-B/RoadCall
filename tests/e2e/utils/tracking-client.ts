import { ApolloClient, InMemoryCache, gql, split, HttpLink } from '@apollo/client/core';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { getMainDefinition } from '@apollo/client/utilities';
import { createClient } from 'graphql-ws';
import WebSocket from 'ws';

const TRACKING_SUBSCRIPTION = gql`
  subscription OnIncidentTracking($incidentId: ID!) {
    onIncidentTracking(incidentId: $incidentId) {
      sessionId
      incidentId
      status
      vendorLocation {
        lat
        lon
        timestamp
      }
      eta {
        minutes
        distance
        arrivalTime
      }
    }
  }
`;

export class TrackingClient {
  private client: ApolloClient<any>;

  constructor(appsyncUrl: string) {
    const httpLink = new HttpLink({
      uri: appsyncUrl,
    });

    const wsLink = new GraphQLWsLink(
      createClient({
        url: appsyncUrl.replace('https://', 'wss://').replace('http://', 'ws://'),
        webSocketImpl: WebSocket,
      })
    );

    const splitLink = split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return definition.kind === 'OperationDefinition' && definition.operation === 'subscription';
      },
      wsLink,
      httpLink
    );

    this.client = new ApolloClient({
      link: splitLink,
      cache: new InMemoryCache(),
    });
  }

  async subscribeToTracking(incidentId: string, callback: (data: any) => void) {
    const observable = this.client.subscribe({
      query: TRACKING_SUBSCRIPTION,
      variables: { incidentId },
    });

    const subscription = observable.subscribe({
      next: ({ data }) => {
        if (data?.onIncidentTracking) {
          callback(data.onIncidentTracking);
        }
      },
      error: (error) => {
        console.error('Subscription error:', error);
      },
    });

    return subscription;
  }

  async getTrackingSession(sessionId: string) {
    const query = gql`
      query GetTrackingSession($sessionId: ID!) {
        getTrackingSession(sessionId: $sessionId) {
          sessionId
          incidentId
          status
          vendorLocation {
            lat
            lon
            timestamp
          }
          eta {
            minutes
            distance
            arrivalTime
          }
        }
      }
    `;

    const result = await this.client.query({
      query,
      variables: { sessionId },
    });

    return result.data.getTrackingSession;
  }
}
