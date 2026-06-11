import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { createApp, truncateAll, seedUser } from './setup';

describe('Games (e2e)', () => {
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

  it('GET /api/games/:id/state returns 404 for unknown game', async () => {
    const alice = await seedUser(app, { username: 'alice-g', email: 'alice-g@test.com' });
    await request(app.getHttpServer())
      .get('/api/games/nonexistent-id/state')
      .set('Cookie', `purechess_session=${alice.sessionToken}`)
      .expect(404);
  });

  it('POST /api/testing/games creates a game', async () => {
    const alice = await seedUser(app, { username: 'alice-g2', email: 'alice-g2@test.com' });
    const bob = await seedUser(app, { username: 'bob-g2', email: 'bob-g2@test.com' });

    const res = await request(app.getHttpServer())
      .post('/api/testing/games')
      .send({
        whiteUserId: alice.id,
        blackUserId: bob.id,
        status: 'active',
        timeControlSeconds: 180,
        incrementSeconds: 2,
        category: 'blitz',
      })
      .expect(201);

    expect(res.body).toHaveProperty('id');
  });

  it('GET /api/games/:id/state returns game data to a player', async () => {
    const alice = await seedUser(app, { username: 'alice-g3', email: 'alice-g3@test.com' });
    const bob = await seedUser(app, { username: 'bob-g3', email: 'bob-g3@test.com' });

    const gameRes = await request(app.getHttpServer())
      .post('/api/testing/games')
      .send({ whiteUserId: alice.id, blackUserId: bob.id, status: 'active' })
      .expect(201);

    const { id } = gameRes.body as { id: string };

    const res = await request(app.getHttpServer())
      .get(`/api/games/${id}/state`)
      .set('Cookie', `purechess_session=${alice.sessionToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ gameId: id, yourColor: 'white' });
  });

  it('GET /api/games/:id/state rejects non-players', async () => {
    const alice = await seedUser(app, { username: 'alice-g4', email: 'alice-g4@test.com' });
    const bob = await seedUser(app, { username: 'bob-g4', email: 'bob-g4@test.com' });
    const eve = await seedUser(app, { username: 'eve-g4', email: 'eve-g4@test.com' });

    const gameRes = await request(app.getHttpServer())
      .post('/api/testing/games')
      .send({ whiteUserId: alice.id, blackUserId: bob.id, status: 'completed' })
      .expect(201);

    const { id } = gameRes.body as { id: string };

    await request(app.getHttpServer()).get(`/api/games/${id}/state`).expect(401);
    await request(app.getHttpServer())
      .get(`/api/games/${id}/state`)
      .set('Cookie', `purechess_session=${eve.sessionToken}`)
      .expect(403);
  });
});
