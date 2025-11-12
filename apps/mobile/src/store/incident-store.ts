import { create } from 'zustand';
import { Incident, TrackingSession } from '../types';

interface IncidentState {
  activeIncident: Incident | null;
  incidents: Incident[];
  trackingSession: TrackingSession | null;
  setActiveIncident: (incident: Incident | null) => void;
  setIncidents: (incidents: Incident[]) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (incidentId: string, updates: Partial<Incident>) => void;
  setTrackingSession: (session: TrackingSession | null) => void;
  updateTrackingSession: (updates: Partial<TrackingSession>) => void;
}

export const useIncidentStore = create<IncidentState>((set) => ({
  activeIncident: null,
  incidents: [],
  trackingSession: null,
  setActiveIncident: (incident) => set({ activeIncident: incident }),
  setIncidents: (incidents) => set({ incidents }),
  addIncident: (incident) =>
    set((state) => ({
      incidents: [incident, ...state.incidents],
      activeIncident: incident,
    })),
  updateIncident: (incidentId, updates) =>
    set((state) => ({
      incidents: state.incidents.map((inc) =>
        inc.incidentId === incidentId ? { ...inc, ...updates } : inc
      ),
      activeIncident:
        state.activeIncident?.incidentId === incidentId
          ? { ...state.activeIncident, ...updates }
          : state.activeIncident,
    })),
  setTrackingSession: (session) => set({ trackingSession: session }),
  updateTrackingSession: (updates) =>
    set((state) => ({
      trackingSession: state.trackingSession
        ? { ...state.trackingSession, ...updates }
        : null,
    })),
}));
