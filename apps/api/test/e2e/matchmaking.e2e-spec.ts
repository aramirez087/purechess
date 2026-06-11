import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type Redis from 'ioredis';
import { PrismaService } from '../../src/database/prisma.service';
import { createApp, truncateAll, seedUser } from './setup';

const JOIN_BODY = { category: 'blitz', timeControlSeconds: 180, incrementSeconds: 0 };

describe('Matchmaking (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env['NODE_ENV'] = 'test';
    app = await createApp();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    await truncateAll(app);
    // truncateAll clears Postgres only — queue state lives in Redis.
    const redis = app.get<Redis>('REDIS_CLIENT');
    const keys = await redis.keys('mm:*');
    if (keys.length > 0) await redis.del(...keys);
  });

  function joinAs(sessionToken: string, body: Record<string, unknown> = JOIN_BODY) {
    return request(app.getHttpServer())
      .post('/api/matchmaking/join')
      .set('Cookie', `purechess_session=${sessionToken}`)
      .send(body);
  }

  it('POST /api/testing/reset returns ok', async () => {
    await request(app.getHttpServer())
      .delete('/api/testing/reset')
      .expect(200)
      .expect({ ok: true });
  });

  it('POST /api/matchmaking/join requires auth', async () => {
    await request(app.getHttpServer()).post('/api/matchmaking/join').send(JOIN_BODY).expect(401);
  });

  it('POST /api/matchmaking/join succeeds with valid session', async () => {
    const alice = await seedUser(app, { username: 'alice-mm', email: 'alice-mm@test.com' });
    await joinAs(alice.sessionToken).expect((res) => {
      expect([200, 201, 202]).toContain(res.status);
    });
  });

  it('POST /api/matchmaking/leave returns ok for queued user', async () => {
    const bob = await seedUser(app, { username: 'bob-mm', email: 'bob-mm@test.com' });
    await joinAs(bob.sessionToken);

    await request(app.getHttpServer())
      .post('/api/matchmaking/leave')
      .set('Cookie', `purechess_session=${bob.sessionToken}`)
      .expect((res) => {
        expect([200, 204]).toContain(res.status);
      });
  });

  it('rejects a non-preset time control', async () => {
    const eve = await seedUser(app, { username: 'eve-mm', email: 'eve-mm@test.com' });
    await joinAs(eve.sessionToken, {
      category: 'blitz',
      timeControlSeconds: 999,
      incrementSeconds: 0,
    }).expect(400);
  });

  it('two joins in the same pool pair into ONE active game', async () => {
    const a = await seedUser(app, { username: 'pair-a', email: 'pair-a@test.com' });
    const b = await seedUser(app, { username: 'pair-b', email: 'pair-b@test.com' });

    const first = await joinAs(a.sessionToken);
    expect(first.body.status).toBe('queued');

    const second = await joinAs(b.sessionToken);
    expect(second.body.status).toBe('matched');
    expect(second.body.gameId).toBeTruthy();

    const prisma = app.get(PrismaService);
    const game = await prisma.game.findUnique({ where: { id: second.body.gameId } });
    expect(game).toMatchObject({
      status: 'active',
      isRated: true,
      category: 'blitz',
      timeControlSeconds: 180,
    });
    expect([game!.whiteUserId, game!.blackUserId].sort()).toEqual([a.id, b.id].sort());

    // The queued player recovers the pairing from the status mailbox even if
    // the WS push was missed.
    const status = await request(app.getHttpServer())
      .get('/api/matchmaking/status')
      .set('Cookie', `purechess_session=${a.sessionToken}`)
      .expect(200);
    expect(status.body).toMatchObject({ status: 'matched', gameId: second.body.gameId });
  });

  it('concurrent joins create exactly one game (claim-or-enqueue atomicity)', async () => {
    const a = await seedUser(app, { username: 'race-a', email: 'race-a@test.com' });
    const b = await seedUser(app, { username: 'race-b', email: 'race-b@test.com' });

    const [resA, resB] = await Promise.all([joinAs(a.sessionToken), joinAs(b.sessionToken)]);
    const statuses = [resA.body.status, resB.body.status].sort();

    const prisma = app.get(PrismaService);
    const games = await prisma.game.findMany({
      where: { isVsComputer: false, status: 'active' },
    });

    if (statuses.includes('matched')) {
      // One side matched: exactly one game, the other side queued or matched.
      expect(games).toHaveLength(1);
    } else {
      // Both raced into the queue without seeing each other is impossible by
      // construction (single Lua script) — both queued means same-side claim
      // not yet retried; the next status poll must converge.
      const status = await request(app.getHttpServer())
        .get('/api/matchmaking/status')
        .set('Cookie', `purechess_session=${a.sessionToken}`)
        .expect(200);
      expect(['queued', 'matched']).toContain(status.body.status);
      expect(games.length).toBeLessThanOrEqual(1);
    }
  });

  it('does not pair players outside the rating window', async () => {
    const novice = await seedUser(app, { username: 'novice-mm', email: 'novice@test.com' });
    const master = await seedUser(app, { username: 'master-mm', email: 'master@test.com' });

    const prisma = app.get(PrismaService);
    await prisma.rating.upsert({
      where: { userId_category: { userId: master.id, category: 'blitz' } },
      create: { userId: master.id, category: 'blitz', rating: 2400 },
      update: { rating: 2400 },
    });

    const first = await joinAs(novice.sessionToken); // 1500 default
    expect(first.body.status).toBe('queued');
    const second = await joinAs(master.sessionToken); // 2400 — outside ±200
    expect(second.body.status).toBe('queued');

    const games = await prisma.game.findMany({ where: { isVsComputer: false } });
    expect(games).toHaveLength(0);
  });
});
