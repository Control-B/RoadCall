import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  UpdateCommand,
} from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import {
  SystemConfig,
  ConfigAuditLog,
  ConfigVersion,
  ConfigKey,
} from '../types/config';

const client = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(client);

const CONFIG_TABLE_NAME = process.env.CONFIG_TABLE_NAME!;
const CONFIG_AUDIT_TABLE_NAME = process.env.CONFIG_AUDIT_TABLE_NAME!;
const CONFIG_VERSIONS_TABLE_NAME = process.env.CONFIG_VERSIONS_TABLE_NAME!;

export class ConfigManager {
  /**
   * Get the latest configuration for a given key
   */
  static async getLatestConfig(configKey: ConfigKey): Promise<SystemConfig | null> {
    const command = new QueryCommand({
      TableName: CONFIG_TABLE_NAME,
      IndexName: 'latest-version-index',
      KeyConditionExpression: 'configKey = :configKey AND isLatest = :isLatest',
      ExpressionAttributeValues: {
        ':configKey': configKey,
        ':isLatest': 'true',
      },
      Limit: 1,
    });

    const result = await docClient.send(command);
    return result.Items?.[0] as SystemConfig || null;
  }

  /**
   * Get a specific version of configuration
   */
  static async getConfigVersion(
    configKey: ConfigKey,
    version: number
  ): Promise<ConfigVersion | null> {
    const command = new GetCommand({
      TableName: CONFIG_VERSIONS_TABLE_NAME,
      Key: {
        configKey,
        version,
      },
    });

    const result = await docClient.send(command);
    return result.Item as ConfigVersion || null;
  }

  /**
   * Update configuration with versioning and audit logging
   */
  static async updateConfig(
    configKey: ConfigKey,
    value: any,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<SystemConfig> {
    // Get current config to determine next version
    const currentConfig = await this.getLatestConfig(configKey);
    const nextVersion = currentConfig ? currentConfig.version + 1 : 1;
    const timestamp = new Date().toISOString();

    // Mark old version as not latest
    if (currentConfig) {
      await docClient.send(
        new UpdateCommand({
          TableName: CONFIG_TABLE_NAME,
          Key: {
            configKey: currentConfig.configKey,
            version: currentConfig.version,
          },
          UpdateExpression: 'SET isLatest = :false',
          ExpressionAttributeValues: {
            ':false': 'false',
          },
        })
      );
    }

    // Create new config version
    const newConfig: SystemConfig = {
      configKey,
      version: nextVersion,
      value,
      isLatest: 'true',
      updatedBy: userId,
      updatedAt: timestamp,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONFIG_TABLE_NAME,
        Item: newConfig,
      })
    );

    // Save to versions table for rollback capability
    const configVersion: ConfigVersion = {
      configKey,
      version: nextVersion,
      value,
      createdBy: userId,
      createdAt: timestamp,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONFIG_VERSIONS_TABLE_NAME,
        Item: configVersion,
      })
    );

    // Create audit log
    const auditLog: ConfigAuditLog = {
      auditId: uuidv4(),
      configKey,
      userId,
      userName,
      action: currentConfig ? 'UPDATE' : 'CREATE',
      previousValue: currentConfig?.value,
      newValue: value,
      version: nextVersion,
      timestamp,
      reason,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONFIG_AUDIT_TABLE_NAME,
        Item: auditLog,
      })
    );

    return newConfig;
  }

  /**
   * Rollback to a previous configuration version
   */
  static async rollbackConfig(
    configKey: ConfigKey,
    targetVersion: number,
    userId: string,
    userName: string,
    reason?: string
  ): Promise<SystemConfig> {
    // Get the target version
    const targetConfig = await this.getConfigVersion(configKey, targetVersion);
    if (!targetConfig) {
      throw new Error(`Version ${targetVersion} not found for config ${configKey}`);
    }

    // Get current config
    const currentConfig = await this.getLatestConfig(configKey);
    if (!currentConfig) {
      throw new Error(`No current config found for ${configKey}`);
    }

    const timestamp = new Date().toISOString();
    const nextVersion = currentConfig.version + 1;

    // Mark old version as not latest
    await docClient.send(
      new UpdateCommand({
        TableName: CONFIG_TABLE_NAME,
        Key: {
          configKey: currentConfig.configKey,
          version: currentConfig.version,
        },
        UpdateExpression: 'SET isLatest = :false',
        ExpressionAttributeValues: {
          ':false': 'false',
        },
      })
    );

    // Create new config with rolled back value
    const rolledBackConfig: SystemConfig = {
      configKey,
      version: nextVersion,
      value: targetConfig.value,
      isLatest: 'true',
      updatedBy: userId,
      updatedAt: timestamp,
      description: `Rolled back to version ${targetVersion}`,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONFIG_TABLE_NAME,
        Item: rolledBackConfig,
      })
    );

    // Save to versions table
    const configVersion: ConfigVersion = {
      configKey,
      version: nextVersion,
      value: targetConfig.value,
      createdBy: userId,
      createdAt: timestamp,
      description: `Rolled back to version ${targetVersion}`,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONFIG_VERSIONS_TABLE_NAME,
        Item: configVersion,
      })
    );

    // Create audit log
    const auditLog: ConfigAuditLog = {
      auditId: uuidv4(),
      configKey,
      userId,
      userName,
      action: 'ROLLBACK',
      previousValue: currentConfig.value,
      newValue: targetConfig.value,
      version: nextVersion,
      timestamp,
      reason: reason || `Rolled back to version ${targetVersion}`,
    };

    await docClient.send(
      new PutCommand({
        TableName: CONFIG_AUDIT_TABLE_NAME,
        Item: auditLog,
      })
    );

    return rolledBackConfig;
  }

  /**
   * Get audit history for a configuration key
   */
  static async getAuditHistory(
    configKey: ConfigKey,
    limit: number = 50
  ): Promise<ConfigAuditLog[]> {
    const command = new QueryCommand({
      TableName: CONFIG_AUDIT_TABLE_NAME,
      IndexName: 'config-key-index',
      KeyConditionExpression: 'configKey = :configKey',
      ExpressionAttributeValues: {
        ':configKey': configKey,
      },
      ScanIndexForward: false, // Most recent first
      Limit: limit,
    });

    const result = await docClient.send(command);
    return (result.Items as ConfigAuditLog[]) || [];
  }

  /**
   * List all versions of a configuration
   */
  static async listVersions(configKey: ConfigKey): Promise<ConfigVersion[]> {
    const command = new QueryCommand({
      TableName: CONFIG_VERSIONS_TABLE_NAME,
      KeyConditionExpression: 'configKey = :configKey',
      ExpressionAttributeValues: {
        ':configKey': configKey,
      },
      ScanIndexForward: false, // Most recent first
    });

    const result = await docClient.send(command);
    return (result.Items as ConfigVersion[]) || [];
  }
}
