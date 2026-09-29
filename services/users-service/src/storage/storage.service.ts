import { Injectable, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import sharp from 'sharp';
import * as path from 'path';
import * as fs from 'fs';
import { randomUUID } from 'crypto';

/**
 * Public URL of a locally stored file (STORAGE_PROVIDER is not "s3", i.e. development):
 * served by this service under /media and reached through the gateway, so phones and
 * browsers load it from the same address as the API. PUBLIC_API_URL is the gateway as
 * clients see it (http://<computer's Wi-Fi IP>:3000/api/v1 when testing on a phone).
 */
export function localMediaUrl(kind: string, filename: string): string {
  const base = (process.env.PUBLIC_API_URL || 'http://localhost:3000/api/v1').replace(/\/+$/, '');
  return `${base}/media/${kind}/${filename}`;
}

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client;
  private readonly bucket: string;
  private readonly useS3: boolean;

  constructor() {
    this.useS3 = process.env.STORAGE_PROVIDER === 's3';
    if (this.useS3) {
      this.s3Client = new S3Client({
        region: process.env.AWS_REGION || 'us-east-1',
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        },
      });
      this.bucket = process.env.AWS_S3_BUCKET;
    }
  }

  async uploadAvatar(file: Express.Multer.File): Promise<string> {
    // Compress image with sharp
    const compressedBuffer = await sharp(file.buffer)
      .resize(400, 400)
      .jpeg({ quality: 85 })
      .toBuffer();

    const filename = `avatars/${randomUUID()}.jpeg`;

    if (this.useS3) {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: filename,
        Body: compressedBuffer,
        ContentType: 'image/jpeg',
        ACL: 'public-read',
      });
      await this.s3Client.send(command);
      return `https://${this.bucket}.s3.amazonaws.com/${filename}`;
    } else {
      // Mock upload
      const tmpDir = path.join(process.cwd(), 'tmp', 'avatars');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      const filepath = path.join(tmpDir, path.basename(filename));
      fs.writeFileSync(filepath, compressedBuffer);
      
      return localMediaUrl('avatars', path.basename(filename));
    }
  }
}
