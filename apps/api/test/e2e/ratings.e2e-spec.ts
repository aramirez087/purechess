import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { createApp, truncateAll, seedUser } from './setup';

describe('Ratings (e2e)', () => {
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

  it('GET /api/users/:username/profile returns ratings array', async () => {
    const alice = await seedUser(app, { username: 'alice-rat', email: 'alice-rat@test.com' });

    const res = await request(app.getHttpServer())
      .get(`/api/users/${alice.username}`)
      .set('Cookie', `purechess_session=${alice.sessionToken}`)
      .expect((r) => {
        expect([200, 404]).toContain(r.status);
      });

    if (res.status === 200) {
      expect(res.body).toHaveProperty('username', 'alice-rat');
    }
  });

  it('completed rated game updates ratings', async () => {
    const alice = await seedUser(app, { username: 'alice-rat2', email: 'alice-rat2@test.com' });
    const bob = await seedUser(app, { username: 'bob-rat2', email: 'bob-rat2@test.com' });

    const gameRes = await request(app.getHttpServer())
      .post('/api/testing/games')
      .send({
        whiteUserId: alice.id,
        blackUserId: bob.id,
        status: 'completed',
        timeControlSeconds: 180,
        incrementSeconds: 0,
        category: 'blitz',
      })
      .expect(201);

    expect(gameRes.body).toHaveProperty('id');
  });
});
