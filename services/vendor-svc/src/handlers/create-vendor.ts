import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError, AuthorizationError } from '@roadcall/utils';
import { createVendor } from '../vendor-service';
import { ServiceCapability, VendorCoverageArea, Vendor } from '@roadcall/types';

interface CreateVendorRequest {
  businessName: string;
  contactName: string;
  phone: string;
  email: string;
  capabilities: ServiceCapability[];
  coverageArea: VendorCoverageArea;
  operatingHours: Vendor['operatingHours'];
  pricing: Vendor['pricing'];
  certifications?: string[];
  insuranceExpiry: string;
}

/**
 * Lambda handler for creating vendor profile
 * POST /vendors
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    // Only admins can create vendors
    const role = event.requestContext.authorizer?.role;
    if (role !== 'admin') {
      throw new AuthorizationError('Only admins can create vendor profiles');
    }

    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: CreateVendorRequest = JSON.parse(event.body);

    // Validate required fields
    if (
      !body.businessName ||
      !body.contactName ||
      !body.phone ||
      !body.email ||
      !body.capabilities ||
      !body.coverageArea ||
      !body.operatingHours ||
      !body.pricing ||
      !body.insuranceExpiry
    ) {
      throw new ValidationError('Missing required fields');
    }

    logger.info('Creating vendor', { businessName: body.businessName });

    const vendor = await createVendor(
      body.businessName,
      body.contactName,
      body.phone,
      body.email,
      body.capabilities,
      body.coverageArea,
      body.operatingHours,
      body.pricing,
      body.certifications || [],
      body.insuranceExpiry
    );

    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        vendor,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Create vendor failed', error as Error, { requestId });

    const statusCode = (error as any).statusCode || 500;
    const message = (error as Error).message || 'Internal server error';

    return {
      statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: {
          message,
          requestId,
          timestamp: new Date().toISOString(),
        },
      }),
    };
  }
}
