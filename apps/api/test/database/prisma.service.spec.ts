import { PrismaService } from '../../src/database/prisma.service';

/**
 * The keepalive defeats Neon autosuspend so the first move after idle never
 * eats a cold-wake. It must NEVER run under test (open handle + mocked client),
 * must issue `SELECT 1` on its interval when enabled, and must be cleared on
 * module destroy.
 */
describe('PrismaService keepalive', () => {
  const ORIGINAL_ENV = process.env['NODE_ENV'];

  function makeService(): {
    service: PrismaService;
    connect: jest.Mock;
    disconnect: jest.Mock;
    queryRaw: jest.Mock;
  } {
    const service = new PrismaService();
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    // Don't touch a real database in a unit spec.
    (service as unknown as { $connect: unknown }).$connect = connect;
    (service as unknown as { $disconnect: unknown }).$disconnect = disconnect;
    (service as unknown as { $queryRaw: unknown }).$queryRaw = queryRaw;
    return { service, connect, disconnect, queryRaw };
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
    process.env['NODE_ENV'] = ORIGINAL_ENV;
  });

  it('does NOT start the keepalive under NODE_ENV=test', async () => {
    process.env['NODE_ENV'] = 'test';
    const { service, connect, queryRaw } = makeService();

    await service.onModuleInit();
    expect(connect).toHaveBeenCalledTimes(1);

    // Even far past the interval, no SELECT 1 fires.
    jest.advanceTimersByTime(10 * 60 * 1000);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('issues SELECT 1 on the interval when enabled', async () => {
    process.env['NODE_ENV'] = 'production';
    const { service, queryRaw } = makeService();

    await service.onModuleInit();
    expect(queryRaw).not.toHaveBeenCalled();

    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(queryRaw).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('survives a transient keepalive failure and keeps ticking', async () => {
    process.env['NODE_ENV'] = 'production';
    const { service, queryRaw } = makeService();
    queryRaw.mockRejectedValueOnce(new Error('neon waking up'));

    await service.onModuleInit();

    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(queryRaw).toHaveBeenCalledTimes(1);
    // The rejection is swallowed; the next tick still fires.
    await Promise.resolve();
    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('clears the keepalive on module destroy', async () => {
    process.env['NODE_ENV'] = 'production';
    const { service, disconnect, queryRaw } = makeService();

    await service.onModuleInit();
    jest.advanceTimersByTime(4 * 60 * 1000);
    expect(queryRaw).toHaveBeenCalledTimes(1);

    await service.onModuleDestroy();
    expect(disconnect).toHaveBeenCalledTimes(1);

    // No further ticks after destroy.
    jest.advanceTimersByTime(20 * 60 * 1000);
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });
});
