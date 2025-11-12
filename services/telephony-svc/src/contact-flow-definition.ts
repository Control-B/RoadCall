/**
 * Amazon Connect Contact Flow Definition
 * This file contains the contact flow configuration for the IVR system
 */

/**
 * Contact Flow Structure:
 * 
 * 1. Entry Point
 *    - Get customer phone number (ANI)
 *    - Invoke driver-lookup Lambda
 * 
 * 2. Driver Identification
 *    - If found: Welcome back message with driver name
 *    - If not found: New user registration flow
 * 
 * 3. New User Registration (if needed)
 *    - Collect phone number confirmation
 *    - Collect driver name
 *    - Collect company name
 *    - Collect truck number
 *    - Create user account (invoke auth-svc)
 * 
 * 4. Main Menu (IVR)
 *    - Press 1 for Tire Issue
 *    - Press 2 for Engine Issue
 *    - Press 3 for Towing Needed
 *    - Press 0 for Operator
 * 
 * 5. Location Collection
 *    - Attempt to get GPS coordinates from mobile
 *    - If unavailable, ask driver to describe location
 * 
 * 6. Incident Creation
 *    - Invoke create-incident-from-call Lambda
 *    - Confirm incident created
 *    - Provide incident ID
 * 
 * 7. Confirmation & Next Steps
 *    - "We're finding the nearest service provider"
 *    - "You'll receive a text message when a vendor is assigned"
 *    - "Thank you for calling"
 * 
 * 8. Call Recording
 *    - Enable call recording throughout
 *    - Store in S3 with encryption
 * 
 * 9. Post-Call Processing
 *    - Trigger post-call-processor Lambda
 *    - Transcribe call
 *    - Redact PII
 *    - Generate summary (future: Q in Connect)
 */

export interface ContactFlowConfig {
  name: string;
  description: string;
  type: 'CONTACT_FLOW' | 'CUSTOMER_QUEUE' | 'CUSTOMER_HOLD' | 'CUSTOMER_WHISPER' | 'AGENT_HOLD' | 'AGENT_WHISPER' | 'TRANSFER' | 'AGENT_TRANSFER';
  content: string; // JSON string of flow definition
}

/**
 * Main inbound contact flow configuration
 * This would be imported into Amazon Connect via AWS CLI or Console
 */
export const mainInboundFlow: ContactFlowConfig = {
  name: 'RoadcallAssistance-MainInbound',
  description: 'Main inbound flow for roadside assistance calls',
  type: 'CONTACT_FLOW',
  content: JSON.stringify({
    Version: '2019-10-30',
    StartAction: 'GetCustomerInput',
    Actions: [
      {
        Identifier: 'GetCustomerInput',
        Type: 'GetParticipantInput',
        Parameters: {
          Text: 'Welcome to Roadcall Assistance. Please hold while we look up your information.',
        },
        Transitions: {
          NextAction: 'InvokeDriverLookup',
        },
      },
      {
        Identifier: 'InvokeDriverLookup',
        Type: 'InvokeLambdaFunction',
        Parameters: {
          LambdaFunctionARN: '${DRIVER_LOOKUP_LAMBDA_ARN}',
          InvocationTimeLimitSeconds: '8',
        },
        Transitions: {
          NextAction: 'CheckDriverFound',
          Errors: [
            {
              ErrorType: 'NoMatchingError',
              NextAction: 'NewUserFlow',
            },
          ],
        },
      },
      {
        Identifier: 'CheckDriverFound',
        Type: 'Compare',
        Parameters: {
          ComparisonValue: '$.External.found',
        },
        Transitions: {
          NextAction: 'WelcomeBackMessage',
          Conditions: [
            {
              Condition: {
                Operator: 'Equals',
                Operands: ['true'],
              },
              NextAction: 'WelcomeBackMessage',
            },
          ],
          DefaultAction: 'NewUserFlow',
        },
      },
      {
        Identifier: 'WelcomeBackMessage',
        Type: 'MessageParticipant',
        Parameters: {
          Text: 'Welcome back, $.External.name. How can we help you today?',
        },
        Transitions: {
          NextAction: 'MainMenu',
        },
      },
      {
        Identifier: 'NewUserFlow',
        Type: 'MessageParticipant',
        Parameters: {
          Text: 'Welcome to Roadcall Assistance. It looks like this is your first time calling. We will need to collect some information.',
        },
        Transitions: {
          NextAction: 'MainMenu', // Simplified - in production would collect registration info
        },
      },
      {
        Identifier: 'MainMenu',
        Type: 'GetParticipantInput',
        Parameters: {
          Text: 'Please select the type of assistance you need. Press 1 for tire issues, Press 2 for engine problems, Press 3 for towing, or Press 0 to speak with an operator.',
          DTMF: {
            MaxDigits: '1',
            TerminatorDigits: '#',
            TimeoutSeconds: '5',
          },
        },
        Transitions: {
          NextAction: 'ProcessMenuSelection',
          Errors: [
            {
              ErrorType: 'NoMatchingError',
              NextAction: 'MainMenu',
            },
          ],
        },
      },
      {
        Identifier: 'ProcessMenuSelection',
        Type: 'Compare',
        Parameters: {
          ComparisonValue: '$.StoredCustomerInput',
        },
        Transitions: {
          Conditions: [
            {
              Condition: {
                Operator: 'Equals',
                Operands: ['1'],
              },
              NextAction: 'SetIncidentTypeTire',
            },
            {
              Condition: {
                Operator: 'Equals',
                Operands: ['2'],
              },
              NextAction: 'SetIncidentTypeEngine',
            },
            {
              Condition: {
                Operator: 'Equals',
                Operands: ['3'],
              },
              NextAction: 'SetIncidentTypeTow',
            },
            {
              Condition: {
                Operator: 'Equals',
                Operands: ['0'],
              },
              NextAction: 'TransferToOperator',
            },
          ],
          DefaultAction: 'MainMenu',
        },
      },
      {
        Identifier: 'SetIncidentTypeTire',
        Type: 'UpdateContactAttributes',
        Parameters: {
          Attributes: {
            incidentType: 'tire',
          },
        },
        Transitions: {
          NextAction: 'CollectLocation',
        },
      },
      {
        Identifier: 'SetIncidentTypeEngine',
        Type: 'UpdateContactAttributes',
        Parameters: {
          Attributes: {
            incidentType: 'engine',
          },
        },
        Transitions: {
          NextAction: 'CollectLocation',
        },
      },
      {
        Identifier: 'SetIncidentTypeTow',
        Type: 'UpdateContactAttributes',
        Parameters: {
          Attributes: {
            incidentType: 'tow',
          },
        },
        Transitions: {
          NextAction: 'CollectLocation',
        },
      },
      {
        Identifier: 'CollectLocation',
        Type: 'MessageParticipant',
        Parameters: {
          Text: 'Thank you. We are collecting your location information.',
        },
        Transitions: {
          NextAction: 'CreateIncident',
        },
      },
      {
        Identifier: 'CreateIncident',
        Type: 'InvokeLambdaFunction',
        Parameters: {
          LambdaFunctionARN: '${CREATE_INCIDENT_LAMBDA_ARN}',
          InvocationTimeLimitSeconds: '8',
          LambdaInvocationAttributes: {
            driverId: '$.External.driverId',
            incidentType: '$.Attributes.incidentType',
            latitude: '$.Attributes.latitude',
            longitude: '$.Attributes.longitude',
          },
        },
        Transitions: {
          NextAction: 'ConfirmIncidentCreated',
          Errors: [
            {
              ErrorType: 'NoMatchingError',
              NextAction: 'IncidentCreationFailed',
            },
          ],
        },
      },
      {
        Identifier: 'ConfirmIncidentCreated',
        Type: 'MessageParticipant',
        Parameters: {
          Text: 'Your assistance request has been received. We are now finding the nearest service provider. You will receive a text message when a vendor is assigned. Your incident number is $.External.incidentId. Thank you for calling Roadcall Assistance.',
        },
        Transitions: {
          NextAction: 'EndFlow',
        },
      },
      {
        Identifier: 'IncidentCreationFailed',
        Type: 'MessageParticipant',
        Parameters: {
          Text: 'We apologize, but we encountered an error creating your assistance request. Please try again or press 0 to speak with an operator.',
        },
        Transitions: {
          NextAction: 'MainMenu',
        },
      },
      {
        Identifier: 'TransferToOperator',
        Type: 'MessageParticipant',
        Parameters: {
          Text: 'Please hold while we connect you to an operator.',
        },
        Transitions: {
          NextAction: 'EndFlow', // Would transfer to queue in production
        },
      },
      {
        Identifier: 'EndFlow',
        Type: 'DisconnectParticipant',
        Parameters: {},
      },
    ],
  }),
};

/**
 * Prompts and messages used in contact flows
 */
export const contactFlowPrompts = {
  welcome: 'Welcome to Roadcall Assistance. Please hold while we look up your information.',
  welcomeBack: 'Welcome back, {name}. How can we help you today?',
  newUser: 'Welcome to Roadcall Assistance. It looks like this is your first time calling.',
  mainMenu:
    'Please select the type of assistance you need. Press 1 for tire issues, Press 2 for engine problems, Press 3 for towing, or Press 0 to speak with an operator.',
  collectingLocation: 'Thank you. We are collecting your location information.',
  incidentConfirmation:
    'Your assistance request has been received. We are now finding the nearest service provider. You will receive a text message when a vendor is assigned. Your incident number is {incidentId}. Thank you for calling Roadcall Assistance.',
  error: 'We apologize, but we encountered an error. Please try again or press 0 to speak with an operator.',
  transferToOperator: 'Please hold while we connect you to an operator.',
};
