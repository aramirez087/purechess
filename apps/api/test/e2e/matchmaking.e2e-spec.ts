import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createApp, truncateAll, seedUser } from './setup';

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
  });

  it('POST /api/testing/reset returns ok', async () => {
    await request(app.getHttpServer())
      .delete('/api/testing/reset')
      .expect(200)
      .expect({ ok: true });
  });

  it('POST /api/matchmaking/join requires auth', async () => {
    await request(app.getHttpServer())
      .post('/api/matchmaking/join')
      .send({ category: 'blitz', timeControlSeconds: 180, incrementSeconds: 0 })
      .expect(401);
  });

  it('POST /api/matchmaking/join succeeds with valid session', async () => {
    const alice = await seedUser(app, { username: 'alice-mm', email: 'alice-mm@test.com' });
    await request(app.getHttpServer())
      .post('/api/matchmaking/join')
      .set('Cookie', `purchess_session=${alice.sessionToken}`)
      .send({ category: 'blitz', timeControlSeconds: 180, incrementSeconds: 0 })
      .expect((res) => {
        expect([200, 201, 202]).toContain(res.status);
      });
  });

  it('POST /api/matchmaking/leave returns ok for queued user', async () => {
    const bob = await seedUser(app, { username: 'bob-mm', email: 'bob-mm@test.com' });
    await request(app.getHttpServer())
      .post('/api/matchmaking/join')
      .set('Cookie', `purchess_session=${bob.sessionToken}`)
      .send({ category: 'blitz', timeControlSeconds: 180, incrementSeconds: 0 });

    await request(app.getHttpServer())
      .post('/api/matchmaking/leave')
      .set('Cookie', `purchess_session=${bob.sessionToken}`)
      .expect((res) => {
        expect([200, 204]).toContain(res.status);
      });
  });
});
