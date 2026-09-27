import { KycService } from './kyc.service';

describe('KycService.handleWebhook replay protection', () => {
  const build = (current: string) => {
    const verification: any = { user_id: 'u-1', session_id: 's-1', status: current };
    const repo = { findOne: jest.fn().mockResolvedValue(verification), save: jest.fn() };
    const audit = { create: jest.fn((x) => x), save: jest.fn() };
    const kms = { encrypt: jest.fn().mockResolvedValue({ encryptedData: 'x', keyId: 'k' }) };
    const http = { put: jest.fn() };
    const service = new KycService(repo as any, audit as any, {} as any, kms as any, http as any);
    return { service, repo, verification };
  };

  it('applies a new status to a pending session', async () => {
    const { service, repo } = build('pending');
    await service.handleWebhook({ session_id: 's-1', status: 'Declined' });
    expect(repo.save).toHaveBeenCalled();
  });

  it('ignores a replayed Approved after the session was Declined', async () => {
    const { service, repo, verification } = build('Declined');
    await service.handleWebhook({ session_id: 's-1', status: 'Approved' });
    expect(repo.save).not.toHaveBeenCalled();
    expect(verification.status).toBe('Declined');
  });

  it('treats a repeated delivery of the same status as a no-op', async () => {
    const { service, repo } = build('In Review');
    await service.handleWebhook({ session_id: 's-1', status: 'In Review' });
    expect(repo.save).not.toHaveBeenCalled();
  });
});
