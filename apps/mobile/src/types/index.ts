export interface User {
  id: string;
  name: string;
  phone: string;
  email?: string;
  truckingCompany: string;
  truckNumber: string;
  truckType: TruckType;
  createdAt?: string;
}

export type TruckType =
  | 'Day Cab'
  | 'Sleeper'
  | 'Box Truck'
  | 'Flatbed'
  | 'Reefer'
  | 'Tanker'
  | 'Other';

export interface Location {
  lat: number;
  lng: number;
  address?: string;
}

export interface Mechanic {
  id: string;
  name: string;
  companyName: string;
  phone: string;
  location: Location;
  serviceTypes?: string[];
}

export type JobStatus =
  | 'REQUESTED'
  | 'SEARCHING'
  | 'ACCEPTED'
  | 'EN_ROUTE'
  | 'ON_SITE'
  | 'COMPLETED'
  | 'CANCELED';

export type ProblemType =
  | 'Tire'
  | 'Engine'
  | 'Battery'
  | 'Fuel'
  | 'Tow'
  | 'Brakes'
  | 'Other';

export interface BreakdownRequest {
  id: string;
  driverId: string;
  mechanic?: Mechanic;
  location: Location;
  problemType: ProblemType;
  hasTrailer: boolean;
  notes: string;
  photos?: string[];
  status: JobStatus;
  etaMinutes?: number;
  truckType: TruckType;
  truckNumber: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface LoginPayload {
  identifier: string;
  password?: string;
  code?: string;
}

export interface RegisterPayload {
  name: string;
  phone: string;
  email?: string;
  truckingCompany: string;
  truckNumber: string;
  truckType: TruckType;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface CreateRequestPayload {
  location: Location;
  problemType: ProblemType;
  hasTrailer: boolean;
  notes: string;
  photos?: string[];
  truckType: TruckType;
  truckNumber: string;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: any;
}
