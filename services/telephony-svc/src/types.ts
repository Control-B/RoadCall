/**
 * Telephony Service Types
 * Data models for call records, transcripts, and summaries
 */

export interface CallRecord {
  callId: string; // Amazon Connect ContactId
  incidentId?: string;
  driverId?: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  duration: number; // seconds
  recordingUrl?: string; // S3 presigned URL
  transcriptId?: string;
  summaryId?: string;
  startTime: string; // ISO 8601
  endTime: string; // ISO 8601
  disposition: string;
  metadata?: Record<string, any>;
}

export interface Transcript {
  transcriptId: string;
  callId: string;
  incidentId?: string;
  rawText: string; // Original transcript
  redactedText: string; // PII removed
  piiEntities: PIIEntity[];
  confidence: number;
  createdAt: string;
}

export interface PIIEntity {
  type: string; // NAME, ADDRESS, SSN, CREDIT_CARD, etc.
  text: string;
  beginOffset: number;
  endOffset: number;
  score: number;
}

export interface CallSummary {
  summaryId: string;
  callId: string;
  incidentId?: string;
  summary: string;
  incidentType?: 'tire' | 'engine' | 'tow';
  urgency: 'low' | 'medium' | 'high' | 'critical';
  actionItems: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  keyPhrases: string[];
  generatedAt: string;
}

export interface ContactFlowEvent {
  Name: string;
  Details: {
    ContactData: {
      Attributes: Record<string, string>;
      Channel: string;
      ContactId: string;
      CustomerEndpoint: {
        Address: string;
        Type: string;
      };
      InitialContactId: string;
      InitiationMethod: string;
      InstanceARN: string;
      PreviousContactId?: string;
      Queue?: any;
      SystemEndpoint: {
        Address: string;
        Type: string;
      };
    };
    Parameters: Record<string, string>;
  };
}

export interface DriverLookupResult {
  found: boolean;
  driverId?: string;
  name?: string;
  companyName?: string;
  truckNumber?: string;
  isRegistered: boolean;
}

export interface IncidentCreationRequest {
  driverId: string;
  type: 'tire' | 'engine' | 'tow';
  location?: {
    lat: number;
    lon: number;
  };
  callId: string;
  phone: string;
  description?: string;
}

export interface IncidentCreationResult {
  success: boolean;
  incidentId?: string;
  error?: string;
}

export interface PostCallProcessingEvent {
  contactId: string;
  recordingLocation?: {
    bucket: string;
    key: string;
  };
  transcriptLocation?: {
    bucket: string;
    key: string;
  };
}

export interface PIIMapping {
  mappingId: string;
  transcriptId: string;
  callId: string;
  encryptedPII: string; // Encrypted JSON of PII entities with original text
  createdAt: string;
  expiresAt: number; // TTL for automatic deletion
}

export interface PIIAccessLog {
  logId: string;
  transcriptId: string;
  userId: string;
  userRole: string;
  purpose: string;
  accessedAt: string;
  ipAddress?: string;
  piiTypes: string[];
}
