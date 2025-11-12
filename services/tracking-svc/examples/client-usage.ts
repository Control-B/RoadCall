/**
 * Example usage of the Tracking Service GraphQL API
 * 
 * This file demonstrates how to interact with the tracking service
 * from a client application (web or mobile).
 */

import { AWSAppSyncClient } from 'aws-appsync';
import gql from 'graphql-tag';

// Initialize AppSync client
const client = new AWSAppSyncClient({
  url: process.env.APPSYNC_API_URL!,
  region: process.env.AWS_REGION || 'us-east-1',
  auth: {
    type: 'API_KEY',
    apiKey: process.env.APPSYNC_API_KEY!,
  },
  disableOffline: true,
});

// ============================================================================
// Mutations
// ============================================================================

/**
 * Start tracking for an incident
 */
async function startTracking(incidentId: string) {
  const mutation = gql`
    mutation StartTracking($incidentId: ID!) {
      startTracking(incidentId: $incidentId) {
        sessionId
        incidentId
        status
        driverLocation {
          lat
          lon
        }
        vendorLocation {
          lat
          lon
        }
        eta {
          minutes
          distanceMiles
          arrivalTime
          confidence
        }
        createdAt
      }
    }
  `;

  const result = await client.mutate({
    mutation,
    variables: { incidentId },
  });

  return result.data.startTracking;
}

/**
 * Update vendor location
 */
async function updateVendorLocation(
  sessionId: string,
  lat: number,
  lon: number,
  accuracy?: number,
  speed?: number,
  heading?: number
) {
  const mutation = gql`
    mutation UpdateVendorLocation($sessionId: ID!, $location: LocationInput!) {
      updateVendorLocation(sessionId: $sessionId, location: $location) {
        sessionId
        status
        vendorLocation {
          lat
          lon
          timestamp
          accuracy
          speed
          heading
        }
        eta {
          minutes
          distanceMiles
          arrivalTime
          confidence
          calculatedAt
        }
        updatedAt
      }
    }
  `;

  const result = await client.mutate({
    mutation,
    variables: {
      sessionId,
      location: {
        lat,
        lon,
        timestamp: new Date().toISOString(),
        accuracy,
        speed,
        heading,
      },
    },
  });

  return result.data.updateVendorLocation;
}

/**
 * Stop tracking
 */
async function stopTracking(sessionId: string) {
  const mutation = gql`
    mutation StopTracking($sessionId: ID!) {
      stopTracking(sessionId: $sessionId) {
        sessionId
        status
        updatedAt
      }
    }
  `;

  const result = await client.mutate({
    mutation,
    variables: { sessionId },
  });

  return result.data.stopTracking;
}

// ============================================================================
// Queries
// ============================================================================

/**
 * Get tracking session by ID
 */
async function getTrackingSession(sessionId: string) {
  const query = gql`
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
        }
        vendorLocation {
          lat
          lon
          timestamp
        }
        vendorPath {
          lat
          lon
          timestamp
        }
        eta {
          minutes
          distanceMiles
          arrivalTime
          confidence
        }
        createdAt
        updatedAt
      }
    }
  `;

  const result = await client.query({
    query,
    variables: { sessionId },
    fetchPolicy: 'network-only', // Bypass cache for real-time data
  });

  return result.data.getTrackingSession;
}

/**
 * Get active tracking session for an incident
 */
async function getActiveSessionByIncident(incidentId: string) {
  const query = gql`
    query GetActiveSessionByIncident($incidentId: ID!) {
      getActiveSessionByIncident(incidentId: $incidentId) {
        sessionId
        status
        vendorLocation {
          lat
          lon
          timestamp
        }
        eta {
          minutes
          distanceMiles
          arrivalTime
        }
      }
    }
  `;

  const result = await client.query({
    query,
    variables: { incidentId },
    fetchPolicy: 'network-only',
  });

  return result.data.getActiveSessionByIncident;
}

// ============================================================================
// Subscriptions
// ============================================================================

/**
 * Subscribe to tracking updates for a specific session
 */
function subscribeToTrackingUpdates(sessionId: string, callback: (data: any) => void) {
  const subscription = gql`
    subscription OnTrackingUpdate($sessionId: ID!) {
      onTrackingUpdate(sessionId: $sessionId) {
        sessionId
        status
        vendorLocation {
          lat
          lon
          timestamp
        }
        eta {
          minutes
          distanceMiles
          arrivalTime
        }
        updatedAt
      }
    }
  `;

  const observable = client.subscribe({
    query: subscription,
    variables: { sessionId },
  });

  const subscriber = observable.subscribe({
    next: (result) => {
      callback(result.data.onTrackingUpdate);
    },
    error: (error) => {
      console.error('Subscription error:', error);
    },
  });

  // Return unsubscribe function
  return () => subscriber.unsubscribe();
}

/**
 * Subscribe to all tracking updates for an incident
 */
function subscribeToIncidentTracking(incidentId: string, callback: (data: any) => void) {
  const subscription = gql`
    subscription OnIncidentTracking($incidentId: ID!) {
      onIncidentTracking(incidentId: $incidentId) {
        sessionId
        status
        vendorLocation {
          lat
          lon
          timestamp
        }
        eta {
          minutes
          distanceMiles
          arrivalTime
        }
        updatedAt
      }
    }
  `;

  const observable = client.subscribe({
    query: subscription,
    variables: { incidentId },
  });

  const subscriber = observable.subscribe({
    next: (result) => {
      callback(result.data.onIncidentTracking);
    },
    error: (error) => {
      console.error('Subscription error:', error);
    },
  });

  return () => subscriber.unsubscribe();
}

// ============================================================================
// Example Usage Scenarios
// ============================================================================

/**
 * Driver tracking vendor scenario
 */
async function driverTrackingScenario(incidentId: string) {
  console.log('Driver: Checking for active tracking session...');
  
  // Check if there's an active session
  const activeSession = await getActiveSessionByIncident(incidentId);
  
  if (!activeSession) {
    console.log('No active tracking session found');
    return;
  }

  console.log(`Found active session: ${activeSession.sessionId}`);
  console.log(`Vendor ETA: ${activeSession.eta.minutes} minutes`);

  // Subscribe to real-time updates
  const unsubscribe = subscribeToIncidentTracking(incidentId, (update) => {
    console.log('Tracking update received:');
    console.log(`  Status: ${update.status}`);
    console.log(`  Vendor location: ${update.vendorLocation.lat}, ${update.vendorLocation.lon}`);
    console.log(`  ETA: ${update.eta.minutes} minutes`);

    if (update.status === 'ARRIVED') {
      console.log('Vendor has arrived!');
      unsubscribe();
    }
  });

  // Keep subscription active
  return unsubscribe;
}

/**
 * Vendor updating location scenario
 */
async function vendorLocationUpdateScenario(sessionId: string) {
  console.log('Vendor: Starting location updates...');

  // Simulate location updates every 10 seconds
  const interval = setInterval(async () => {
    // In a real app, this would come from GPS
    const mockLocation = {
      lat: 40.7128 + Math.random() * 0.01,
      lon: -74.0060 + Math.random() * 0.01,
      accuracy: 10.5,
      speed: 45.0,
      heading: 180.0,
    };

    try {
      const result = await updateVendorLocation(
        sessionId,
        mockLocation.lat,
        mockLocation.lon,
        mockLocation.accuracy,
        mockLocation.speed,
        mockLocation.heading
      );

      console.log(`Location updated. ETA: ${result.eta.minutes} minutes`);

      if (result.status === 'ARRIVED') {
        console.log('Arrived at destination!');
        clearInterval(interval);
      }
    } catch (error) {
      console.error('Failed to update location:', error);
    }
  }, 10000); // Every 10 seconds

  return () => clearInterval(interval);
}

/**
 * Complete tracking flow
 */
async function completeTrackingFlow(incidentId: string) {
  try {
    // 1. Start tracking
    console.log('Starting tracking session...');
    const session = await startTracking(incidentId);
    console.log(`Session started: ${session.sessionId}`);

    // 2. Subscribe to updates (driver side)
    const unsubscribe = subscribeToIncidentTracking(incidentId, (update) => {
      console.log(`[Driver] Vendor is ${update.eta.minutes} minutes away`);
    });

    // 3. Simulate vendor location updates
    const stopUpdates = await vendorLocationUpdateScenario(session.sessionId);

    // 4. Wait for arrival (in real app, this would be event-driven)
    setTimeout(async () => {
      // 5. Stop tracking
      await stopTracking(session.sessionId);
      console.log('Tracking stopped');

      // Cleanup
      unsubscribe();
      stopUpdates();
    }, 60000); // Stop after 1 minute for demo
  } catch (error) {
    console.error('Error in tracking flow:', error);
  }
}

// Export functions for use in other modules
export {
  startTracking,
  updateVendorLocation,
  stopTracking,
  getTrackingSession,
  getActiveSessionByIncident,
  subscribeToTrackingUpdates,
  subscribeToIncidentTracking,
  driverTrackingScenario,
  vendorLocationUpdateScenario,
  completeTrackingFlow,
};
