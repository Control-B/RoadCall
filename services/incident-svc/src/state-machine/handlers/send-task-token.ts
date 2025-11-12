import { Handler, EventBridgeEvent } from 'aws-lambda';
import { logger } from '@roadcall/utils';

// Note: Task token functionality will be implemented when needed
// For now, this handler processes events and updates incident status

/**
 * Send task token to resume Step Functions execution
 * This handler is triggered by EventBridge events (vendor actions, payment approval)
 */
export const handler: Handler = async (
  event: EventBridgeEvent<string, any>
) => {
  logger.info('Processing event for task token', { 
    detailType: event['detail-type'],
    source: event.source 
  });

  const { incidentId } = event.detail;

  try {
    // In a real implementation, you would retrieve the task token from DynamoDB
    // For now, we'll handle the event and update the incident status
    
    // Different event types require different handling
    switch (event['detail-type']) {
      case 'OfferAccepted':
        await handleOfferAccepted(event.detail);
        break;
      
      case 'WorkCompleted':
        await handleWorkCompleted(event.detail);
        break;
      
      case 'PaymentApproved':
        await handlePaymentApproved(event.detail);
        break;
      
      default:
        logger.warn('Unhandled event type', { detailType: event['detail-type'] });
    }

    logger.info('Event processed successfully', { incidentId });
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Event processed' }),
    };
  } catch (error) {
    logger.error('Error processing event', error as Error, { incidentId });
    throw error;
  }
};

async function handleOfferAccepted(detail: any) {
  const { incidentId, vendorId, offerId } = detail;
  
  logger.info('Handling offer accepted', { incidentId, vendorId, offerId });
  
  // The state machine will detect the vendor assignment through CheckVendorResponse
  // No task token needed for this flow
}

async function handleWorkCompleted(detail: any) {
  const { incidentId } = detail;
  
  logger.info('Work completed event received', { incidentId });
  
  // Task token functionality will be implemented when Step Functions
  // waitForTaskToken integration is added
  // For now, the state machine will detect status changes through polling
}

async function handlePaymentApproved(detail: any) {
  const { incidentId, paymentId } = detail;
  
  logger.info('Payment approved event received', { incidentId, paymentId });
  
  // Task token functionality will be implemented when Step Functions
  // waitForTaskToken integration is added
  // For now, the state machine will detect status changes through polling
}
