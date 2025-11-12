// S3 client wrapper

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '@roadcall/utils';

export class S3Wrapper {
  private client: S3Client;

  constructor(region?: string) {
    this.client = new S3Client({
      region: region || process.env.AWS_REGION || 'us-east-1',
    });
  }

  async upload(
    bucket: string,
    key: string,
    body: Buffer | string,
    contentType?: string
  ): Promise<void> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body,
          ContentType: contentType,
          ServerSideEncryption: 'aws:kms',
        })
      );

      logger.info('S3 upload successful', { bucket, key });
    } catch (error) {
      logger.error('S3 upload error', error as Error, { bucket, key });
      throw error;
    }
  }

  async download(bucket: string, key: string): Promise<Buffer> {
    try {
      const result = await this.client.send(
        new GetObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      const stream = result.Body as ReadableStream;
      const chunks: Uint8Array[] = [];

      const reader = stream.getReader();
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        if (value) {
          chunks.push(value);
        }
        done = streamDone;
      }

      return Buffer.concat(chunks);
    } catch (error) {
      logger.error('S3 download error', error as Error, { bucket, key });
      throw error;
    }
  }

  async delete(bucket: string, key: string): Promise<void> {
    try {
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );

      logger.info('S3 delete successful', { bucket, key });
    } catch (error) {
      logger.error('S3 delete error', error as Error, { bucket, key });
      throw error;
    }
  }

  async exists(bucket: string, key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: bucket,
          Key: key,
        })
      );
      return true;
    } catch (error) {
      return false;
    }
  }

  async getPresignedUrl(
    bucket: string,
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('S3 presigned URL error', error as Error, { bucket, key });
      throw error;
    }
  }

  async getPresignedUploadUrl(
    bucket: string,
    key: string,
    contentType?: string,
    expiresIn: number = 3600
  ): Promise<string> {
    try {
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ServerSideEncryption: 'aws:kms',
      });

      return await getSignedUrl(this.client, command, { expiresIn });
    } catch (error) {
      logger.error('S3 presigned upload URL error', error as Error, { bucket, key });
      throw error;
    }
  }
}

// Singleton instance
export const s3 = new S3Wrapper();
