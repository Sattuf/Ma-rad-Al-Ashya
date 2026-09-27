import { Test, TestingModule } from '@nestjs/testing';
import { HttpService } from '@nestjs/axios';
import { ProxyController } from './proxy.controller';
import { of, throwError } from 'rxjs';
import { HttpException, HttpStatus } from '@nestjs/common';

describe('ProxyController', () => {
  let controller: ProxyController;
  let httpService: HttpService;

  const mockHttpService = {
    request: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProxyController],
      providers: [
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
      ],
    }).compile();

    controller = module.get<ProxyController>(ProxyController);
    httpService = module.get<HttpService>(HttpService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('proxyRoot', () => {
    it('should proxy request to the correct service', async () => {
      const mockResponse = {
        status: 200,
        data: { status: 'ok', service: 'auth-service' },
        headers: { 'content-type': 'application/json' },
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const mockReq = {
        method: 'GET',
        originalUrl: '/api/v1/auth',
        url: '/api/v1/auth',
        body: {},
        headers: {},
        ip: '127.0.0.1',
        hostname: 'localhost',
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
      } as any;

      await controller.proxyRoot('auth', mockReq, mockRes);

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          method: 'GET',
          url: expect.stringContaining('3001'),
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });

    it('should return 404 for unknown service prefix', async () => {
      const mockReq = {
        method: 'GET',
        originalUrl: '/api/v1/unknown',
        url: '/api/v1/unknown',
        body: {},
        headers: {},
        ip: '127.0.0.1',
        hostname: 'localhost',
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
      } as any;

      await expect(
        controller.proxyRoot('unknown', mockReq, mockRes),
      ).rejects.toThrow(HttpException);
    });

    it('should return 502 when downstream service is unavailable', async () => {
      mockHttpService.request.mockReturnValue(
        throwError(() => new Error('ECONNREFUSED')),
      );

      const mockReq = {
        method: 'GET',
        originalUrl: '/api/v1/auth',
        url: '/api/v1/auth',
        body: {},
        headers: { authorization: 'Bearer token123' },
        ip: '127.0.0.1',
        hostname: 'localhost',
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
      } as any;

      await expect(
        controller.proxyRoot('auth', mockReq, mockRes),
      ).rejects.toThrow(HttpException);
    });
  });

  describe('proxyWithPath', () => {
    it('should proxy request with sub-path', async () => {
      const mockResponse = {
        status: 200,
        data: [{ id: 1, title: 'سيارة للبيع' }],
        headers: { 'content-type': 'application/json' },
      };

      mockHttpService.request.mockReturnValue(of(mockResponse));

      const mockReq = {
        method: 'GET',
        originalUrl: '/api/v1/listings/recent',
        url: '/api/v1/listings/recent',
        body: {},
        headers: {},
        ip: '127.0.0.1',
        hostname: 'localhost',
      } as any;

      const mockRes = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn().mockReturnThis(),
        send: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
      } as any;

      await controller.proxyWithPath('listings', mockReq, mockRes);

      expect(mockHttpService.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: expect.stringContaining('recent'),
        }),
      );
      expect(mockRes.status).toHaveBeenCalledWith(200);
    });
  });
});
