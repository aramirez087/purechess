import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../../src/app.module';
import { PrismaService } from '../../src/database/prisma.service';
import * as request from 'supertest';

export async function createApp(): Promise<INestApplication> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();
  return app;
}

export async function truncateAll(app: INestApplication): Promise<void> {
  const prisma = app.get(PrismaService);
  await prisma.$transaction([
    prisma.move.deleteMany(),
    prisma.adminAuditLog.deleteMany(),
    prisma.fairPlaySignal.deleteMany(),
    prisma.report.deleteMany(),
    prisma.ratingHistory.deleteMany(),
    prisma.rating.deleteMany(),
    prisma.game.deleteMany(),
    prisma.session.deleteMany(),
    prisma.passwordResetToken.deleteMany(),
    prisma.oAuthAccount.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

export async function seedUser(
  app: INestApplication,
  opts: { username: string; email: string; isAdmin?: boolean },
): Promise<{ id: string; username: string; email: string; sessionToken: string }> {
  const res = await request(app.getHttpServer())
    .post('/api/testing/users')
    .send(opts)
    .expect(201);
  return res.body as { id: string; username: string; email: string; sessionToken: string };
}
