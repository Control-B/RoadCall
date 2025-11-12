/**
 * Lambda Handler for Verification Queue Operations
 * 
 * Handles manual verification queue management
 */

import { Handler } from 'aws-lambda';
import { VerificationQueue } from '../verification-queue';

const verificationQueue = new VerificationQueue();

/**
 * Get pending items from verification queue
 */
export const getPendingItems: Handler = async (event) => {
  try {
    const limit = event.queryStringParameters?.limit 
      ? parseInt(event.queryStringParameters.limit) 
      : 50;

    const items = await verificationQueue.getPendingItems(limit);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        items,
        count: items.length
      })
    };
  } catch (error) {
    console.error('Error getting pending items:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Get specific item from verification queue
 */
export const getItem: Handler = async (event) => {
  try {
    const itemId = event.pathParameters?.itemId;
    
    if (!itemId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing itemId parameter' })
      };
    }

    const item = await verificationQueue.getItem(itemId);

    if (!item) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Item not found' })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        item
      })
    };
  } catch (error) {
    console.error('Error getting item:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Approve vendor data
 */
export const approveItem: Handler = async (event) => {
  try {
    const itemId = event.pathParameters?.itemId;
    const body = JSON.parse(event.body || '{}');
    const verifiedBy = body.verifiedBy || event.requestContext?.authorizer?.claims?.sub;

    if (!itemId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing itemId parameter' })
      };
    }

    if (!verifiedBy) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing verifiedBy field' })
      };
    }

    await verificationQueue.approve(itemId, verifiedBy);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Item approved successfully'
      })
    };
  } catch (error) {
    console.error('Error approving item:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Reject vendor data
 */
export const rejectItem: Handler = async (event) => {
  try {
    const itemId = event.pathParameters?.itemId;
    const body = JSON.parse(event.body || '{}');
    const verifiedBy = body.verifiedBy || event.requestContext?.authorizer?.claims?.sub;
    const reason = body.reason;

    if (!itemId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing itemId parameter' })
      };
    }

    if (!verifiedBy) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing verifiedBy field' })
      };
    }

    if (!reason) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing reason field' })
      };
    }

    await verificationQueue.reject(itemId, verifiedBy, reason);

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: 'Item rejected successfully'
      })
    };
  } catch (error) {
    console.error('Error rejecting item:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};

/**
 * Get verification queue statistics
 */
export const getStatistics: Handler = async () => {
  try {
    const stats = await verificationQueue.getStatistics();

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        statistics: stats
      })
    };
  } catch (error) {
    console.error('Error getting statistics:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
