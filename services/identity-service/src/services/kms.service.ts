import { Injectable, Logger } from '@nestjs/common';
import { KMSClient, EncryptCommand, DecryptCommand, CreateKeyCommand } from '@aws-sdk/client-kms';

@Injectable()
export class KmsService {
  private readonly kmsClient: KMSClient;
  private readonly logger = new Logger(KmsService.name);

  constructor() {
    this.kmsClient = new KMSClient({
      region: process.env.AWS_REGION || 'me-south-1',
      endpoint: process.env.KMS_ENDPOINT || 'http://localhost:4566',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test',
      },
    });
  }

  async createKey(): Promise<string> {
    try {
      const command = new CreateKeyCommand({
        Description: 'Key for encrypting KYC data',
        KeyUsage: 'ENCRYPT_DECRYPT',
      });
      const response = await this.kmsClient.send(command);
      if (!response.KeyMetadata?.KeyId) {
        throw new Error('KeyMetadata or KeyId is missing from KMS response');
      }
      return response.KeyMetadata.KeyId;
    } catch (error) {
      this.logger.error(`Failed to create KMS key: ${error.message}`);
      throw error;
    }
  }

  async encrypt(data: any, keyId?: string): Promise<{ encryptedData: Buffer; keyId: string }> {
    try {
      const targetKeyId = keyId || await this.createKey();
      
      const plaintext = Buffer.from(JSON.stringify(data));
      
      const command = new EncryptCommand({
        KeyId: targetKeyId,
        Plaintext: plaintext,
      });
      const response = await this.kmsClient.send(command);
      
      if (!response.CiphertextBlob) {
        throw new Error('CiphertextBlob is missing from KMS response');
      }
      
      return {
        encryptedData: Buffer.from(response.CiphertextBlob),
        keyId: targetKeyId,
      };
    } catch (error) {
      this.logger.error(`Failed to encrypt data: ${error.message}`);
      throw error;
    }
  }

  async decrypt(encryptedData: Buffer, keyId: string): Promise<any> {
    try {
      const command = new DecryptCommand({
        CiphertextBlob: encryptedData,
        KeyId: keyId,
      });
      const response = await this.kmsClient.send(command);
      if (!response.Plaintext) {
        throw new Error('Plaintext is missing from KMS response');
      }
      const plaintext = Buffer.from(response.Plaintext).toString('utf-8');
      
      return JSON.parse(plaintext);
    } catch (error) {
      this.logger.error(`Failed to decrypt data: ${error.message}`);
      throw error;
    }
  }
}
