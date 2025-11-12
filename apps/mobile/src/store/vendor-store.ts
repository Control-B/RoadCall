import { create } from 'zustand';
import { Offer } from '../types';

interface VendorState {
  offers: Offer[];
  activeOffer: Offer | null;
  setOffers: (offers: Offer[]) => void;
  addOffer: (offer: Offer) => void;
  updateOffer: (offerId: string, updates: Partial<Offer>) => void;
  removeOffer: (offerId: string) => void;
  setActiveOffer: (offer: Offer | null) => void;
}

export const useVendorStore = create<VendorState>((set) => ({
  offers: [],
  activeOffer: null,
  setOffers: (offers) => set({ offers }),
  addOffer: (offer) =>
    set((state) => ({
      offers: [offer, ...state.offers],
    })),
  updateOffer: (offerId, updates) =>
    set((state) => ({
      offers: state.offers.map((offer) =>
        offer.offerId === offerId ? { ...offer, ...updates } : offer
      ),
      activeOffer:
        state.activeOffer?.offerId === offerId
          ? { ...state.activeOffer, ...updates }
          : state.activeOffer,
    })),
  removeOffer: (offerId) =>
    set((state) => ({
      offers: state.offers.filter((offer) => offer.offerId !== offerId),
      activeOffer:
        state.activeOffer?.offerId === offerId ? null : state.activeOffer,
    })),
  setActiveOffer: (offer) => set({ activeOffer: offer }),
}));
