import { errorKind, errorMessage, ERROR_COPY } from '@/lib/errors';

const http = (status: number, message?: unknown) => ({ response: { status, data: { message } } });

describe('errorKind', () => {
  const online = Object.getOwnPropertyDescriptor(window.navigator, 'onLine');
  afterEach(() => online && Object.defineProperty(window.navigator, 'onLine', online));

  it('tells the user connection apart from our server', () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => false });
    expect(errorKind(new Error('Network Error'))).toBe('offline');
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => true });
    expect(errorKind(new Error('Network Error'))).toBe('network');
    expect(errorKind({ code: 'ECONNABORTED' })).toBe('timeout');
    expect(errorKind(http(502))).toBe('server');
  });

  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not-found'],
    [413, 'too-large'],
    [429, 'rate-limit'],
    [400, 'rejected'],
    [409, 'rejected'],
  ])('%i → %s', (status, kind) => {
    expect(errorKind(http(status))).toBe(kind);
  });
});

describe('errorMessage', () => {
  it('shows Arabic server messages as they are', () => {
    expect(errorMessage(http(401, 'بيانات الدخول غير صحيحة'), 'x')).toBe('بيانات الدخول غير صحيحة');
  });

  it('translates known English messages', () => {
    expect(errorMessage(http(409, 'You have already reported this item'), 'x')).toBe('سبق أن أبلغت عن هذا. سيراجعه فريقنا.');
  });

  it('never shows raw English or validation arrays; falls back to the screen context', () => {
    expect(errorMessage(http(400, ['title must be longer than or equal to 5 characters']), 'تعذّر نشر الإعلان.')).toBe('تعذّر نشر الإعلان.');
    expect(errorMessage(http(400, 'Invalid token payload'), 'تعذّر الحفظ.')).toBe('تعذّر الحفظ.');
  });

  it('does not blame the user for our failures', () => {
    expect(errorMessage(http(500, 'TypeError: cannot read x'), 'x')).toBe(`${ERROR_COPY.server.title}. ${ERROR_COPY.server.description}`);
    expect(errorMessage(http(500), 'x')).toContain('ليست منك');
  });

  it('explains rate limits with what to do', () => {
    expect(errorMessage(http(429, 'ThrottlerException: Too Many Requests'), 'x')).toContain('انتظر دقيقة');
  });
});
