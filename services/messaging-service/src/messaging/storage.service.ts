import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

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
  static readonly uploadDir = path.join(process.cwd(), 'uploads');
  private readonly uploadDir = StorageService.uploadDir;

  constructor() {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async uploadImage(file: Express.Multer.File): Promise<string> {
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e9)}.jpg`;
    const filepath = path.join(this.uploadDir, filename);

    await sharp(file.buffer)
      .resize(800)
      .jpeg({ quality: 80 })
      .toFile(filepath);

    return localMediaUrl('messages', filename);
  }
}
