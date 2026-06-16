import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class DiditService {
  private readonly logger = new Logger(DiditService.name);
  private readonly apiUrl: string;
  private readonly apiKey: string;

  constructor(private readonly httpService: HttpService) {
    this.apiUrl = process.env.DIDIT_API_URL || 'https://api.didit.me';
    this.apiKey = process.env.DIDIT_API_KEY || 'dev-didit-api-key';
  }

  async createSession(userId: string): Promise<{ sessionId: string; sessionUrl: string }> {
    try {
      // In a real environment, this calls the actual Didit API.
      // For development/mock purposes, we can mock if API key is dev
      if (this.apiKey === 'dev-didit-api-key') {
        return {
          sessionId: `mock-session-${Date.now()}`,
          sessionUrl: `https://didit.me/verify/mock-session-${Date.now()}`,
        };
      }

      const response = await firstValueFrom(
        this.httpService.post(
          `${this.apiUrl}/v1/sessions`,
          {
            vendor_data: userId,
            callback_url: `${process.env.PUBLIC_URL || 'http://localhost:3000'}/identity/kyc/webhook`,
            features: "OCR,FACE_MATCH"
          },
          {
            headers: {
              Authorization: `Bearer ${this.apiKey}`,
            },
          },
        ),
      );

      return {
        sessionId: response.data.session_id,
        sessionUrl: response.data.url,
      };
    } catch (error) {
      this.logger.error(`Failed to create Didit session: ${error.message}`);
      throw error;
    }
  }

  async getSessionStatus(sessionId: string): Promise<any> {
    if (this.apiKey === 'dev-didit-api-key') {
      return { status: 'Approved', session_id: sessionId };
    }

    try {
      const response = await firstValueFrom(
        this.httpService.get(`${this.apiUrl}/v1/sessions/${sessionId}`, {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
          },
        }),
      );
      return response.data;
    } catch (error) {
      this.logger.error(`Failed to get Didit session status: ${error.message}`);
      throw error;
    }
  }
}
