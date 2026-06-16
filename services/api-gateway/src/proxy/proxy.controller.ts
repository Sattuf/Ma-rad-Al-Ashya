import {
  Controller,
  All,
  Req,
  Res,
  Param,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiParam } from '@nestjs/swagger';
import { SERVICES_CONFIG, ServiceConfig } from './services.config';

/**
 * وحدة التحكم الوكيلة — Proxy Controller
 * توجه جميع الطلبات /api/v1/{service}/* إلى الخدمة المناسبة
 */
@ApiTags('Proxy')
@Controller('api/v1')
export class ProxyController {
  private readonly logger = new Logger(ProxyController.name);
  private readonly serviceMap: Map<string, ServiceConfig>;

  constructor(private readonly httpService: HttpService) {
    this.serviceMap = new Map(
      SERVICES_CONFIG.map((service) => [service.prefix, service]),
    );
  }

  @All(':servicePrefix')
  @ApiOperation({ summary: 'توجيه الطلبات للخدمات المصغرة — Proxy to microservice (root)' })
  @ApiParam({ name: 'servicePrefix', description: 'بادئة الخدمة (auth, listings, search, etc.)' })
  async proxyRoot(
    @Param('servicePrefix') servicePrefix: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.proxyRequest(servicePrefix, '', req, res);
  }

  @All(':servicePrefix/*path')
  @ApiOperation({ summary: 'توجيه الطلبات للخدمات المصغرة — Proxy to microservice (with path)' })
  async proxyWithPath(
    @Param('servicePrefix') servicePrefix: string,
    @Param('path') path: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    return this.proxyRequest(servicePrefix, path, req, res);
  }

  private async proxyRequest(
    servicePrefix: string,
    path: string,
    req: Request,
    res: Response,
  ) {
    const service = this.serviceMap.get(servicePrefix);

    if (!service) {
      throw new HttpException(
        {
          statusCode: HttpStatus.NOT_FOUND,
          message: `الخدمة غير موجودة — Service '${servicePrefix}' not found`,
          availableServices: Array.from(this.serviceMap.keys()),
        },
        HttpStatus.NOT_FOUND,
      );
    }

    const targetUrl = path
      ? `${service.url}/${path}`
      : `${service.url}`;

    // إضافة query params إن وجدت
    const queryString = req.url.includes('?')
      ? req.url.substring(req.url.indexOf('?'))
      : '';

    const fullUrl = `${targetUrl}${queryString}`;

    this.logger.log(
      `[${req.method}] ${req.originalUrl} → ${fullUrl} (${service.name})`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.request({
          method: req.method as any,
          url: fullUrl,
          data: req.body,
          headers: {
            ...this.forwardHeaders(req),
            'X-Forwarded-For': req.ip,
            'X-Forwarded-Host': req.hostname,
            'X-Gateway-Service': service.name,
          },
          timeout: 30000,
          validateStatus: () => true, // لا ترمي خطأ على أي status
        }),
      );

      // تمرير headers الرد
      const responseHeaders = response.headers;
      if (responseHeaders['content-type']) {
        res.setHeader('content-type', responseHeaders['content-type'] as any);
      }

      return res.status(response.status).json(response.data);
    } catch (error) {
      this.logger.error(
        `خطأ في الاتصال بـ ${service.name}: ${error.message}`,
      );

      throw new HttpException(
        {
          statusCode: HttpStatus.BAD_GATEWAY,
          message: `تعذر الاتصال بالخدمة — Cannot connect to ${service.name}`,
          service: service.name,
          error: error.message,
        },
        HttpStatus.BAD_GATEWAY,
      );
    }
  }

  /**
   * تمرير الـ headers المهمة فقط — Forward relevant headers
   */
  private forwardHeaders(req: Request): Record<string, string> {
    const forwardedHeaders: Record<string, string> = {};
    const headersToForward = [
      'authorization',
      'content-type',
      'accept',
      'accept-language',
      'user-agent',
      'x-request-id',
      'x-correlation-id',
    ];

    for (const header of headersToForward) {
      if (req.headers[header]) {
        forwardedHeaders[header] = req.headers[header] as string;
      }
    }

    return forwardedHeaders;
  }
}
