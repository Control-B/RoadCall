/**
 * Example: Integrating Compliance Stack with existing infrastructure
 * 
 * This example shows how to integrate the ComplianceStack with your
 * existing CDK stacks and configure data retention policies.
 */

import * as cdk from 'aws-cdk-lib';
import { ComplianceStack } from '../lib/compliance-stack';
import { DataRetentionPolicies } from '../lib/data-retention-policies';
import { Construct } from 'constructs';

export class RoadcallInfrastructureStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Assume these are already created in other stacks
    const dataStack = {
      usersTable: this.getExistingTable('UsersTable'),
      driversTable: this.getExistingTable('DriversTable'),
      vendorsTable: this.getExistingTable('VendorsTable'),
      incidentsTable: this.getExistingTable('IncidentsTable'),
      callRecordsTable: this.getExistingTable('CallRecordsTable'),
      trackingSessionsTable: this.getExistingTable('TrackingSessionsTable'),
    };

    const storageStack = {
      callRecordingsBucket: this.getExistingBucket('CallRecordingsBucket'),
      incidentMediaBucket: this.getExistingBucket('IncidentMediaBucket'),
      kbDocumentsBucket: this.getExistingBucket('KBDocumentsBucket'),
    };

    const auroraStack = {
      clusterArn: this.getParameter('AuroraClusterArn'),
      secretArn: this.getParameter('AuroraSecretArn'),
      databaseName: 'roadcall',
    };

    const kmsKey = this.getExistingKey('DataEncryptionKey');
    const eventBusName = 'roadcall-event-bus';

    // Deploy Compliance Stack
    const complianceStack = new ComplianceStack(this, 'ComplianceStack', {
      usersTable: dataStack.usersTable,
      driversTable: dataStack.driversTable,
      vendorsTable: dataStack.vendorsTable,
      incidentsTable: dataStack.incidentsTable,
      callRecordsTable: dataStack.callRecordsTable,
      trackingSessionsTable: dataStack.trackingSessionsTable,
      callRecordingsBucket: storageStack.callRecordingsBucket,
      incidentMediaBucket: storageStack.incidentMediaBucket,
      auroraClusterArn: auroraStack.clusterArn,
      auroraSecretArn: auroraStack.secretArn,
      databaseName: auroraStack.databaseName,
      eventBusName,
      kmsKey,
    });

    // Configure data retention policies
    new DataRetentionPolicies(this, 'DataRetentionPolicies', {
      callRecordingsBucket: storageStack.callRecordingsBucket,
      incidentMediaBucket: storageStack.incidentMediaBucket,
      kbDocumentsBucket: storageStack.kbDocumentsBucket,
    });

    // Add compliance endpoints to API Gateway
    this.addComplianceEndpoints(complianceStack);

    // Output compliance stack resources
    new cdk.CfnOutput(this, 'ComplianceAPIEndpoints', {
      value: JSON.stringify({
        dataExport: '/compliance/export',
        rightToBeForgotten: '/compliance/forget',
        consentManagement: '/compliance/consent',
      }),
      description: 'Compliance API endpoints',
    });
  }

  private addComplianceEndpoints(complianceStack: ComplianceStack): void {
    // Assume API Gateway is already created
    const api = this.getExistingApiGateway('MainAPI');

    // Add compliance resource
    const complianceResource = api.root.addResource('compliance');

    // Data export endpoint
    const exportResource = complianceResource.addResource('export');
    exportResource.addMethod('GET', 
      new cdk.aws_apigateway.LambdaIntegration(complianceStack.dataExportFunction),
      {
        authorizer: this.getCognitoAuthorizer(),
        authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
      }
    );

    // Right-to-be-forgotten endpoint
    const forgetResource = complianceResource.addResource('forget');
    forgetResource.addMethod('POST',
      new cdk.aws_apigateway.LambdaIntegration(complianceStack.rightToBeForgottenFunction),
      {
        authorizer: this.getCognitoAuthorizer(),
        authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
      }
    );

    // Consent management endpoints
    const consentResource = complianceResource.addResource('consent');
    consentResource.addMethod('GET',
      new cdk.aws_apigateway.LambdaIntegration(complianceStack.consentManagementFunction),
      {
        authorizer: this.getCognitoAuthorizer(),
        authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
      }
    );
    consentResource.addMethod('POST',
      new cdk.aws_apigateway.LambdaIntegration(complianceStack.consentManagementFunction),
      {
        authorizer: this.getCognitoAuthorizer(),
        authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
      }
    );
    consentResource.addMethod('PUT',
      new cdk.aws_apigateway.LambdaIntegration(complianceStack.consentManagementFunction),
      {
        authorizer: this.getCognitoAuthorizer(),
        authorizationType: cdk.aws_apigateway.AuthorizationType.COGNITO,
      }
    );
  }

  // Helper methods (implementation depends on your existing infrastructure)
  private getExistingTable(tableName: string): cdk.aws_dynamodb.ITable {
    return cdk.aws_dynamodb.Table.fromTableName(this, tableName, tableName);
  }

  private getExistingBucket(bucketName: string): cdk.aws_s3.IBucket {
    return cdk.aws_s3.Bucket.fromBucketName(this, bucketName, bucketName);
  }

  private getExistingKey(keyAlias: string): cdk.aws_kms.IKey {
    return cdk.aws_kms.Key.fromLookup(this, keyAlias, { aliasName: `alias/${keyAlias}` });
  }

  private getParameter(paramName: string): string {
    return cdk.aws_ssm.StringParameter.valueForStringParameter(this, paramName);
  }

  private getExistingApiGateway(_apiName: string): cdk.aws_apigateway.RestApi {
    // Implementation depends on how you reference existing API Gateway
    throw new Error('Implement based on your infrastructure');
  }

  private getCognitoAuthorizer(): cdk.aws_apigateway.IAuthorizer {
    // Implementation depends on your Cognito setup
    throw new Error('Implement based on your infrastructure');
  }
}

/**
 * Example: Updating auth service to record consent during registration
 */
export class AuthServiceWithConsent {
  async registerUser(userData: any): Promise<void> {
    // 1. Create user in Cognito
    const userId = await this.createCognitoUser(userData);

    // 2. Store user in DynamoDB
    await this.storeUserProfile(userId, userData);

    // 3. Record consent
    await this.recordConsent(userId, userData.consents);

    // 4. Send OTP
    await this.sendOTP(userData.phone);
  }

  private async recordConsent(userId: string, consents: any[]): Promise<void> {
    // Call compliance service to record consent
    const response = await fetch('/compliance/consent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getServiceToken()}`,
      },
      body: JSON.stringify({
        userId,
        consents,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to record consent');
    }
  }

  private createCognitoUser(_userData: any): Promise<string> {
    // Implementation
    return Promise.resolve('user-id');
  }

  private storeUserProfile(_userId: string, _userData: any): Promise<void> {
    // Implementation
    return Promise.resolve();
  }

  private sendOTP(_phone: string): Promise<void> {
    // Implementation
    return Promise.resolve();
  }

  private getServiceToken(): string {
    // Implementation
    return 'service-token';
  }
}

/**
 * Example: Frontend integration for consent management
 */
export const ConsentFormExample = `
import React, { useState } from 'react';

interface ConsentType {
  type: string;
  label: string;
  description: string;
  required: boolean;
}

const consentTypes: ConsentType[] = [
  {
    type: 'data_processing',
    label: 'Data Processing',
    description: 'We need to process your data to provide roadside assistance services.',
    required: true,
  },
  {
    type: 'location_tracking',
    label: 'Location Tracking',
    description: 'We need to track your location to dispatch vendors and provide real-time updates.',
    required: true,
  },
  {
    type: 'call_recording',
    label: 'Call Recording',
    description: 'We record calls for quality assurance and training purposes.',
    required: true,
  },
  {
    type: 'marketing_communications',
    label: 'Marketing Communications',
    description: 'Receive updates about new features and special offers.',
    required: false,
  },
  {
    type: 'data_sharing',
    label: 'Data Sharing',
    description: 'Share anonymized data for analytics and service improvement.',
    required: false,
  },
];

export function ConsentForm({ onSubmit }: { onSubmit: (consents: any[]) => void }) {
  const [consents, setConsents] = useState<Record<string, boolean>>(
    consentTypes.reduce((acc, ct) => ({ ...acc, [ct.type]: ct.required }), {})
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const consentArray = Object.entries(consents).map(([type, granted]) => ({
      type,
      granted,
      version: '1.0',
    }));
    
    onSubmit(consentArray);
  };

  return (
    <form onSubmit={handleSubmit}>
      <h2>Privacy & Consent</h2>
      <p>Please review and accept the following consents to continue:</p>
      
      {consentTypes.map((ct) => (
        <div key={ct.type}>
          <label>
            <input
              type="checkbox"
              checked={consents[ct.type]}
              onChange={(e) => setConsents({ ...consents, [ct.type]: e.target.checked })}
              disabled={ct.required}
            />
            {ct.label} {ct.required && '(Required)'}
          </label>
          <p>{ct.description}</p>
        </div>
      ))}
      
      <button type="submit">Continue</button>
      
      <p>
        By continuing, you agree to our{' '}
        <a href="/privacy-policy">Privacy Policy</a> and{' '}
        <a href="/terms-of-service">Terms of Service</a>.
      </p>
    </form>
  );
}
`;
