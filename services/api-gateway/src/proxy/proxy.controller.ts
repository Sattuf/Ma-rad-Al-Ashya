import {
  Controller,
  All,
  Req,
  Res,
  Param,
  HttpException,
  HttpStatus,
  Logger,
  Optional,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { BLOCKED_ROUTES, SERVICES_CONFIG, ServiceConfig } from './services.config';
import { ResponseCacheService } from '../cache/response-cache.service';

const UPSTREAM_TIMEOUT_MS = parseInt(process.env.UPSTREAM_TIMEOUT_MS || '15000', 10);

/** Request headers forwarded to services. Anything else (e.g. x-internal-secret) is dropped. */
const FORWARDED_REQUEST_HEADERS = [
  'authorization',
  'content-type',
  'accept',
  'accept-language',
  'user-agent',
  'x-request-id',
  'x-correlation-id',
  // Webhook signatures, verified by the services against the raw body
  'stripe-signature',
  'x-signature',
  'x-didit-signature',
  'x-timestamp',
];

/** Response headers passed back to the client. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'cache-control', 'etag', 'location', 'content-disposition'];

/**
 * Normalizes the downstream path and rejects dot segments / encoded slashes, which could
 * otherwise walk past the route blocklist (e.g. /listings/../users/1/status).
 */
export function sanitizePath(path: string): string | null {
  const segments = path.split('/').filter((s) => s.length > 0);
  for (const segment of segments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (decoded === '.' || decoded === '..' || decoded.includes('/') || decoded.includes('\\')) {
      return null;
    }
  }
  return segments.join('/');
}

function toBuffer(data: unknown): Buffer {
  if (data === undefined || data === null) return Buffer.alloc(0);
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (typeof data === 'string') return Buffer.from(data);
  return Buffer.from(JSON.stringify(data));
}

export function isBlockedRoute(serviceName: string, method: string, forwardedPath: string): boolean {
  return BLOCKED_ROUTES.some(
    (route) =>
      route.service === serviceName &&
      (route.method === '*' || route.method === method.toUpperCase()) &&
      route.pattern.test(forwardedPath),
  );
}

/**
 * وحدة التحكم الوكيلة — Proxy Controller
 * توجه جميع الطلبات /api/v1/{service}/* إلى الخدمة المناسبة
 */
@ApiTags('Proxy')
@Controller('api/v1')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly serviceMap: Map<string, ServiceConfig>;

  constructor(
    private readonly httpService: HttpService,
    @Optional() private readonly cache?: ResponseCacheService,
  ) {
    this.serviceMap = new Map(SERVICES_CONFIG.map((service) => [service.prefix, service]));
  }

  @All(':servicePrefix')
  @ApiOperation({ summary: 'توجيه الطلبات للخدمات المصغرة — Proxy to microservice (root)' })
  @ApiParam({ name: 'servicePrefix', description: 'بادئة الخدمة (auth, listings, search, etc.)' })
  async proxyRoot(@Param('servicePrefix') servicePrefix: string, @Req() req: Request, @Res() res: Response) {
    return this.proxyRequest(servicePrefix, '', req, res);
  }

  // Express 4 wildcard: the remainder of the path is exposed as params[0].
  @All(':servicePrefix/*')
  @ApiOperation({ summary: 'توجيه الطلبات للخدمات المصغرة — Proxy to microservice (with path)' })
  async proxyWithPath(
    @Param('servicePrefix') servicePrefix: string,
    @Param('0') path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.proxyRequest(servicePrefix, path, req, res);
  }

  private async proxyRequest(servicePrefix: string, rawPath: string, req: Request, res: Response) {
    const service = this.serviceMap.get(servicePrefix);
    if (!service) {
      throw new HttpException({ statusCode: HttpStatus.NOT_FOUND, message: 'المسار غير موجود — Not found' }, HttpStatus.NOT_FOUND);
    }

    const path = sanitizePath(rawPath ?? '');
    if (path === null) {
      throw new HttpException({ statusCode: HttpStatus.BAD_REQUEST, message: 'مسار غير صالح — Invalid path' }, HttpStatus.BAD_REQUEST);
    }

    const forwardedPath = '/' + [service.stripPrefix === false ? service.prefix : '', path].filter(Boolean).join('/');
    if (isBlockedRoute(service.name, req.method, forwardedPath)) {
      throw new HttpException({ statusCode: HttpStatus.NOT_FOUND, message: 'المسار غير موجود — Not found' }, HttpStatus.NOT_FOUND);
    }

    const queryIndex = req.originalUrl.indexOf('?');
    const queryString = queryIndex >= 0 ? req.originalUrl.substring(queryIndex) : '';
    const fullUrl = `${service.url}${forwardedPath}${queryString}`;

    const cacheable =
      req.method === 'GET' && !req.headers.authorization && !!service.cacheTtlSeconds && !!this.cache;
    const cacheKey = `gw:cache:${service.name}:${forwardedPath}${queryString}`;
    if (cacheable) {
      const hit = await this.cache!.get(cacheKey);
      if (hit) {
        res.setHeader('x-cache', 'HIT');
        res.setHeader('content-type', hit.contentType);
        return res.status(hit.status).send(hit.body);
      }
    }

    const isMultipart = (req.headers['content-type'] ?? '').startsWith('multipart/form-data');
    const headers: Record<string, string> = {
      ...this.forwardHeaders(req),
      'x-forwarded-for': req.ip ?? '',
      'x-forwarded-host': req.hostname,
      'x-gateway-service': service.name,
    };
    if (isMultipart && req.headers['content-length']) {
      headers['content-length'] = req.headers['content-length'];
    }

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: fullUrl,
          // Multipart bodies are not parsed by the gateway: stream them through untouched.
          data: isMultipart ? req : ['GET', 'HEAD'].includes(req.method) ? undefined : req.body,
          headers,
          timeout: UPSTREAM_TIMEOUT_MS,
          responseType: 'arraybuffer',
          maxRedirects: 0,
          maxBodyLength: 20 * 1024 * 1024,
          validateStatus: () => true,
        }),
      );

      for (const header of FORWARDED_RESPONSE_HEADERS) {
        const value = response.headers[header];
        if (value !== undefined) res.setHeader(header, value as any);
      }

      const body = toBuffer(response.data);
      const contentType = String(response.headers['content-type'] ?? '');
      if (cacheable && response.status === 200 && contentType.includes('application/json')) {
        res.setHeader('x-cache', 'MISS');
        await this.cache!.set(
          cacheKey,
          { status: response.status, contentType, body: body.toString('utf8') },
          service.cacheTtlSeconds!,
        );
      }

      return res.status(response.status).send(body);
    } catch (error) {
      // Details stay in the logs; clients only learn the service is unavailable.
      this.logger.error(`Upstream ${service.name} failed for ${req.method} ${forwardedPath}: ${error.message}`);
      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: 'الخدمة غير متاحة مؤقتاً — Service temporarily unavailable',
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  private forwardHeaders(req: Request): Record<string, string> {
    const forwardedHeaders: Record<string, string> = {};
    for (const header of FORWARDED_REQUEST_HEADERS) {
      const value = req.headers[header];
      if (typeof value === 'string') {
        forwardedHeaders[header] = value;
      }
    }
    return forwardedHeaders;
  }
}
