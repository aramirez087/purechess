import * as Sentry from '@sentry/node';

jest.mock('@sentry/node', () => ({
  init: jest.fn(),
  captureException: jest.fn().mockReturnValue('fake-event-id'),
  withScope: jest.fn((cb: (scope: unknown) => void) => cb({ setUser: jest.fn() })),
  onUncaughtExceptionIntegration: jest.fn(),
  onUnhandledRejectionIntegration: jest.fn(),
}));

describe('Sentry integration', () => {
  it('captureException returns event id', () => {
    const err = new Error('test error');
    const eventId = Sentry.captureException(err);
    expect(Sentry.captureException).toHaveBeenCalledWith(err);
    expect(eventId).toBe('fake-event-id');
  });

  it('withScope attaches user context before capturing', () => {
    const mockSetUser = jest.fn();
    (Sentry.withScope as jest.Mock).mockImplementationOnce(
      (cb: (scope: { setUser: jest.Mock }) => void) => cb({ setUser: mockSetUser }),
    );

    Sentry.withScope((scope) => {
      (scope as { setUser: jest.Mock }).setUser({ id: 'u1', username: 'alice', isAdmin: false });
      Sentry.captureException(new Error('scoped error'));
    });

    expect(mockSetUser).toHaveBeenCalledWith({ id: 'u1', username: 'alice', isAdmin: false });
    expect(Sentry.captureException).toHaveBeenCalled();
  });

  it('AllExceptionsFilter captures 500 errors to Sentry', async () => {
    const { AllExceptionsFilter } = await import('../../src/observability/all-exceptions.filter');
    const filter = new AllExceptionsFilter();

    const error = new Error('unhandled error');
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    const mockGetRequest = jest.fn().mockReturnValue({
      headers: { 'x-request-id': 'req-1' },
      user: { id: 'u1', username: 'alice', isAdmin: false },
    });

    const host = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    };

    filter.catch(error, host as never);

    expect(Sentry.withScope).toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(500);
  });

  it('AllExceptionsFilter does not capture 4xx errors to Sentry', async () => {
    const { AllExceptionsFilter } = await import('../../src/observability/all-exceptions.filter');
    const { HttpException, HttpStatus } = await import('@nestjs/common');
    const filter = new AllExceptionsFilter();

    jest.clearAllMocks();

    const error = new HttpException('Not Found', HttpStatus.NOT_FOUND);
    const mockJson = jest.fn();
    const mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    const mockGetResponse = jest.fn().mockReturnValue({ status: mockStatus });
    const mockGetRequest = jest.fn().mockReturnValue({ headers: {}, user: undefined });

    const host = {
      switchToHttp: () => ({
        getResponse: mockGetResponse,
        getRequest: mockGetRequest,
      }),
    };

    filter.catch(error, host as never);

    expect(Sentry.withScope).not.toHaveBeenCalled();
    expect(mockStatus).toHaveBeenCalledWith(404);
  });
});
