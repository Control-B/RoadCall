import { get, post, patch, del } from 'aws-amplify/api';
import { Incident, Offer, Payment } from '../types';

const API_NAME = 'RoadcallAPI';

// Incident APIs
export const createIncident = async (data: {
  type: string;
  location: { lat: number; lon: number };
}): Promise<Incident> => {
  const response = await post({
    apiName: API_NAME,
    path: '/incidents',
    options: {
      body: data,
    },
  }).response;
  return (await response.body.json()) as Incident;
};

export const getIncident = async (incidentId: string): Promise<Incident> => {
  const response = await get({
    apiName: API_NAME,
    path: `/incidents/${incidentId}`,
  }).response;
  return (await response.body.json()) as Incident;
};

export const getDriverIncidents = async (
  driverId: string,
  status?: string
): Promise<Incident[]> => {
  const queryParams = new URLSearchParams();
  queryParams.append('driverId', driverId);
  if (status) queryParams.append('status', status);

  const response = await get({
    apiName: API_NAME,
    path: `/incidents?${queryParams.toString()}`,
  }).response;
  return (await response.body.json()) as Incident[];
};

export const updateIncidentStatus = async (
  incidentId: string,
  status: string
): Promise<Incident> => {
  const response = await patch({
    apiName: API_NAME,
    path: `/incidents/${incidentId}/status`,
    options: {
      body: { status },
    },
  }).response;
  return (await response.body.json()) as Incident;
};

export const uploadIncidentMedia = async (
  incidentId: string,
  mediaData: FormData
): Promise<{ mediaId: string; url: string }> => {
  const response = await post({
    apiName: API_NAME,
    path: `/incidents/${incidentId}/media`,
    options: {
      body: mediaData,
    },
  }).response;
  return (await response.body.json()) as { mediaId: string; url: string };
};

// Offer APIs
export const getOffer = async (offerId: string): Promise<Offer> => {
  const response = await get({
    apiName: API_NAME,
    path: `/offers/${offerId}`,
  }).response;
  return (await response.body.json()) as Offer;
};

export const getVendorOffers = async (
  vendorId: string,
  status?: string
): Promise<Offer[]> => {
  const queryParams = new URLSearchParams();
  queryParams.append('vendorId', vendorId);
  if (status) queryParams.append('status', status);

  const response = await get({
    apiName: API_NAME,
    path: `/offers?${queryParams.toString()}`,
  }).response;
  return (await response.body.json()) as Offer[];
};

export const acceptOffer = async (offerId: string): Promise<Offer> => {
  const response = await post({
    apiName: API_NAME,
    path: `/offers/${offerId}/accept`,
  }).response;
  return (await response.body.json()) as Offer;
};

export const declineOffer = async (
  offerId: string,
  reason?: string
): Promise<Offer> => {
  const response = await post({
    apiName: API_NAME,
    path: `/offers/${offerId}/decline`,
    options: {
      body: { reason },
    },
  }).response;
  return (await response.body.json()) as Offer;
};

// Payment APIs
export const getPayment = async (paymentId: string): Promise<Payment> => {
  const response = await get({
    apiName: API_NAME,
    path: `/payments/${paymentId}`,
  }).response;
  return (await response.body.json()) as Payment;
};

export const getIncidentPayments = async (
  incidentId: string
): Promise<Payment[]> => {
  const response = await get({
    apiName: API_NAME,
    path: `/payments?incidentId=${incidentId}`,
  }).response;
  return (await response.body.json()) as Payment[];
};

// Driver APIs
export const getDriverProfile = async (driverId: string) => {
  const response = await get({
    apiName: API_NAME,
    path: `/drivers/${driverId}`,
  }).response;
  return await response.body.json();
};

export const updateDriverPreferences = async (
  driverId: string,
  preferences: any
) => {
  const response = await patch({
    apiName: API_NAME,
    path: `/drivers/${driverId}/preferences`,
    options: {
      body: preferences,
    },
  }).response;
  return await response.body.json();
};

// Vendor APIs
export const getVendorProfile = async (vendorId: string) => {
  const response = await get({
    apiName: API_NAME,
    path: `/vendors/${vendorId}`,
  }).response;
  return await response.body.json();
};

export const updateVendorAvailability = async (
  vendorId: string,
  status: 'available' | 'busy' | 'offline'
) => {
  const response = await patch({
    apiName: API_NAME,
    path: `/vendors/${vendorId}/availability`,
    options: {
      body: { status },
    },
  }).response;
  return await response.body.json();
};
