import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  AdminGuard,
  InternalGuard,
  JwtAuthGuard,
  requireSecret,
  safeEqual,
  verifyAccessToken,
} from './security';

const jwt = new JwtService();
const sign = (payload: object, secret = process.env.JWT_ACCESS_SECRET!) =>
  jwt.sign(payload, { secret, expiresIn: '15m' });

const contextFor = (headers: Record<string, string>) => {
  const request: any = { headers };
  return {
    request,
    context: { switchToHttp: () => ({ getRequest: () => request }) } as any,
  };
};

describe('security helpers', () => {
  describe('requireSecret', () => {
    const original = { ...process.env };
    afterEach(() => {
      process.env = { ...original };
    });

    it('throws when the variable is missing', () => {
      delete process.env.SOME_SECRET;
      expect(() => requireSecret('SOME_SECRET')).toThrow('Missing required environment variable SOME_SECRET');
    });

    it('rejects short secrets in production', () => {
      process.env.NODE_ENV = 'production';
      process.env.SOME_SECRET = 'short';
      expect(() => requireSecret('SOME_SECRET')).toThrow('at least 32 characters');
    });
  });

  describe('safeEqual', () => {
    it('compares values without accepting non-strings', () => {
      expect(safeEqual('abc', 'abc')).toBe(true);
      expect(safeEqual('abd', 'abc')).toBe(false);
      expect(safeEqual(undefined, 'abc')).toBe(false);
      expect(safeEqual(['abc'], 'abc')).toBe(false);
    });
  });

  describe('verifyAccessToken', () => {
    it('accepts a token signed with the shared secret', () => {
      const user = verifyAccessToken(sign({ sub: 'u-1', role: 'user' }));
      expect(user).toEqual({ userId: 'u-1', email: undefined, role: 'user' });
    });

    it('rejects a token signed with another secret (forged)', () => {
      expect(() => verifyAccessToken(sign({ sub: 'u-1', role: 'admin' }, 'your-secret-key'))).toThrow(
        UnauthorizedException,
      );
    });

    it('rejects an unsigned token', () => {
      const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
      const body = Buffer.from(JSON.stringify({ sub: 'victim' })).toString('base64url');
      expect(() => verifyAccessToken(`${header}.${body}.`)).toThrow(UnauthorizedException);
    });

    it('rejects an expired token', () => {
      const expired = jwt.sign(
        { sub: 'u-1', exp: Math.floor(Date.now() / 1000) - 60 },
        { secret: process.env.JWT_ACCESS_SECRET! },
      );
      expect(() => verifyAccessToken(expired)).toThrow(UnauthorizedException);
    });
  });

  describe('guards', () => {
    it('JwtAuthGuard sets req.user for a valid token', () => {
      const { context, request } = contextFor({ authorization: `Bearer ${sign({ sub: 'u-1' })}` });
      expect(new JwtAuthGuard().canActivate(context)).toBe(true);
      expect(request.user.userId).toBe('u-1');
    });

    it('JwtAuthGuard rejects requests without a token', () => {
      const { context } = contextFor({});
      expect(() => new JwtAuthGuard().canActivate(context)).toThrow(UnauthorizedException);
    });

    it('AdminGuard rejects non-admin users', () => {
      const { context } = contextFor({ authorization: `Bearer ${sign({ sub: 'u-1', role: 'user' })}` });
      expect(() => new AdminGuard().canActivate(context)).toThrow(ForbiddenException);
    });

    it('AdminGuard accepts admins', () => {
      const { context } = contextFor({ authorization: `Bearer ${sign({ sub: 'a-1', role: 'admin' })}` });
      expect(new AdminGuard().canActivate(context)).toBe(true);
    });

    it('InternalGuard rejects the old hardcoded secrets', () => {
      for (const secret of ['marad-internal-secret-for-webhooks', 'secret123']) {
        const { context } = contextFor({ 'x-internal-secret': secret });
        expect(() => new InternalGuard().canActivate(context)).toThrow(UnauthorizedException);
      }
    });

    it('InternalGuard accepts the configured secret', () => {
      const { context } = contextFor({ 'x-internal-secret': process.env.INTERNAL_SECRET! });
      expect(new InternalGuard().canActivate(context)).toBe(true);
    });
  });
});
