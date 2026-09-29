import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { StorageService } from './storage.service';

/**
 * Uses the real sharp (no mock): a default import of sharp compiled to `undefined` and
 * every image upload failed with a 500 while mocked unit tests stayed green.
 */
describe('StorageService (local storage, real sharp)', () => {
  const cwd = process.cwd();
  let dir: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'listings-storage-'));
    process.chdir(dir);
    process.env.PUBLIC_API_URL = 'http://192.168.1.20:3000/api/v1/';
  });

  afterAll(() => {
    process.chdir(cwd);
    fs.rmSync(dir, { recursive: true, force: true });
    delete process.env.PUBLIC_API_URL;
  });

  it('resizes the image, writes image and thumbnail, and returns gateway media URLs', async () => {
    const sharp = require('sharp');
    const png = await sharp({ create: { width: 64, height: 48, channels: 3, background: '#0d9488' } }).png().toBuffer();

    const { imageUrl, thumbnailUrl } = await new StorageService().uploadListingImage({ buffer: png } as Express.Multer.File);

    expect(imageUrl).toMatch(/^http:\/\/192\.168\.1\.20:3000\/api\/v1\/media\/listings\/[0-9a-f-]+\.jpeg$/);
    expect(thumbnailUrl).toMatch(/_thumb\.jpeg$/);
    const written = fs.readdirSync(path.join(dir, 'tmp', 'listings'));
    expect(written).toHaveLength(2);
    const meta = await sharp(path.join(dir, 'tmp', 'listings', path.basename(thumbnailUrl))).metadata();
    expect(meta.format).toBe('jpeg');
  });
});
