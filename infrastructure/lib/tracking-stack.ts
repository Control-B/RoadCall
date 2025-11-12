import * as cdk from 'aws-cdk-lib';
import * as appsync from 'aws-cdk-lib/aws-appsync';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaEventSources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as location from 'aws-cdk-lib/aws-location';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import { Construct } from 'constructs';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

export interface TrackingStackProps extends cdk.StackProps {
  stage: string;
  trackingSessionsTable: dynamodb.Table;
  incidentsTable: dynamodb.Table;
  eventBus: events.EventBus;
  webAcl?: cdk.aws_wafv2.CfnWebACL;
}

export class TrackingStack extends cdk.Stack {
  public readonly api: appsync.GraphqlApi;
  public readonly tracker: location.CfnTracker;
  public readonly geofenceCollection: location.CfnGeofenceCollection;
  public readonly routeCalculator: location.CfnRouteCalculator;

  constructor(scope: Construct, id: string, props: TrackingStackProps) {
    super(scope, id, props);

    const { stage, trackingSessionsTable, incidentsTable, eventBus, webAcl } = props;

    // ========================================================================
    // AWS Location Service Resources
    // ========================================================================

    // Route Calculator for ETA calculations with traffic data
    this.routeCalculator = new location.CfnRouteCalculator(this, 'RouteCalculator', {
      calculatorName: `roadcall-route-calculator-${stage}`,
      dataSource: 'Here', // HERE Technologies provides traffic data
      description: 'Route calculator for vendor ETA with real-time traffic',
      pricingPlan: 'RequestBasedUsage',
    });

    // Tracker for vendor location updates
    this.tracker = new location.CfnTracker(this, 'VendorTracker', {
      trackerName: `roadcall-vendor-tracker-${stage}`,
      description: 'Tracks vendor locations in real-time',
      pricingPlan: 'RequestBasedUsage',
      positionFiltering: 'TimeBased', // Filter updates based on time (10 seconds)
    });

    // Geofence Collection for arrival detection
    this.geofenceCollection = new location.CfnGeofenceCollection(this, 'GeofenceCollection', {
      collectionName: `roadcall-geofences-${stage}`,
      description: 'Geofences for incident arrival detection (100m radius)',
      pricingPlan: 'RequestBasedUsage',
    });

    // Associate tracker with geofence collection for automatic arrival detection
    new location.CfnTrackerConsumer(this, 'TrackerGeofenceAssociation', {
      consumerArn: this.geofenceCollection.attrCollectionArn,
      trackerName: this.tracker.trackerName,
    });

    // ========================================================================
    // AppSync GraphQL API
    // ========================================================================

    // Create CloudWatch Logs role for AppSync
    const logsRole = new iam.Role(this, 'AppSyncLogsRole', {
      assumedBy: new iam.ServicePrincipal('appsync.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSAppSyncPushToCloudWatchLogs'
        ),
      ],
    });

    // Create AppSync API
    this.api = new appsync.GraphqlApi(this, 'TrackingApi', {
      name: `roadcall-tracking-api-${stage}`,
      definition: appsync.Definition.fromFile(
        path.join(__dirname, '../../services/tracking-svc/src/schema.graphql')
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.IAM,
        },
        additionalAuthorizationModes: [
          {
            authorizationType: appsync.AuthorizationType.API_KEY,
            apiKeyConfig: {
              expires: cdk.Expiration.after(cdk.Duration.days(365)),
            },
          },
        ],
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
        role: logsRole,
        retention: logs.RetentionDays.ONE_WEEK,
      },
      xrayEnabled: true,
    });

    // Associate WAF with AppSync API if provided
    if (webAcl) {
      new cdk.aws_wafv2.CfnWebACLAssociation(this, 'AppSyncWafAssociation', {
        resourceArn: this.api.arn,
        webAclArn: webAcl.attrArn,
      });

      new cdk.CfnOutput(this, 'AppSyncWebAclArn', {
        value: webAcl.attrArn,
        description: 'WAF Web ACL ARN attached to AppSync API',
        exportName: `${stage}-AppSyncWebAclArn`,
      });
    }

    // ========================================================================
    // Lambda Resolvers
    // ========================================================================

    const commonLambdaProps = {
      runtime: lambda.Runtime.NODEJS_20_X,
      architecture: lambda.Architecture.ARM_64,
      timeout: cdk.Duration.seconds(30),
      memorySize: 1024,
      tracing: lambda.Tracing.ACTIVE,
      environment: {
        TABLE_NAME: trackingSessionsTable.tableName,
        INCIDENTS_TABLE_NAME: incidentsTable.tableName,
        POWERTOOLS_SERVICE_NAME: 'tracking-svc',
        POWERTOOLS_LOG_LEVEL: stage === 'prod' ? 'INFO' : 'DEBUG',
        LOCATION_CALCULATOR_NAME: this.routeCalculator.calculatorName,
        LOCATION_TRACKER_NAME: this.tracker.trackerName,
        GEOFENCE_COLLECTION_NAME: this.geofenceCollection.collectionName,
        EVENT_BUS_NAME: eventBus.eventBusName,
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    };

    // Start Tracking Handler
    const startTrackingHandler = new NodejsFunction(this, 'StartTrackingHandler', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../services/tracking-svc/src/handlers/start-tracking.ts'),
      handler: 'handler',
      functionName: `roadcall-start-tracking-${stage}`,
    });

    trackingSessionsTable.grantReadWriteData(startTrackingHandler);
    incidentsTable.grantReadData(startTrackingHandler);

    // Grant Location Service permissions
    startTrackingHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'geo:CalculateRoute',
          'geo:BatchUpdateDevicePosition',
          'geo:PutGeofence',
          'geo:BatchPutGeofence',
        ],
        resources: [
          this.routeCalculator.attrCalculatorArn,
          this.tracker.attrTrackerArn,
          this.geofenceCollection.attrCollectionArn,
        ],
      })
    );

    // Grant EventBridge permissions
    startTrackingHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      })
    );

    // Update Vendor Location Handler
    const updateVendorLocationHandler = new NodejsFunction(
      this,
      'UpdateVendorLocationHandler',
      {
        ...commonLambdaProps,
        entry: path.join(
          __dirname,
          '../../services/tracking-svc/src/handlers/update-vendor-location.ts'
        ),
        handler: 'handler',
        functionName: `roadcall-update-vendor-location-${stage}`,
      }
    );

    trackingSessionsTable.grantReadWriteData(updateVendorLocationHandler);

    updateVendorLocationHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          'geo:CalculateRoute',
          'geo:BatchUpdateDevicePosition',
          'geo:GetDevicePosition',
        ],
        resources: [this.routeCalculator.attrCalculatorArn, this.tracker.attrTrackerArn],
      })
    );

    updateVendorLocationHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      })
    );

    // Stop Tracking Handler
    const stopTrackingHandler = new NodejsFunction(this, 'StopTrackingHandler', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../services/tracking-svc/src/handlers/stop-tracking.ts'),
      handler: 'handler',
      functionName: `roadcall-stop-tracking-${stage}`,
    });

    trackingSessionsTable.grantReadWriteData(stopTrackingHandler);

    // Get Tracking Session Handler
    const getTrackingSessionHandler = new NodejsFunction(this, 'GetTrackingSessionHandler', {
      ...commonLambdaProps,
      entry: path.join(
        __dirname,
        '../../services/tracking-svc/src/handlers/get-tracking-session.ts'
      ),
      handler: 'handler',
      functionName: `roadcall-get-tracking-session-${stage}`,
    });

    trackingSessionsTable.grantReadData(getTrackingSessionHandler);

    // Get Active Session By Incident Handler
    const getActiveSessionByIncidentHandler = new NodejsFunction(
      this,
      'GetActiveSessionByIncidentHandler',
      {
        ...commonLambdaProps,
        entry: path.join(
          __dirname,
          '../../services/tracking-svc/src/handlers/get-active-session-by-incident.ts'
        ),
        handler: 'handler',
        functionName: `roadcall-get-active-session-by-incident-${stage}`,
      }
    );

    trackingSessionsTable.grantReadData(getActiveSessionByIncidentHandler);

    // Geofence Event Handler (triggered by Location Service geofence events)
    const geofenceEventHandler = new NodejsFunction(this, 'GeofenceEventHandler', {
      ...commonLambdaProps,
      entry: path.join(
        __dirname,
        '../../services/tracking-svc/src/handlers/handle-geofence-event.ts'
      ),
      handler: 'handler',
      functionName: `roadcall-geofence-event-${stage}`,
    });

    trackingSessionsTable.grantReadWriteData(geofenceEventHandler);
    incidentsTable.grantReadWriteData(geofenceEventHandler);

    geofenceEventHandler.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['events:PutEvents'],
        resources: [eventBus.eventBusArn],
      })
    );

    // EventBridge rule for geofence ENTER events
    const geofenceRule = new events.Rule(this, 'GeofenceEnterRule', {
      eventBus: eventBus,
      eventPattern: {
        source: ['aws.geo'],
        detailType: ['Location Geofence Event'],
        detail: {
          EventType: ['ENTER'],
        },
      },
      description: 'Triggers when vendor enters incident geofence (arrival detection)',
    });

    geofenceRule.addTarget(new targets.LambdaFunction(geofenceEventHandler));

    // ETA Recalculation Handler (triggered by DynamoDB Streams)
    const etaRecalculationHandler = new NodejsFunction(this, 'ETARecalculationHandler', {
      ...commonLambdaProps,
      entry: path.join(__dirname, '../../services/tracking-svc/src/handlers/recalculate-eta.ts'),
      handler: 'handler',
      functionName: `roadcall-eta-recalculation-${stage}`,
    });

    trackingSessionsTable.grantReadData(etaRecalculationHandler);
    trackingSessionsTable.grantStreamRead(etaRecalculationHandler);

    // Add DynamoDB Stream event source
    etaRecalculationHandler.addEventSource(
      new lambdaEventSources.DynamoEventSource(trackingSessionsTable, {
        startingPosition: lambda.StartingPosition.LATEST,
        batchSize: 10,
        maxBatchingWindow: cdk.Duration.seconds(2), // Process within 2 seconds
        retryAttempts: 2,
        bisectBatchOnError: true,
        reportBatchItemFailures: true,
      })
    );

    // ========================================================================
    // AppSync Data Sources
    // ========================================================================

    const startTrackingDataSource = this.api.addLambdaDataSource(
      'StartTrackingDataSource',
      startTrackingHandler
    );

    const updateVendorLocationDataSource = this.api.addLambdaDataSource(
      'UpdateVendorLocationDataSource',
      updateVendorLocationHandler
    );

    const stopTrackingDataSource = this.api.addLambdaDataSource(
      'StopTrackingDataSource',
      stopTrackingHandler
    );

    const getTrackingSessionDataSource = this.api.addLambdaDataSource(
      'GetTrackingSessionDataSource',
      getTrackingSessionHandler
    );

    const getActiveSessionByIncidentDataSource = this.api.addLambdaDataSource(
      'GetActiveSessionByIncidentDataSource',
      getActiveSessionByIncidentHandler
    );

    // ========================================================================
    // AppSync Resolvers
    // ========================================================================

    // Mutation: startTracking
    startTrackingDataSource.createResolver('StartTrackingResolver', {
      typeName: 'Mutation',
      fieldName: 'startTracking',
      cachingConfig: {
        ttl: cdk.Duration.seconds(0), // No caching for mutations
      },
    });

    // Mutation: updateVendorLocation
    updateVendorLocationDataSource.createResolver('UpdateVendorLocationResolver', {
      typeName: 'Mutation',
      fieldName: 'updateVendorLocation',
      cachingConfig: {
        ttl: cdk.Duration.seconds(0), // No caching for mutations
      },
    });

    // Mutation: stopTracking
    stopTrackingDataSource.createResolver('StopTrackingResolver', {
      typeName: 'Mutation',
      fieldName: 'stopTracking',
      cachingConfig: {
        ttl: cdk.Duration.seconds(0), // No caching for mutations
      },
    });

    // Query: getTrackingSession
    getTrackingSessionDataSource.createResolver('GetTrackingSessionResolver', {
      typeName: 'Query',
      fieldName: 'getTrackingSession',
      cachingConfig: {
        ttl: cdk.Duration.seconds(5), // 5-second cache as per requirements
      },
    });

    // Query: getActiveSessionByIncident
    getActiveSessionByIncidentDataSource.createResolver('GetActiveSessionByIncidentResolver', {
      typeName: 'Query',
      fieldName: 'getActiveSessionByIncident',
      cachingConfig: {
        ttl: cdk.Duration.seconds(5), // 5-second cache as per requirements
      },
    });

    // ========================================================================
    // Outputs
    // ========================================================================

    new cdk.CfnOutput(this, 'GraphQLApiUrl', {
      value: this.api.graphqlUrl,
      exportName: `${stage}-TrackingGraphQLApiUrl`,
      description: 'AppSync GraphQL API URL for tracking service',
    });

    new cdk.CfnOutput(this, 'GraphQLApiId', {
      value: this.api.apiId,
      exportName: `${stage}-TrackingGraphQLApiId`,
      description: 'AppSync GraphQL API ID',
    });

    new cdk.CfnOutput(this, 'GraphQLApiKey', {
      value: this.api.apiKey || 'N/A',
      exportName: `${stage}-TrackingGraphQLApiKey`,
      description: 'AppSync API Key (for development)',
    });

    // Tag all resources
    cdk.Tags.of(this).add('Stack', 'Tracking');
    cdk.Tags.of(this).add('Service', 'tracking-svc');
  }
}
