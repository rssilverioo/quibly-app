import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private s3: S3Client;
  private bucket: string;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.bucket = this.configService.get<string>('S3_BUCKET', 'quibly');

    this.s3 = new S3Client({
      region: 'auto',
      endpoint: this.configService.get<string>(
        'S3_ENDPOINT',
        'https://fly.storage.tigris.dev',
      ),
      credentials: {
        accessKeyId: this.configService.get<string>('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: this.configService.get<string>('S3_SECRET_ACCESS_KEY', ''),
      },
    });
  }

  /**
   * Upload a file and return a presigned URL (for private files like proof photos)
   */
  async uploadPrivate(
    filePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
      }),
    );

    return this.getSignedUrl(filePath);
  }

  /**
   * Upload a file with public-read access (for avatars)
   */
  async uploadPublic(
    filePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<string> {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: filePath,
        Body: buffer,
        ContentType: contentType,
        ACL: 'public-read',
      }),
    );

    const endpoint = this.configService.get<string>(
      'S3_ENDPOINT',
      'https://fly.storage.tigris.dev',
    );
    return `${endpoint}/${this.bucket}/${filePath}`;
  }

  /**
   * Delete a file from S3
   */
  async deleteObject(key: string): Promise<void> {
    await this.s3.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  /**
   * Get a presigned URL for a file (7 days expiry — S3 v4 max)
   */
  async getSignedUrl(filePath: string, expiresIn = 7 * 24 * 60 * 60): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: filePath,
    });
    return getSignedUrl(this.s3, command, { expiresIn });
  }
}
