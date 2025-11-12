import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as custom from 'aws-cdk-lib/custom-resources';
import { Construct } from 'constructs';

export interface FraudDetectorSetupProps {
  stage: string;
  detectorName: string;
  eventTypeName: string;
}

/**
 * Custom resource to set up Amazon Fraud Detector
 * 
 * Note: Amazon Fraud Detector doesn't have native CDK L2 constructs yet,
 * so we use custom resources to configure it via SDK calls.
 * 
 * This construct creates:
 * 1. Event Type (vendor_payment)
 * 2. Entity Type (vendor)
 * 3. Variables for fraud scoring
 * 4. Detector with rules
 * 
 * Manual steps still required:
 * - Train and deploy the model in AWS Console
 * - Configure detector version and activate it
 */
export class FraudDetectorSetup extends Construct {
  public readonly detectorName: string;
  public readonly eventTypeName: string;

  constructor(scope: Construct, id: string, props: FraudDetectorSetupProps) {
    super(scope, id);

    this.detectorName = props.detectorName;
    this.eventTypeName = props.eventTypeName;

    // Create IAM role for custom resource
    const customResourceRole = new iam.Role(this, 'CustomResourceRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        FraudDetectorPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'frauddetector:CreateVariable',
                'frauddetector:UpdateVariable',
                'frauddetector:GetVariables',
                'frauddetector:CreateEntityType',
                'frauddetector:UpdateEntityType',
                'frauddetector:GetEntityTypes',
                'frauddetector:CreateEventType',
                'frauddetector:UpdateEventType',
                'frauddetector:GetEventTypes',
                'frauddetector:PutEventType',
                'frauddetector:CreateDetector',
                'frauddetector:UpdateDetector',
                'frauddetector:GetDetectors',
                'frauddetector:CreateRule',
                'frauddetector:UpdateRule',
                'frauddetector:GetRules',
                'frauddetector:CreateOutcome',
                'frauddetector:UpdateOutcome',
                'frauddetector:GetOutcomes',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    // Custom resource provider
    const provider = new custom.Provider(this, 'FraudDetectorProvider', {
      onEventHandler: new cdk.aws_lambda.Function(this, 'FraudDetectorSetupFunction', {
        runtime: cdk.aws_lambda.Runtime.PYTHON_3_11,
        handler: 'index.handler',
        code: cdk.aws_lambda.Code.fromInline(`
import boto3
import json
import logging

logger = logging.getLogger()
logger.setLevel(logging.INFO)

fraud_detector = boto3.client('frauddetector')

def handler(event, context):
    logger.info(f"Event: {json.dumps(event)}")
    
    request_type = event['RequestType']
    props = event['ResourceProperties']
    
    detector_name = props['DetectorName']
    event_type_name = props['EventTypeName']
    
    try:
        if request_type == 'Create' or request_type == 'Update':
            setup_fraud_detector(detector_name, event_type_name)
            return {
                'PhysicalResourceId': f'{detector_name}-setup',
                'Data': {
                    'DetectorName': detector_name,
                    'EventTypeName': event_type_name
                }
            }
        elif request_type == 'Delete':
            # Fraud Detector resources are not deleted to preserve historical data
            logger.info("Delete requested - keeping Fraud Detector resources")
            return {'PhysicalResourceId': f'{detector_name}-setup'}
    except Exception as e:
        logger.error(f"Error: {str(e)}")
        raise

def setup_fraud_detector(detector_name, event_type_name):
    """Set up Fraud Detector resources"""
    
    # 1. Create Entity Type (vendor)
    try:
        fraud_detector.put_entity_type(
            name='vendor',
            description='Vendor entity for payment fraud detection'
        )
        logger.info("Entity type 'vendor' created/updated")
    except Exception as e:
        logger.warning(f"Entity type creation: {str(e)}")
    
    # 2. Create Variables
    variables = [
        {
            'name': 'payment_amount',
            'dataType': 'FLOAT',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Payment amount in dollars'
        },
        {
            'name': 'vendor_account_age_days',
            'dataType': 'INTEGER',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Vendor account age in days'
        },
        {
            'name': 'vendor_total_payments',
            'dataType': 'INTEGER',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Total number of payments to vendor'
        },
        {
            'name': 'vendor_payment_velocity_24h',
            'dataType': 'INTEGER',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Number of payments in last 24 hours'
        },
        {
            'name': 'vendor_avg_payment_amount',
            'dataType': 'FLOAT',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Average payment amount for vendor'
        },
        {
            'name': 'vendor_completion_rate',
            'dataType': 'FLOAT',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Vendor completion rate (0-1)'
        },
        {
            'name': 'incident_duration_minutes',
            'dataType': 'INTEGER',
            'dataSource': 'EVENT',
            'defaultValue': '0',
            'description': 'Incident duration in minutes'
        }
    ]
    
    for var in variables:
        try:
            fraud_detector.create_variable(**var)
            logger.info(f"Variable '{var['name']}' created")
        except fraud_detector.exceptions.ValidationException:
            # Variable already exists, update it
            fraud_detector.update_variable(
                name=var['name'],
                defaultValue=var['defaultValue'],
                description=var['description']
            )
            logger.info(f"Variable '{var['name']}' updated")
    
    # 3. Create Outcomes
    outcomes = [
        {'name': 'approve', 'description': 'Approve payment for processing'},
        {'name': 'review', 'description': 'Flag payment for manual review'},
        {'name': 'block', 'description': 'Block payment due to high fraud risk'}
    ]
    
    for outcome in outcomes:
        try:
            fraud_detector.put_outcome(**outcome)
            logger.info(f"Outcome '{outcome['name']}' created/updated")
        except Exception as e:
            logger.warning(f"Outcome creation: {str(e)}")
    
    # 4. Create Event Type
    try:
        fraud_detector.put_event_type(
            name=event_type_name,
            eventVariables=[v['name'] for v in variables],
            entityTypes=['vendor'],
            labels=['fraud', 'legit']
        )
        logger.info(f"Event type '{event_type_name}' created/updated")
    except Exception as e:
        logger.warning(f"Event type creation: {str(e)}")
    
    logger.info("Fraud Detector setup completed")
    logger.info("MANUAL STEPS REQUIRED:")
    logger.info("1. Go to AWS Fraud Detector console")
    logger.info("2. Create and train a model using historical payment data")
    logger.info("3. Create detector version with rules")
    logger.info("4. Activate the detector version")
        `),
        timeout: cdk.Duration.minutes(5),
        role: customResourceRole,
      }),
    });

    // Create custom resource
    new cdk.CustomResource(this, 'FraudDetectorResource', {
      serviceToken: provider.serviceToken,
      properties: {
        DetectorName: this.detectorName,
        EventTypeName: this.eventTypeName,
      },
    });

    // Output instructions
    new cdk.CfnOutput(this, 'FraudDetectorSetupInstructions', {
      value: `Fraud Detector resources created. Manual steps required:
1. Go to AWS Fraud Detector console
2. Create and train a model using the '${this.eventTypeName}' event type
3. Create detector '${this.detectorName}' with rules
4. Activate the detector version`,
      description: 'Manual setup instructions for Fraud Detector',
    });

    new cdk.CfnOutput(this, 'FraudDetectorName', {
      value: this.detectorName,
      exportName: `${props.stage}-FraudDetectorName`,
    });

    new cdk.CfnOutput(this, 'FraudEventTypeName', {
      value: this.eventTypeName,
      exportName: `${props.stage}-FraudEventTypeName`,
    });
  }
}
