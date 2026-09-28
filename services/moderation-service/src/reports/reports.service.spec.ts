import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ReportsService } from './reports.service';
import { Report } from './entities/report.entity';
import { ReportCount } from './entities/report-count.entity';
import { ConflictException, BadRequestException, BadGatewayException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bull';
import { HttpService } from '@nestjs/axios';
import { of, throwError } from 'rxjs';

describe('ReportsService', () => {
  let service: ReportsService;

  const mockReportsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockReportCountsRepo = {
    create: jest.fn(),
    save: jest.fn(),
    findOne: jest.fn(),
  };

  const mockQueue = {
    add: jest.fn(),
  };

  const mockHttpService = {
    put: jest.fn().mockReturnValue(of({ data: {} })),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportsService,
        {
          provide: getRepositoryToken(Report),
          useValue: mockReportsRepo,
        },
        {
          provide: getRepositoryToken(ReportCount),
          useValue: mockReportCountsRepo,
        },
        {
          provide: getQueueToken('auto-review'),
          useValue: mockQueue,
        },
        {
          provide: HttpService,
          useValue: mockHttpService,
        }
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createReport', () => {
    it('should throw BadRequestException if reporting self', async () => {
      await expect(service.createReport('user1', { target_type: 'user', target_id: 'user1', reason: 'spam' })).rejects.toThrow(BadRequestException);
    });

    it('should throw ConflictException if duplicate report', async () => {
      mockReportsRepo.findOne.mockResolvedValueOnce({ id: 'report1' });
      await expect(service.createReport('user1', { target_type: 'user', target_id: 'user2', reason: 'spam' })).rejects.toThrow(ConflictException);
    });

    it('should create report and increment counts', async () => {
      mockReportsRepo.findOne.mockResolvedValueOnce(null);
      mockReportsRepo.create.mockReturnValue({ id: 'report1', target_type: 'listing', target_id: 'list1' });
      mockReportsRepo.save.mockResolvedValue({ id: 'report1' });

      mockReportCountsRepo.findOne.mockResolvedValueOnce({ pending_count: 0, total_count: 0 });
      mockReportCountsRepo.save.mockResolvedValue({});

      await service.createReport('user1', { target_type: 'listing', target_id: 'list1', reason: 'spam' });

      expect(mockReportsRepo.create).toHaveBeenCalled();
      expect(mockReportsRepo.save).toHaveBeenCalled();
      expect(mockReportCountsRepo.save).toHaveBeenCalled();
    });
  });

  describe('reviewReport', () => {
    it('should update report status and action_taken', async () => {
      mockReportsRepo.findOne.mockResolvedValueOnce({ id: 'report1', status: 'pending', target_type: 'user', target_id: 'user2' });
      mockReportsRepo.save.mockResolvedValue({ id: 'report1', status: 'resolved' });

      mockReportCountsRepo.findOne.mockResolvedValueOnce({ pending_count: 1 });

      await service.reviewReport('report1', { status: 'resolved', action_taken: 'user_banned' }, 'admin1');

      expect(mockReportsRepo.save).toHaveBeenCalled();
      expect(mockReportCountsRepo.save).toHaveBeenCalled();
      expect(mockHttpService.put).toHaveBeenCalled();
    });
  });

  describe('reviewReport', () => {
    const pendingListingReport = () => ({ id: 'r1', status: 'pending', target_type: 'listing', target_id: 'l1' });

    it('does not record a removal when the listing could not be removed', async () => {
      mockReportsRepo.findOne.mockResolvedValue(pendingListingReport());
      mockHttpService.put.mockReturnValueOnce(throwError(() => new Error('ECONNREFUSED')));

      await expect(service.reviewReport('r1', { status: 'resolved', action_taken: 'listing_removed' }, 'admin')).rejects.toThrow(BadGatewayException);
      expect(mockReportsRepo.save).not.toHaveBeenCalled();
      expect(mockReportCountsRepo.save).not.toHaveBeenCalled();
    });

    it('leaves the queue count alone when re-reviewing a closed report', async () => {
      mockReportsRepo.findOne.mockResolvedValue({ ...pendingListingReport(), status: 'resolved' });
      mockReportsRepo.save.mockImplementation(async (r) => r);
      mockReportCountsRepo.findOne.mockResolvedValue({ pending_count: 3 });

      await service.reviewReport('r1', { status: 'dismissed', action_taken: 'none' }, 'admin');
      expect(mockReportCountsRepo.save).not.toHaveBeenCalled();
    });

    it('closing a report that was only "reviewed" still leaves the queue', async () => {
      mockReportsRepo.findOne.mockResolvedValue({ ...pendingListingReport(), status: 'reviewed' });
      mockReportsRepo.save.mockImplementation(async (r) => r);
      mockReportCountsRepo.findOne.mockResolvedValue({ pending_count: 2 });

      await service.reviewReport('r1', { status: 'dismissed', action_taken: 'none' }, 'admin');
      expect(mockReportCountsRepo.save).toHaveBeenCalledWith(expect.objectContaining({ pending_count: 1 }));
    });

    it('rejects unknown statuses and actions', async () => {
      await expect(service.reviewReport('r1', { status: 'approved' }, 'admin')).rejects.toThrow(BadRequestException);
      await expect(service.reviewReport('r1', { status: 'resolved', action_taken: 'delete_everything' }, 'admin')).rejects.toThrow(BadRequestException);
    });
  });
});
