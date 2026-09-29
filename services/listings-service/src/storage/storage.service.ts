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

  async uploadListingImage(file: Express.Multer.File): Promise<{ imageUrl: string; thumbnailUrl: string }> {
    const fileId = randomUUID();
    
    // Process main image: 1200x1200, 85%
    const imageBuffer = await sharp(file.buffer)
      .resize(1200, 1200, { fit: 'inside' })
      .jpeg({ quality: 85 })
      .toBuffer();
      
    // Process thumbnail: 300x300, 70%
    const thumbBuffer = await sharp(file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 70 })
      .toBuffer();

    const imageFilename = `listings/${fileId}.jpeg`;
    const thumbFilename = `listings/${fileId}_thumb.jpeg`;

    if (this.useS3) {
      const upload = async (key: string, buffer: Buffer) => {
        const command = new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: 'image/jpeg',
          ACL: 'public-read',
        });
        await this.s3Client.send(command);
        return `https://${this.bucket}.s3.amazonaws.com/${key}`;
      };

      const [imageUrl, thumbnailUrl] = await Promise.all([
        upload(imageFilename, imageBuffer),
        upload(thumbFilename, thumbBuffer)
      ]);

      return { imageUrl, thumbnailUrl };
    } else {
      // Mock upload
      const tmpDir = path.join(process.cwd(), 'tmp', 'listings');
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      
      fs.writeFileSync(path.join(tmpDir, path.basename(imageFilename)), imageBuffer);
      fs.writeFileSync(path.join(tmpDir, path.basename(thumbFilename)), thumbBuffer);
      
      return {
        imageUrl: localMediaUrl('listings', path.basename(imageFilename)),
        thumbnailUrl: localMediaUrl('listings', path.basename(thumbFilename)),
      };
    }
  }
}
