import {
  APIGatewayAuthorizerResult,
  APIGatewayTokenAuthorizerEvent,
  PolicyDocument,
} from 'aws-lambda';
import { logger } from '@roadcall/utils';
import { verifyToken } from '../jwt-service';

/**
 * Generate IAM policy for API Gateway
 */
function generatePolicy(
  principalId: string,
  effect: 'Allow' | 'Deny',
  resource: string,
  context?: Record<string, string>
): APIGatewayAuthorizerResult {
  const policyDocument: PolicyDocument = {
    Version: '2012-10-17',
    Statement: [
      {
        Action: 'execute-api:Invoke',
        Effect: effect,
        Resource: resource,
      },
    ],
  };

  return {
    principalId,
    policyDocument,
    context,
  };
}

/**
 * Lambda authorizer for API Gateway
 * Validates JWT tokens and returns IAM policy
 */
export async function handler(
  event: APIGatewayTokenAuthorizerEvent
): Promise<APIGatewayAuthorizerResult> {
  try {
    const token = event.authorizationToken.replace('Bearer ', '');

    // Verify token
    const payload = await verifyToken(token);

    logger.info('Token authorized', { userId: payload.userId });

    // Generate allow policy with user context
    return generatePolicy(payload.userId, 'Allow', event.methodArn, {
      userId: payload.userId,
      phone: payload.phone,
      role: payload.role,
      companyId: payload.companyId || '',
    });
  } catch (error) {
    logger.error('Authorization failed', error as Error);

    // Return deny policy
    return generatePolicy('user', 'Deny', event.methodArn);
  }
}
