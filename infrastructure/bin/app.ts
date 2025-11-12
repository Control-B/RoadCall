#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { NetworkStack } from '../lib/network-stack';
import { DataStack } from '../lib/data-stack';
import { AuthStack } from '../lib/auth-stack';
import { WafStack } from '../lib/waf-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';
import { DriverStack } from '../lib/driver-stack';
import { VendorStack } from '../lib/vendor-stack';
import { IncidentStack } from '../lib/incident-stack';
import { MatchStack } from '../lib/match-stack';
import { TrackingStack } from '../lib/tracking-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { DisasterRecoveryStack } from '../lib/disaster-recovery-stack';

const app = new cdk.App();

// Get stage from context (dev, staging, prod)
const stage = app.node.tryGetContext('stage') || 'dev';

// Get AWS account and region from environment or use defaults
const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT || process.env.AWS_ACCOUNT_ID,
  region: process.env.CDK_DEFAULT_REGION || process.env.AWS_REGION || 'us-east-1',
};

// Get optional custom domain configuration from context
const domainName = app.node.tryGetContext('domainName');
const certificateArn = app.node.tryGetContext('certificateArn');
const hostedZoneId = app.node.tryGetContext('hostedZoneId');

// Deploy network infrastructure
const networkStack = new NetworkStack(app, `RoadcallNetworkStack-${stage}`, {
  stage,
  env,
  description: `AI Roadcall Assistant - Network Infrastructure (${stage})`,
});

// Deploy data infrastructure
const dataStack = new DataStack(app, `RoadcallDataStack-${stage}`, {
  stage,
  env,
  vpc: networkStack.vpc,
  kmsKey: networkStack.kmsKey,
  auroraSecurityGroup: networkStack.auroraSecurityGroup,
  elasticacheSecurityGroup: networkStack.elasticacheSecurityGroup,
  description: `AI Roadcall Assistant - Data Infrastructure (${stage})`,
});

// Deploy auth service (creates its own API for auth endpoints and provides authorizer)
const authStack = new AuthStack(app, `RoadcallAuthStack-${stage}`, {
  stage,
  env,
  usersTable: dataStack.usersTable,
  description: `AI Roadcall Assistant - Authentication Service (${stage})`,
});

// Deploy WAF with security rules
const wafStack = new WafStack(app, `RoadcallWafStack-${stage}`, {
  stage,
  env,
  scope: 'REGIONAL',
  description: `AI Roadcall Assistant - WAF Security Rules (${stage})`,
});

// Deploy centralized API Gateway with security controls
const apiGatewayStack = new ApiGatewayStack(app, `RoadcallApiGatewayStack-${stage}`, {
  stage,
  env,
  authorizer: authStack.authorizer,
  domainName,
  certificateArn,
  hostedZoneId,
  webAcl: wafStack.webAcl,
  description: `AI Roadcall Assistant - API Gateway (${stage})`,
});

// Deploy driver service
new DriverStack(app, `RoadcallDriverStack-${stage}`, {
  stage,
  env,
  api: apiGatewayStack.api,
  authorizer: authStack.authorizer,
  driversTable: dataStack.usersTable, // Drivers are stored in users table
  incidentsTable: dataStack.incidentsTable,
  description: `AI Roadcall Assistant - Driver Service (${stage})`,
});

// Deploy vendor service
new VendorStack(app, `RoadcallVendorStack-${stage}`, {
  stage,
  env,
  api: apiGatewayStack.api,
  authorizer: authStack.authorizer,
  vendorsTable: dataStack.vendorsTable,
  vpc: networkStack.vpc,
  redisCluster: dataStack.redisCluster,
  description: `AI Roadcall Assistant - Vendor Service (${stage})`,
});

// Deploy incident service
new IncidentStack(app, `RoadcallIncidentStack-${stage}`, {
  stage,
  env,
  api: apiGatewayStack.api,
  authorizer: authStack.authorizer,
  incidentsTable: dataStack.incidentsTable,
  mediaBucket: dataStack.incidentMediaBucket,
  eventBus: dataStack.eventBus,
  description: `AI Roadcall Assistant - Incident Service (${stage})`,
});

// Deploy match service
new MatchStack(app, `RoadcallMatchStack-${stage}`, {
  stage,
  env,
  api: apiGatewayStack.api,
  authorizer: authStack.authorizer,
  offersTable: dataStack.offersTable,
  vendorsTable: dataStack.vendorsTable,
  incidentsTable: dataStack.incidentsTable,
  eventBus: dataStack.eventBus,
  description: `AI Roadcall Assistant - Match Service (${stage})`,
});

// Deploy tracking service (uses AppSync GraphQL, not REST API)
new TrackingStack(app, `RoadcallTrackingStack-${stage}`, {
  stage,
  env,
  trackingSessionsTable: dataStack.trackingSessionsTable,
  incidentsTable: dataStack.incidentsTable,
  eventBus: dataStack.eventBus,
  webAcl: wafStack.webAcl,
  description: `AI Roadcall Assistant - Tracking Service (${stage})`,
});

// Deploy monitoring stack
const monitoringStack = new MonitoringStack(app, `RoadcallMonitoringStack-${stage}`, {
  serviceName: 'roadcall',
  environment: stage,
  alarmEmail: process.env.ALARM_EMAIL || 'ops@roadcall.example.com',
  env,
  description: `AI Roadcall Assistant - Monitoring and Observability (${stage})`,
});

// Deploy disaster recovery stack (only for production)
if (stage === 'prod') {
  const drRegion = app.node.tryGetContext('drRegion') || 'us-west-2';
  
  new DisasterRecoveryStack(app, `RoadcallDisasterRecoveryStack-${stage}`, {
    stage,
    env,
    primaryRegion: env.region || 'us-east-1',
    drRegion,
    domainName,
    hostedZoneId,
    alarmTopic: monitoringStack.alarmTopic,
    // Pass primary region resources for reference
    usersTable: dataStack.usersTable,
    incidentsTable: dataStack.incidentsTable,
    vendorsTable: dataStack.vendorsTable,
    offersTable: dataStack.offersTable,
    trackingSessionsTable: dataStack.trackingSessionsTable,
    callRecordsTable: dataStack.callRecordsTable,
    kbDocumentsTable: dataStack.kbDocumentsTable,
    notificationLogTable: dataStack.notificationLogTable,
    auroraCluster: dataStack.auroraCluster,
    callRecordingsBucket: dataStack.callRecordingsBucket,
    kbDocumentsBucket: dataStack.kbDocumentsBucket,
    incidentMediaBucket: dataStack.incidentMediaBucket,
    description: `AI Roadcall Assistant - Disaster Recovery (${stage})`,
  });
}

// Tags applied to all resources
cdk.Tags.of(app).add('Project', 'AI-Roadcall-Assistant');
cdk.Tags.of(app).add('Stage', stage);
cdk.Tags.of(app).add('ManagedBy', 'CDK');

app.synth();
