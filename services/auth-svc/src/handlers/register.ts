import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { UserRole } from '@roadcall/types';
import { logger, ValidationError } from '@roadcall/utils';
import { createOTPSession, sendOTPSMS } from '../otp-service';
import { getUserByPhone, createUser } from '../user-service';

interface RegisterRequest {
  phone: string;
  role: UserRole;
  name: string;
  email?: string;
  companyId?: string;
  truckNumber?: string;
}

/**
 * Lambda handler for user registration
 * POST /auth/register
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    // Parse request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: RegisterRequest = JSON.parse(event.body);

    // Validate required fields
    if (!body.phone || !body.role || !body.name) {
      throw new ValidationError('Missing required fields: phone, role, name');
    }

    logger.info('User registration initiated', { phone: body.phone, role: body.role });

    // Check if user already exists
    const existingUser = await getUserByPhone(body.phone);

    if (existingUser) {
      // User exists - just send OTP for login
      logger.info('Existing user attempting registration', { phone: body.phone });
    } else {
      // Create new user
      await createUser(
        body.phone,
        body.role,
        body.name,
        body.email,
        body.companyId,
        body.truckNumber
      );
    }

    // Generate and send OTP
    const otp = await createOTPSession(body.phone);
    await sendOTPSMS(body.phone, otp);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        message: 'OTP sent successfully',
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('Registration failed', error as Error, { requestId });

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
