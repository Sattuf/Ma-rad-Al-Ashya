import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-facebook';

@Injectable()
export class FacebookStrategy extends PassportStrategy(Strategy, 'facebook') {
  constructor(private configService: ConfigService) {
    super({
      clientID: configService.get<string>('FACEBOOK_APP_ID', 'mock_fb_id'),
      clientSecret: configService.get<string>('FACEBOOK_APP_SECRET', 'mock_fb_secret'),
      callbackURL: configService.get<string>(
        'FACEBOOK_CALLBACK_URL',
        'http://localhost:3001/facebook/callback',
      ),
      profileFields: ['id', 'name', 'emails', 'photos'],
      scope: ['email'],
    });
  }

  async validate(
    accessToken: string,
    refreshToken: string,
    profile: any,
    done: (err: any, user: any, info?: any) => void,
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
