import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly uploadDir = path.join(process.cwd(), 'uploads');

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

    this.logger.log(`File saved locally as mock S3: ${filepath}`);
    return `/uploads/${filename}`;
  }
}
