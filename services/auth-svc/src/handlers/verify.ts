import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { logger, ValidationError, AuthenticationError } from '@roadcall/utils';
import { validateOTP } from '../otp-service';
import { getUserByPhone, updateLastLogin } from '../user-service';
import { generateTokenPair } from '../jwt-service';

interface VerifyRequest {
  phone: string;
  otp: string;
}

/**
 * Lambda handler for OTP verification
 * POST /auth/verify
 */
export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const requestId = event.requestContext.requestId;

  try {
    // Parse request body
    if (!event.body) {
      throw new ValidationError('Request body is required');
    }

    const body: VerifyRequest = JSON.parse(event.body);

    // Validate required fields
    if (!body.phone || !body.otp) {
      throw new ValidationError('Missing required fields: phone, otp');
    }

    logger.info('OTP verification initiated', { phone: body.phone });

    // Validate OTP
    const result = await validateOTP(body.phone, body.otp);

    if (!result.valid) {
      throw new AuthenticationError(`OTP verification failed: ${result.reason}`);
    }

    // Get user
    const user = await getUserByPhone(body.phone);
    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Update last login
    await updateLastLogin(user.userId);

    // Generate JWT tokens
    const tokens = await generateTokenPair(user);

    logger.info('User authenticated successfully', { userId: user.userId });

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        user: {
          userId: user.userId,
          phone: user.phone,
          role: user.role,
          name: user.name,
          email: user.email,
          companyId: user.companyId,
        },
        tokens,
        requestId,
        timestamp: new Date().toISOString(),
      }),
    };
  } catch (error) {
    logger.error('OTP verification failed', error as Error, { requestId });

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
