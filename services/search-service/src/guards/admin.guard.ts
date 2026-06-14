import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException('Authorization header missing');
    }

    const token = authHeader.split(' ')[1];
    try {
      const decoded: any = jwt.decode(token);
      if (decoded && decoded.role === 'admin') {
        return true;
      }
      throw new UnauthorizedException('Admin privileges required');
    } catch (err) {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
