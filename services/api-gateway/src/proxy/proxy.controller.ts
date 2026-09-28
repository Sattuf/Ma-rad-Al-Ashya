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
import { BLOCKED_ROUTES, ROUTE_OVERRIDES, SERVICES_CONFIG, ServiceConfig } from './services.config';
import { cacheRequests, serviceLabel, statusClass, upstreamDuration } from '../metrics/gateway-metrics';
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
 * Decodes the raw (still percent-encoded) downstream path into segments and rejects anything
 * that could change its meaning once re-parsed upstream: dot segments, encoded slashes and
 * encoded '?' or '#' (e.g. /listings/../users/1/status or /listings/batch%23).
 * Returns the decoded segments, or null when the path is unsafe.
 */
export function sanitizePath(rawPath: string): string[] | null {
  const decodedSegments: string[] = [];
  for (const segment of rawPath.split('/').filter((s) => s.length > 0)) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (decoded === '.' || decoded === '..' || /[\/\\?#]/.test(decoded)) {
      return null;
    }
    decodedSegments.push(decoded);
  }
  return decodedSegments;
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
      (route.service === '*' || route.service === serviceName) &&
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
  async proxyWithPath(@Param('servicePrefix') servicePrefix: string, @Req() req: Request, @Res() res: Response) {
    // Express has already percent-decoded route params; work from the raw URL instead.
    const rawPathname = req.originalUrl.split('?')[0];
    const prefixMarker = `/api/v1/${servicePrefix}/`;
    const start = rawPathname.indexOf(prefixMarker);
    const rawPath = start >= 0 ? rawPathname.substring(start + prefixMarker.length) : '';
    return this.proxyRequest(servicePrefix, rawPath, req, res);
  }

  private async proxyRequest(servicePrefix: string, rawPath: string, req: Request, res: Response) {
    const pathSegments = sanitizePath(rawPath ?? '');
    if (pathSegments === null) {
      throw new HttpException({ statusCode: HttpStatus.BAD_REQUEST, message: 'مسار غير صالح — Invalid path' }, HttpStatus.BAD_REQUEST);
    }

    // Some public paths belong to a different service than their prefix suggests
    // (e.g. /users/:id/reviews lives in transactions-service); those keep their full path.
    const clientPath = '/' + [servicePrefix, ...pathSegments].join('/');
    const override = ROUTE_OVERRIDES.find((o) => o.pattern.test(clientPath));
    const service = override
      ? SERVICES_CONFIG.find((s) => s.name === override.service)
      : this.serviceMap.get(servicePrefix);
    if (!service) {
      throw new HttpException({ statusCode: HttpStatus.NOT_FOUND, message: 'المسار غير موجود — Not found' }, HttpStatus.NOT_FOUND);
    }

    const segments = override || service.stripPrefix === false ? [servicePrefix, ...pathSegments] : pathSegments;
    // Decoded form is what the upstream router will see, so the blocklist checks that;
    // the URL we send re-encodes every segment so nothing is decoded twice.
    const forwardedPath = '/' + segments.join('/');
    const encodedPath = '/' + segments.map(encodeURIComponent).join('/');
    if (isBlockedRoute(service.name, req.method, forwardedPath)) {
      throw new HttpException({ statusCode: HttpStatus.NOT_FOUND, message: 'المسار غير موجود — Not found' }, HttpStatus.NOT_FOUND);
    }

    const queryIndex = req.originalUrl.indexOf('?');
    const queryString = queryIndex >= 0 ? req.originalUrl.substring(queryIndex) : '';
    const fullUrl = `${service.url}${encodedPath}${queryString}`;

    const cacheable =
      req.method === 'GET' &&
      !req.headers.authorization &&
      !!service.cacheTtlSeconds &&
      !!this.cache &&
      (!service.cacheableRoutes || service.cacheableRoutes.test(forwardedPath));
    const cacheKey = `gw:cache:${service.name}:${encodedPath}${queryString}`;
    if (cacheable) {
      const hit = await this.cache!.get(cacheKey);
      cacheRequests.inc({ service: serviceLabel(service), result: hit ? 'hit' : 'miss' });
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

    const stopTimer = upstreamDuration.startTimer({ service: serviceLabel(service), method: req.method });
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

      stopTimer({ status_class: statusClass(response.status) });
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
      stopTimer({ status_class: statusClass() });
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
