import { AWSAppSyncClient, AUTH_TYPE } from 'aws-appsync';
import { fetchAuthSession } from 'aws-amplify/auth';

const client = new AWSAppSyncClient({
  url: process.env.EXPO_PUBLIC_APPSYNC_ENDPOINT || '',
  region: process.env.EXPO_PUBLIC_AWS_REGION || 'us-east-1',
  auth: {
    type: AUTH_TYPE.AMAZON_COGNITO_USER_POOLS,
    jwtToken: async () => {
      const session = await fetchAuthSession();
      return session.tokens?.idToken?.toString() || '';
    },
  },
  disableOffline: false,
});

export default client;

// GraphQL Queries and Mutations
export const GET_TRACKING_SESSION = `
  query GetTrackingSession($sessionId: ID!) {
    getTrackingSession(sessionId: $sessionId) {
      sessionId
      incidentId
      driverId
      vendorId
      status
      driverLocation {
        lat
        lon
        timestamp
      }
      vendorLocation {
        lat
        lon
        timestamp
      }
      vendorRoute {
        lat
        lon
        timestamp
      }
      eta {
        minutes
        distance
        arrivalTime
        confidence
      }
      createdAt
      updatedAt
    }
  }
`;

export const START_TRACKING = `
  mutation StartTracking($incidentId: ID!) {
    startTracking(incidentId: $incidentId) {
      sessionId
      incidentId
      status
    }
  }
`;

export const UPDATE_VENDOR_LOCATION = `
  mutation UpdateVendorLocation($sessionId: ID!, $location: LocationInput!) {
    updateVendorLocation(sessionId: $sessionId, location: $location) {
      sessionId
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

export const STOP_TRACKING = `
  mutation StopTracking($sessionId: ID!) {
    stopTracking(sessionId: $sessionId) {
      sessionId
      status
    }
  }
`;

// Subscriptions
export const ON_TRACKING_UPDATE = `
  subscription OnTrackingUpdate($sessionId: ID!) {
    onTrackingUpdate(sessionId: $sessionId) {
      sessionId
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
      updatedAt
    }
  }
`;

export const ON_INCIDENT_TRACKING = `
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
