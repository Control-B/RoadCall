import { useEffect, useRef } from 'react';
import { roadcallApi } from '@/src/api/roadcallApi';
import { useRequestStore } from '@/src/store/requestStore';

const POLLING_INTERVAL = 10000;

export function useActiveRequest(requestId: string | null) {
  const { updateRequestStatus, setActiveRequest } = useRequestStore();
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRequest = async () => {
    if (!requestId) return;

    try {
      const request = await roadcallApi.getRequestById(requestId);
      updateRequestStatus(request);

      if (request.status === 'COMPLETED' || request.status === 'CANCELED') {
        stopPolling();
      }
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR') {
        return;
      }
      console.error('Error fetching request:', error);
    }
  };

  const startPolling = () => {
    if (intervalRef.current) return;

    fetchRequest();
    intervalRef.current = setInterval(fetchRequest, POLLING_INTERVAL);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (requestId) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [requestId]);

  return { refetch: fetchRequest };
}
