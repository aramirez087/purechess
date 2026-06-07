import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from '../../src/app.controller';
import { AppService } from '../../src/app.service';

const mockAppService = {
  getHealth: jest.fn(),
};

describe('AppController /health', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [{ provide: AppService, useValue: mockAppService }],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns 200 with ok status when all deps healthy', async () => {
    mockAppService.getHealth.mockResolvedValue({
      status: 'ok',
      db: 'ok',
      redis: 'ok',
      uptime: 42,
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as import('express').Response;

    await controller.getHealth(res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', db: 'ok', redis: 'ok', uptime: 42 });
  });

  it('returns 503 when db is unhealthy', async () => {
    mockAppService.getHealth.mockResolvedValue({
      status: 'error',
      db: 'error',
      redis: 'ok',
      uptime: 10,
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as import('express').Response;

    await controller.getHealth(res);

    expect(res.status).toHaveBeenCalledWith(503);
  });

  it('returns 503 when redis is unhealthy', async () => {
    mockAppService.getHealth.mockResolvedValue({
      status: 'error',
      db: 'ok',
      redis: 'error',
      uptime: 5,
    });

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as unknown as import('express').Response;

    await controller.getHealth(res);

    expect(res.status).toHaveBeenCalledWith(503);
  });
});

describe('AppService.getHealth', () => {
  let service: AppService;

  const mockPrisma = {
    $queryRaw: jest.fn(),
  };

  const mockRedis = {
    ping: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppService,
        { provide: 'PrismaService', useValue: mockPrisma },
        { provide: 'REDIS_CLIENT', useValue: mockRedis },
      ],
    })
      .overrideProvider(AppService)
      .useFactory({
        factory: () => {
          const svc = new AppService(mockPrisma as never, mockRedis as never);
          return svc;
        },
      })
      .compile();

    service = module.get<AppService>(AppService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns status ok when db and redis respond', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockResolvedValue('PONG');

    const result = await service.getHealth();

    expect(result.status).toBe('ok');
    expect(result.db).toBe('ok');
    expect(result.redis).toBe('ok');
    expect(typeof result.uptime).toBe('number');
  });

  it('returns db error when prisma throws', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('connection refused'));
    mockRedis.ping.mockResolvedValue('PONG');

    const result = await service.getHealth();

    expect(result.status).toBe('error');
    expect(result.db).toBe('error');
    expect(result.redis).toBe('ok');
  });

  it('returns redis error when ping fails', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedis.ping.mockRejectedValue(new Error('timeout'));

    const result = await service.getHealth();

    expect(result.status).toBe('error');
    expect(result.db).toBe('ok');
    expect(result.redis).toBe('error');
  });
});
