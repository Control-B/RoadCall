import { create } from 'zustand';
import { BreakdownRequest, Location } from '@/src/types';

interface RequestState {
  activeRequest: BreakdownRequest | null;
  mechanicLocation: Location | null;
  setActiveRequest: (request: BreakdownRequest | null) => void;
  setMechanicLocation: (location: Location | null) => void;
  updateRequestStatus: (request: BreakdownRequest) => void;
}

export const useRequestStore = create<RequestState>((set) => ({
  activeRequest: null,
  mechanicLocation: null,

  setActiveRequest: (request) => set({ activeRequest: request }),

  setMechanicLocation: (location) => set({ mechanicLocation: location }),

  updateRequestStatus: (request) => {
    set({ activeRequest: request });
    if (request.mechanic?.location) {
      set({ mechanicLocation: request.mechanic.location });
    }
  },
}));
