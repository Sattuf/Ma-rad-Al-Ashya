import { Injectable, ExecutionContext, CallHandler, NestInterceptor, Inject } from '@nestjs/common';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private readonly allowedPaths = ['/api/v1/listings', '/api/v1/categories', '/api/v1/search'];

  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
    const request = context.switchToHttp().getRequest();
    const { method, originalUrl, headers } = request;

    if (method !== 'GET') {
      return next.handle();
    }

    if (headers.authorization) {
      return next.handle();
    }

    const isAllowedPath = this.allowedPaths.some(path => originalUrl.startsWith(path));
    if (!isAllowedPath) {
      return next.handle();
    }

    const cacheKey = `cache:${originalUrl}`;
    const cachedResponse = await this.cacheManager.get(cacheKey);

    if (cachedResponse) {
      return of(cachedResponse);
    }

    return next.handle().pipe(
      tap(async response => {
        await this.cacheManager.set(cacheKey, response, 30000); // 30 seconds in ms
      }),
    );
  }
}
