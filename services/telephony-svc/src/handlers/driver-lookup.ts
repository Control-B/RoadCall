/**
 * Driver Lookup Handler
 * Lambda function invoked by Amazon Connect contact flow to identify driver by phone number (ANI)
 */

import { Handler } from 'aws-lambda';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';
import { unmarshall } from '@aws-sdk/util-dynamodb';
import { logger } from '@roadcall/utils';
import { ContactFlowEvent, DriverLookupResult } from '../types';

const dynamodb = new DynamoDBClient({});
const USERS_TABLE = process.env.USERS_TABLE_NAME || '';

/**
 * Lookup driver by phone number using GSI
 * Called by Amazon Connect contact flow for ANI identification
 */
export const handler: Handler<ContactFlowEvent, DriverLookupResult> = async (event) => {
  const contactId = event.Details.ContactData.ContactId;
  const phoneNumber = event.Details.ContactData.CustomerEndpoint.Address;

  logger.info('Driver lookup initiated', {
    contactId,
    phoneNumber: phoneNumber.substring(0, 5) + '***', // Mask for privacy
  });

  try {
    // Normalize phone number to E.164 format if needed
    const normalizedPhone = normalizePhoneNumber(phoneNumber);

    // Query Users table by phone number using GSI
    const command = new QueryCommand({
      TableName: USERS_TABLE,
      IndexName: 'phone-index',
      KeyConditionExpression: 'phone = :phone',
      ExpressionAttributeValues: {
        ':phone': { S: normalizedPhone },
      },
      Limit: 1,
    });

    const response = await dynamodb.send(command);

    if (!response.Items || response.Items.length === 0) {
      logger.info('Driver not found', { contactId, phoneNumber: normalizedPhone });
      return {
        found: false,
        isRegistered: false,
      };
    }

    const user = unmarshall(response.Items[0]);

    // Check if user is a driver
    if (user.role !== 'driver') {
      logger.info('User found but not a driver', {
        contactId,
        userId: user.userId,
        role: user.role,
      });
      return {
        found: false,
        isRegistered: true,
      };
    }

    logger.info('Driver found', {
      contactId,
      driverId: user.userId,
      name: user.name,
    });

    return {
      found: true,
      driverId: user.userId,
      name: user.name,
      companyName: user.companyName,
      truckNumber: user.truckNumber,
      isRegistered: true,
    };
  } catch (error) {
    logger.error(
      'Error looking up driver',
      error instanceof Error ? error : new Error('Unknown error'),
      { contactId }
    );

    // Return not found on error to allow call to continue
    return {
      found: false,
      isRegistered: false,
    };
  }
};

/**
 * Normalize phone number to E.164 format
 * Handles various input formats
 */
function normalizePhoneNumber(phone: string): string {
  // Remove all non-digit characters
  let digits = phone.replace(/\D/g, '');

  // If starts with 1 and has 11 digits, it's already E.164 for US
  if (digits.length === 11 && digits.startsWith('1')) {
    return '+' + digits;
  }

  // If 10 digits, assume US and add country code
  if (digits.length === 10) {
    return '+1' + digits;
  }

  // If already has +, return as is
  if (phone.startsWith('+')) {
    return phone;
  }

  // Default: add + prefix
  return '+' + digits;
}
