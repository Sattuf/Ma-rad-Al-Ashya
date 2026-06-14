import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('GOOGLE_CLIENT_ID', 'mock_google_id'),
      clientSecret: configService.get<string>('GOOGLE_CLIENT_SECRET', 'mock_google_secret'),
      callbackURL: configService.get<string>(
        'GOOGLE_CALLBACK_URL',
        'http://localhost:3001/google/callback',
      ),
      scope: ['email', 'profile'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: VerifyCallback,
  ): Promise<any> {
    const { id, name, emails, photos } = profile;
    const user = {
      id,
      email: emails?.[0]?.value || null,
      firstName: name?.givenName || '',
      lastName: name?.familyName || '',
      displayName: profile.displayName || `${name?.givenName || ''} ${name?.familyName || ''}`.trim(),
      picture: photos?.[0]?.value || null,
      accessToken,
    };
    done(null, user);
  }
}
